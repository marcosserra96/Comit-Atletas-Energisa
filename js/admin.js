// =====================================================
// js/admin.js - ORQUESTRADOR PRINCIPAL
// =====================================================
import { 
  auth, db, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, 
  onAuthStateChanged, query, where, increment 
} from "./firebase.js";

import { appState } from "./modules/state.js";
import { showToast, mostrarConfirmacao, setupSubTabs, setupConfiguracoesGerais } from "./modules/ui.js";
import { setupDashboard, renderGraficosETop } from "./modules/dashboard.js";
import { setupFinanceiroPlanilha, carregarFinanceiroPlanilha } from "./modules/financeiro.js";
import { setupContabilizacao, setAtualizarTelasCallback } from "./modules/pontuacao.js";
import { setupCadastrarPessoa, setupImportacaoAtletas, setupToggleAtivos, setupLimparBase, setAtualizarTelasGestao } from "./modules/gestao.js";

// =====================================================
// 🔒 INICIALIZAÇÃO E PERMISSÕES
// =====================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    appState.currentUser = user; 
    try {
      const docSnap = await getDoc(doc(db, "atletas", user.uid));
      if (docSnap.exists() && (docSnap.data().role === "admin" || docSnap.data().role === "comite")) {
        appState.userRole = docSnap.data().role;
        appState.userPermissoes = appState.userRole === "admin" ? 
          ["visao-geral", "contabilizacao", "financeiro_view", "financeiro_edit", "gestao", "configuracoes"] : 
          (docSnap.data().permissoes || ["visao-geral", "configuracoes"]);
        
        construirMenu(); 
        iniciarPainelAdmin();
      } else { window.location.href = "index.html"; }
    } catch (err) { showToast("Erro ao validar permissões: " + err.message, "error"); }
  } else { window.location.href = "index.html"; }
});

function construirMenu() {
  const menu = document.getElementById("menuNavegacao"); 
  menu.innerHTML = "";
  
  const itensDisponiveis = [
    { id: "visao-geral", icon: "layout-dashboard", text: "Estratégico" },
    { id: "atletas", icon: "id-card", text: "Atletas", permCheck: ["visao-geral", "gestao"] },
    { id: "contabilizacao", icon: "calculator", text: "Lançamentos" },
    { id: "financeiro", icon: "dollar-sign", text: "Financeiro", permCheck: ["financeiro_view", "financeiro_edit"] },
    { id: "gestao", icon: "users", text: "Gestão Base" },
    { id: "configuracoes", icon: "settings", text: "Ajustes" }
  ];

  let abaAtiva = false;
  itensDisponiveis.forEach(item => {
    let hasAccess = item.permCheck ? item.permCheck.some(p => appState.userPermissoes.includes(p)) : appState.userPermissoes.includes(item.id);
    if (hasAccess || appState.userRole === "admin") {
      const isFirst = !abaAtiva; if(isFirst) abaAtiva = true;
      menu.innerHTML += `<div class="menu-item ${isFirst ? 'active' : ''}" data-section="${item.id}"><i data-lucide="${item.icon}"></i><span>${item.text}</span></div>`;
    }
  });
  
  document.querySelectorAll("main section").forEach(sec => {
    sec.classList.remove("active-section");
    const activeMenu = document.querySelector('.menu-item.active');
    if (activeMenu && sec.id === activeMenu.dataset.section) sec.classList.add("active-section"); 
  });

  const badge = document.getElementById("userGroupBadge"); 
  if(badge) {
    badge.style.display = "inline-block";
    if (appState.userRole === "admin") { badge.textContent = "Admin"; badge.style.background = "var(--danger)"; } 
    else { badge.textContent = "Comitê"; badge.style.background = "var(--primary)"; }
  }

  if (appState.userRole !== "admin") { document.querySelectorAll(".admin-only-element").forEach(el => el.style.display = "none"); }
  
  document.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".menu-item").forEach(btn => btn.classList.remove("active")); 
      item.classList.add("active");
      document.querySelectorAll("main section").forEach(sec => { 
        sec.classList.remove("active-section"); 
        if (sec.id === item.dataset.section) sec.classList.add("active-section"); 
      });
      if(typeof lucide !== 'undefined') lucide.createIcons();
    });
  });
  if(typeof lucide !== 'undefined') lucide.createIcons();
}

function iniciarPainelAdmin() {
  setupSubTabs(); 
  setupConfiguracoesGerais();
  setupDashboard();
  setupFinanceiroPlanilha();
  setupContabilizacao();
  setupCadastrarPessoa();
  setupImportacaoAtletas();
  setupToggleAtivos();
  setupLimparBase();

  setAtualizarTelasCallback(atualizarTelas);
  setAtualizarTelasGestao(atualizarTelas);

  setupRelatorioConsolidado(); 
  setupPermissoesModal(); 
  setupAgenda(); 
  setupModalRegras(); 
  setupModalEditar(); 
  setupFichaAtleta();
  setupAtletasConsulta();
  
  atualizarTelas();
}

async function atualizarTelas() {
  if (appState.userRole === "admin" || appState.userPermissoes.includes("gestao")) setupAprovacoes();
  await carregarAgenda(); 
  
  const snapA = await getDocs(query(collection(db, "atletas"), where("status", "==", "Aprovado")));
  appState.mapAtletas = {}; 
  snapA.forEach(d => { appState.mapAtletas[d.id] = { id: d.id, ...d.data() }; });
  
  await carregarHistorico(); 
  await carregarFinanceiroPlanilha(); 
  await carregarEquipesEDashboard(); 
  await carregarRegras();
  renderAtletasConsulta();

  const modTreinoSelect = document.getElementById("modTreino");
  if (modTreinoSelect && modTreinoSelect.value) modTreinoSelect.dispatchEvent(new Event('change'));
}

// =====================================================
// 📊 ORQUESTRAÇÃO DE DADOS (GETTERS) E TABELAS
// =====================================================
async function carregarEquipesEDashboard() {
  let htmlFilaBike = "", htmlFilaCorrida = "", htmlBike = "", htmlCorrida = "", htmlComite = ""; 
  let contFila = 0, contBike = 0, contCorrida = 0, contComite = 0, ptsBike = 0, ptsCorrida = 0; 
  let todosAtletas = []; 
  
  let listaOrdenada = Object.values(appState.mapAtletas); 
  const filaEspera = listaOrdenada.filter(u => u.equipe === "Fila - Bicicleta" || u.equipe === "Fila - Corrida" || u.equipe === "Fila de Espera"); 
  const titulares = listaOrdenada.filter(u => u.equipe !== "Fila - Bicicleta" && u.equipe !== "Fila - Corrida" && u.equipe !== "Fila de Espera"); 
  
  filaEspera.sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0)); 
  titulares.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""))); 
  
  const hasGestao = appState.userRole === "admin" || appState.userPermissoes.includes("gestao");
  
  let idxBike = 1, idxCorrida = 1; 
  filaEspera.forEach((u) => { 
    const strikes = u.recusas || 0; 
    const badgeStrike = strikes > 0 ? `<span class="strike-badge">⚠️ ${strikes}/3</span>` : ''; 
    let acoesHTML = ""; 
    
    if(hasGestao) { 
      acoesHTML = `<button class="btn-acao btn-aprovar-fila" data-id="${u.id}" data-eq="${u.equipe === 'Fila - Corrida' ? 'Corrida' : 'Bicicleta'}" style="color:var(--secondary); padding:4px;"><i data-lucide="check" style="width:16px;"></i></button> 
                   <button class="btn-acao btn-pular-fila" data-id="${u.id}" data-strikes="${strikes}" style="color:#f39c12; padding:4px;"><i data-lucide="skip-forward" style="width:16px;"></i></button>`; 
    } 
    if(u.equipe === "Fila - Bicicleta" || u.equipe === "Fila de Espera") { 
      htmlFilaBike += `<tr class="fila-row" draggable="true" data-id="${u.id}" data-equipe-fila="bike"><td data-label="Atleta"><span class="drag-handle">☰</span><strong>${idxBike}º - ${u.nome}</strong> ${badgeStrike}</td><td data-label="Ações" style="text-align: right; vertical-align:middle;"><div style="display:inline-flex; justify-content:flex-end; gap:5px;">${acoesHTML}</div></td></tr>`; 
      idxBike++; contFila++; 
    } 
    if (u.equipe === "Fila - Corrida") { 
      htmlFilaCorrida += `<tr class="fila-row" draggable="true" data-id="${u.id}" data-equipe-fila="corrida"><td data-label="Atleta"><span class="drag-handle">☰</span><strong>${idxCorrida}º - ${u.nome}</strong> ${badgeStrike}</td><td data-label="Ações" style="text-align: right; vertical-align:middle;"><div style="display:inline-flex; justify-content:flex-end; gap:5px;">${acoesHTML}</div></td></tr>`; 
      idxCorrida++; contFila++; 
    } 
  });
  
  titulares.forEach(u => { 
    const pts = Number(u.pontuacaoTotal) || 0; 
    const ativo = u.ativo !== false; 
    
    const n = u.dataNascimento ? new Date(u.dataNascimento+"T00:00:00").toLocaleDateString('pt-BR') : 'N/D';
    const tooltipInfo = `📍 ${u.localidade || 'Local não informado'}\n🎂 Nasc: ${n}\n🗓️ Entrou em: ${u.anoEntrada || 'N/D'}`;

    const switchAtivo = (hasGestao && u.role !== 'admin') ? `<label class="switch" title="Ativar/Desativar"><input type="checkbox" class="toggle-ativo" data-id="${u.id}" ${ativo ? 'checked' : ''}><span class="slider"></span></label>` : ''; 
    const btnFicha = `<button class="btn-acao btn-ficha" data-id="${u.id}" style="color: var(--primary); border-color: var(--primary); padding: 4px; margin-left: 5px;" title="Ver Ficha Completa"><i data-lucide="clipboard-list" style="width: 16px;"></i></button>`; 
    const btnPerm = (u.role === 'comite' && appState.userRole === 'admin') ? `<button class="btn-primario btn-permissoes" data-id="${u.id}" data-nome="${u.nome}" style="background: #f39c12; padding: 6px 10px; font-size: 0.8rem; margin-left: 5px;"><i data-lucide="key" style="width: 14px;"></i></button>` : ''; 
    const btnEditar = hasGestao ? `<button class="btn-acao btn-editar-membro" data-id="${u.id}" style="color: var(--warning); border-color: var(--warning); padding: 4px; margin-left: 5px;"><i data-lucide="edit-2" style="width: 16px;"></i></button>` : ''; 
    const btnExcluir = (auth.currentUser?.uid !== u.id && hasGestao) ? `<button class="btn-acao btn-excluir-membro" data-id="${u.id}" style="color: red; border: 0; padding: 4px; margin-left: 5px;"><i data-lucide="x-circle" style="width: 18px;"></i></button>` : ''; 
    const displayPts = u.role === 'atleta' ? `<br><small style="color: var(--primary);">🏆 ${pts} pts</small>` : ''; 
    
    // A correção definitiva da linha (retiramos o flex direto do <td> e usamos um container <div>)
    const linha = `
      <tr>
        <td data-label="Atleta" class="${!ativo ? 'inativo-txt' : ''}" style="vertical-align:middle; text-align:left;">
          <strong title="${tooltipInfo}" style="cursor:help; border-bottom: 1px dashed var(--primary); padding-bottom: 2px;">${u.nome}</strong>${displayPts}
        </td>
        <td data-label="Ações" style="text-align: right; vertical-align:middle;">
          <div style="display:inline-flex; justify-content:flex-end; align-items:center; gap:5px;">
            ${switchAtivo} ${btnFicha} ${btnPerm} ${btnEditar} ${btnExcluir}
          </div>
        </td>
      </tr>`; 
    
    if (u.role === "admin" || u.role === "comite") { htmlComite += linha; contComite++; } 
    else if (u.equipe === "Corrida") { htmlCorrida += linha; contCorrida++; ptsCorrida += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe, id: u.id, ativo: ativo}); } 
    else if (u.equipe === "Bicicleta" || u.equipe === "Bike") { htmlBike += linha; contBike++; ptsBike += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe, id: u.id, ativo: ativo}); } 
  });
  
  if(document.getElementById("listaFilaBike")) document.getElementById("listaFilaBike").innerHTML = htmlFilaBike || `<tr><td colspan='2'>Ninguém na fila.</td></tr>`; 
  if(document.getElementById("listaFilaCorrida")) document.getElementById("listaFilaCorrida").innerHTML = htmlFilaCorrida || `<tr><td colspan='2'>Ninguém na fila.</td></tr>`; 
  if(document.getElementById("listaBicicleta")) document.getElementById("listaBicicleta").innerHTML = htmlBike || `<tr><td colspan='2'>Equipe vazia.</td></tr>`; 
  if(document.getElementById("listaCorrida")) document.getElementById("listaCorrida").innerHTML = htmlCorrida || `<tr><td colspan='2'>Equipe vazia.</td></tr>`; 
  if(document.getElementById("listaComite")) document.getElementById("listaComite").innerHTML = htmlComite || `<tr><td colspan='2'>Sem membros.</td></tr>`; 
  
  if(document.getElementById("totalBike")) document.getElementById("totalBike").textContent = contBike; 
  if(document.getElementById("totalCorrida")) document.getElementById("totalCorrida").textContent = contCorrida;
  
  renderGraficosETop(ptsBike, ptsCorrida, todosAtletas, contBike, contCorrida); 
  if(typeof lucide !== 'undefined') lucide.createIcons();
  setupDragDropFilas();
  
  document.querySelectorAll(".btn-aprovar-fila").forEach(btn => { 
    btn.addEventListener("click", async (e) => { 
      mostrarConfirmacao("Aprovar Atleta", "Mover o atleta da fila para a equipe principal?", async () => {
        e.currentTarget.disabled = true; 
        try { await updateDoc(doc(db, "atletas", e.currentTarget.dataset.id), { equipe: e.currentTarget.dataset.eq, recusas: 0 }); atualizarTelas(); } 
        catch(err) { showToast("Erro ao aprovar.", "error"); } 
      });
    }); 
  }); 
  
  document.querySelectorAll(".btn-pular-fila").forEach(btn => { 
    btn.addEventListener("click", async (e) => { 
      const id = e.currentTarget.dataset.id; 
      let st = parseInt(e.currentTarget.dataset.strikes); 
      mostrarConfirmacao("Pular Fila", "Passar a vez do atleta? Ele trocará de posição com o próximo.", async () => {
        st++; 
        if(st >= 3) { 
          mostrarConfirmacao("Aviso de 3 Recusas", "O atleta atingiu 3 recusas. Remover da fila e inativar?", async () => {
            await updateDoc(doc(db, "atletas", id), { ativo: false, equipe: "Nenhuma" }); 
            showToast("Removido da fila.", "info"); atualizarTelas(); 
          }, "danger"); return;
        } 
        try { 
          const eqFila = appState.mapAtletas[id].equipe; 
          const filaAtual = Object.values(appState.mapAtletas).filter(a => a.equipe === eqFila && a.ativo !== false).sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0)); 
          const idx = filaAtual.findIndex(a => a.id === id); 
          if (idx >= 0 && idx < filaAtual.length - 1) { 
            const idProximo = filaAtual[idx + 1].id; 
            await updateDoc(doc(db, "atletas", id), { recusas: st, criadoEm: appState.mapAtletas[idProximo].criadoEm }); 
            await updateDoc(doc(db, "atletas", idProximo), { criadoEm: appState.mapAtletas[id].criadoEm }); 
            showToast("Posições trocadas!", "success"); 
          } else { 
            await updateDoc(doc(db, "atletas", id), { recusas: st }); 
            showToast("Último da fila. Apenas recusa registada.", "info"); 
          } 
          atualizarTelas(); 
        } catch(err) { showToast("Erro ao pular fila.", "error"); } 
      });
    }); 
  }); 
  
  document.querySelectorAll(".btn-excluir-membro").forEach(btn => { 
    btn.addEventListener("click", (e) => { 
      mostrarConfirmacao("Excluir Definitivo", "Apagar este membro permanentemente do sistema?", async () => {
        e.currentTarget.disabled = true; 
        try { await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); atualizarTelas(); } 
        catch(err) { showToast("Erro ao apagar.", "error"); } 
      }, "danger");
    }); 
  }); 
  
  document.querySelectorAll(".btn-editar-membro").forEach(btn => { 
    btn.addEventListener("click", (e) => { 
      const b = e.currentTarget; 
      const u = appState.mapAtletas[b.dataset.id];
      document.getElementById("editId").value = u.id; 
      document.getElementById("editNome").value = u.nome; 
      document.getElementById("editEmail").value = u.email !== "undefined" ? (u.email || "") : ""; 
      document.getElementById("editPapel").value = u.role === "comite" ? "Comitê" : u.equipe; 
      document.getElementById("editSexo").value = u.sexo || "Masculino";
      document.getElementById("editNasc").value = u.dataNascimento || "";
      document.getElementById("editLocalidade").value = u.localidade || "";
      document.getElementById("editAnoEntrada").value = u.anoEntrada || "";
      document.getElementById("modalEditarAtleta").style.display = "flex"; 
    }); 
  }); 
  
  document.querySelectorAll(".btn-ficha").forEach(btn => btn.addEventListener("click", (e) => abrirFichaAtleta(e.currentTarget.dataset.id))); 
  
  document.querySelectorAll(".btn-permissoes").forEach(btn => { 
    btn.addEventListener("click", (e) => { 
      const b = e.currentTarget; 
      document.getElementById("permNomeUsuario").textContent = b.dataset.nome; 
      document.getElementById("permUserId").value = b.dataset.id; 
      const permissoesDB = appState.mapAtletas[b.dataset.id].permissoes || ["visao-geral"]; 
      document.querySelectorAll(".chk-perm").forEach(chk => { chk.checked = permissoesDB.includes(chk.value) || (permissoesDB.includes("financeiro") && chk.value.startsWith("financeiro")); }); 
      document.getElementById("modalPermissoes").style.display = "flex"; 
    }); 
  });
}

// =====================================================
// EXTRATOS, HISTÓRICO E RELATÓRIOS
// =====================================================
async function carregarHistorico() { 
  const snap = await getDocs(collection(db, "historico_pontos")); 
  appState.historicoCompleto = []; 
  snap.forEach(d => { appState.historicoCompleto.push({ id: d.id, ...d.data() }); }); 
  appState.historicoCompleto.sort((a, b) => new Date(b.dataTreino || "1970-01-01") - new Date(a.dataTreino || "1970-01-01")); 
  filtrarHistorico(); 
}

function filtrarHistorico() {
  const mes = document.getElementById("filtroMesHistorico")?.value; 
  const eq = document.getElementById("filtroEquipeHistorico")?.value; 
  const nomeBusca = document.getElementById("filtroNomeHistorico")?.value.toLowerCase(); 
  const statusFiltro = document.getElementById("filtroStatusHistorico")?.value;
  
  const dados = appState.historicoCompleto.filter(h => { 
    const atleta = appState.mapAtletas[h.atletaId]; 
    const isAtivo = atleta ? (atleta.ativo !== false) : false; 
    if (statusFiltro === "ativos" && !isAtivo) return false; 
    const nomeFiltro = h.atletaNome || (atleta ? atleta.nome : ""); 
    const eqFiltro = h.atletaEquipe || (atleta ? atleta.equipe : ""); 
    return (!mes || (h.dataTreino||"").startsWith(mes)) && (!eq || eqFiltro === eq) && (!nomeBusca || nomeFiltro.toLowerCase().includes(nomeBusca)); 
  });
  
  const tbody = document.getElementById("listaHistorico"); 
  if(!tbody) return;
  tbody.innerHTML = "";
  
  if (dados.length === 0) { tbody.innerHTML = `<tr><td colspan='6' style='text-align:center;'>Nenhum registo encontrado.</td></tr>`; return; }
  const podeEstornar = appState.userRole === "admin" || appState.userPermissoes.includes("contabilizacao");
  
  dados.forEach(h => {
    const atleta = appState.mapAtletas[h.atletaId]; 
    let nomeDisplay = h.atletaNome || (atleta ? atleta.nome : "Desconhecido"); 
    let eqDisplay = h.atletaEquipe || (atleta ? atleta.equipe : "-");
    
    if (atleta && atleta.ativo === false) nomeDisplay += " <small style='color:var(--danger); font-weight:bold;'>(Inativo)</small>"; 
    else if (!atleta) nomeDisplay += " <small style='color:#999; font-weight:bold;'>(Excluído)</small>"; 
    
    let ptsV = Number(h.pontos) === 0 ? `<span style="color:var(--accent);">Justificada</span>` : `+${h.pontos}`;
    const btnEstorno = podeEstornar ? `<button class="btn-acao btn-estornar" aria-label="Estornar lançamento" data-id="${h.id}" data-atleta="${h.atletaId}" data-pontos="${h.pontos}" style="color:var(--danger); border-color:var(--danger);"><i data-lucide="undo-2" style="width:16px;"></i></button>` : '';
    
    tbody.innerHTML += `
      <tr>
        <td data-label="Data">${(h.dataTreino?new Date(h.dataTreino+"T00:00:00").toLocaleDateString('pt-BR'):"-")}</td>
        <td data-label="Atleta" style="text-align: left;"><strong>${nomeDisplay}</strong></td>
        <td data-label="Eq.">${eqDisplay}</td>
        <td data-label="Motivo">${h.descTreino}<br><small style="color:var(--primary);">${h.regraDesc}</small></td>
        <td data-label="Pts" style="text-align:center; color:var(--secondary); font-weight:bold;">${ptsV}</td>
        <td data-label="Ação" style="text-align:right;">${btnEstorno}</td>
      </tr>`;
  });
  
  if(typeof lucide !== 'undefined') lucide.createIcons();
  
  document.querySelectorAll(".btn-estornar").forEach(btn => { 
    btn.addEventListener("click", (e) => { 
      const histId = e.currentTarget.dataset.id; 
      const atlId = e.currentTarget.dataset.atleta; 
      const pts = parseInt(e.currentTarget.dataset.pontos); 
      mostrarConfirmacao("Estornar Lançamento", "Tem certeza? A pontuação será deduzida do atleta.", async () => {
        try { 
          if (appState.mapAtletas[atlId] && pts > 0) { await updateDoc(doc(db, "atletas", atlId), { pontuacaoTotal: increment(-pts) }); } 
          await deleteDoc(doc(db, "historico_pontos", histId)); 
          showToast("Lançamento estornado!", "success"); atualizarTelas(); 
        } catch (err) { showToast("Erro ao estornar.", "error"); } 
      }, "danger");
    }); 
  });
}

["filtroMesHistorico", "filtroEquipeHistorico", "filtroNomeHistorico", "filtroStatusHistorico"].forEach(id => { 
  document.getElementById(id)?.addEventListener("input", filtrarHistorico); 
});
document.getElementById("btnLimparFiltrosExtrato")?.addEventListener("click", () => { 
  document.getElementById("filtroMesHistorico").value = ""; document.getElementById("filtroEquipeHistorico").value = ""; document.getElementById("filtroNomeHistorico").value = ""; document.getElementById("filtroStatusHistorico").value = "ativos"; filtrarHistorico(); 
});

function setupRelatorioConsolidado() { 
  if(document.getElementById("filtroAnoRelatorio")) document.getElementById("filtroAnoRelatorio").value = new Date().getFullYear(); 
  document.querySelector('[data-target="sub-relatorio"]')?.addEventListener("click", gerarRelatorioConsolidado); 
  document.getElementById("btnGerarRelatorio")?.addEventListener("click", gerarRelatorioConsolidado); 
  
  document.getElementById("chkTodosMeses")?.addEventListener("change", (e) => { document.querySelectorAll(".chk-mes-relatorio").forEach(chk => chk.checked = e.target.checked); });
  document.querySelectorAll(".chk-mes-relatorio").forEach(chk => {
    chk.addEventListener("change", () => {
      const allChecked = document.querySelectorAll(".chk-mes-relatorio:checked").length === 12;
      document.getElementById("chkTodosMeses").checked = allChecked;
    });
  });

  document.getElementById("btnExportarExcel")?.addEventListener("click", () => { 
    const tbody = document.getElementById("listaRelatorio"); 
    if(!tbody || tbody.innerText.includes("Clique em Filtrar") || tbody.innerText.includes("Nenhum atleta")) return showToast("Gere o relatório primeiro!", "error"); 
    const rows = document.getElementById("tabelaConsolidada").querySelectorAll("tr"); 
    let csv = "\uFEFF"; 
    rows.forEach(row => { 
      const cols = row.querySelectorAll("th, td"); 
      const rowData = Array.from(cols).map(c => `"${c.innerText.replace(/"/g, '""')}"`); csv += rowData.join(";") + "\r\n"; 
    }); 
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); 
    const a = document.createElement("a"); a.href = url; a.download = `Relatorio_Consolidado.csv`; a.click(); URL.revokeObjectURL(url); 
  }); 
}

function gerarRelatorioConsolidado() { 
  const ano = String(document.getElementById("filtroAnoRelatorio")?.value).trim(); 
  const eqFiltro = document.getElementById("filtroEquipeRelatorio")?.value; 
  const tbody = document.getElementById("listaRelatorio"); 
  const thead = document.getElementById("headRelatorio");

  if (!tbody || !thead) return;

  const mesesSelecionados = [];
  const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  document.querySelectorAll(".chk-mes-relatorio:checked").forEach(chk => { mesesSelecionados.push(parseInt(chk.value, 10)); });

  if (mesesSelecionados.length === 0) return showToast("Selecione pelo menos um mês para avaliar!", "error");

  let theadHTML = `<tr><th>Atleta</th><th>Eq</th>`;
  mesesSelecionados.forEach(m => { theadHTML += `<th>${nomesMeses[m - 1]}</th>`; });
  theadHTML += `<th style="text-align:center;">Total (${mesesSelecionados.length}m)</th></tr>`;
  thead.innerHTML = theadHTML;
  
  const histAno = appState.historicoCompleto.filter(h => h.dataTreino && h.dataTreino.startsWith(ano)); 
  let atletasRelatorio = Object.values(appState.mapAtletas).filter(a => a.role === "atleta" && !a.equipe.startsWith("Fila") && a.equipe !== "Nenhuma"); 
  if (eqFiltro) atletasRelatorio = atletasRelatorio.filter(a => a.equipe === eqFiltro); 
  
  if(atletasRelatorio.length === 0) { tbody.innerHTML = `<tr><td colspan='${mesesSelecionados.length + 3}' style='text-align:center;'>Nenhum atleta processado.</td></tr>`; return; } 
  
  let html = ""; 
  atletasRelatorio.forEach(atleta => { 
    atleta.totalPeriodo = 0; atleta.ptsMesTemp = {}; mesesSelecionados.forEach(m => atleta.ptsMesTemp[m] = 0);
    histAno.filter(h => h.atletaId === atleta.id).forEach(l => { 
      if(l.dataTreino && l.dataTreino.includes("-")) { 
        const mesInt = parseInt(l.dataTreino.split("-")[1], 10); 
        if(mesesSelecionados.includes(mesInt)) { 
          const pts = Number(l.pontos) || 0; atleta.ptsMesTemp[mesInt] += pts; atleta.totalPeriodo += pts; 
        } 
      } 
    }); 
  }); 
  
  atletasRelatorio.sort((a, b) => b.totalPeriodo - a.totalPeriodo); 
  
  atletasRelatorio.forEach(atleta => { 
    let colunas = ""; 
    mesesSelecionados.forEach(m => { 
      const p = atleta.ptsMesTemp[m]; colunas += `<td data-label="${nomesMeses[m-1]}" style="text-align: center; color: ${p > 0 ? 'var(--secondary)' : '#ccc'}; font-weight: ${p > 0 ? '600' : '400'};">${p}</td>`; 
    }); 
    html += `<tr><td data-label="Atleta" style="text-align:left;"><strong>${atleta.nome}</strong></td><td data-label="Equipa"><small>${atleta.equipe}</small></td>${colunas}<td data-label="Total" style="text-align: center; font-weight: bold; color: var(--primary);">${atleta.totalPeriodo}</td></tr>`; 
  }); 
  
  tbody.innerHTML = html; 
  if(typeof lucide !== 'undefined') lucide.createIcons();
}

// =====================================================
// 📅 AGENDA DE EVENTOS E OUTRAS CONFIGURAÇÕES
// =====================================================
function setupAgenda() { 
  const modal = document.getElementById("modalEvento"); 
  if(!modal) return;
  document.getElementById("abrirModalEvento")?.addEventListener("click", () => modal.style.display = "flex"); 
  document.getElementById("fecharModalEvento")?.addEventListener("click", () => modal.style.display = "none"); 
  document.getElementById("salvarEventoBtn")?.addEventListener("click", async (e) => { 
    const titulo = document.getElementById("eventoTitulo").value.trim(); const local = document.getElementById("eventoLocal").value.trim(); const mod = document.getElementById("eventoModalidade").value; const data = document.getElementById("eventoData").value; const km = Number(document.getElementById("eventoKm")?.value || 0); 
    if (!titulo || !data) return showToast("Título e Data são obrigatórios!", "error"); 
    e.target.textContent = "Salvando..."; e.target.classList.add("loading"); e.target.disabled = true; 
    try { 
      await addDoc(collection(db, "agenda_eventos"), { titulo: titulo, local: local, modalidade: mod, data: data, km: km, criadoEm: new Date().toISOString() }); 
      modal.style.display = "none"; document.getElementById("eventoTitulo").value = ""; document.getElementById("eventoLocal").value = ""; if(document.getElementById("eventoKm")) document.getElementById("eventoKm").value = ""; 
      showToast("Evento agendado!", "success"); atualizarTelas(); 
    } catch (err) { showToast("Erro ao agendar: " + err.message, "error"); } 
    finally { e.target.textContent = "Salvar Evento"; e.target.classList.remove("loading"); e.target.disabled = false; }
  }); 
}

async function carregarAgenda() { 
  try { 
    const snap = await getDocs(query(collection(db, "agenda_eventos"))); 
    appState.cacheEventos = []; snap.forEach(d => appState.cacheEventos.push({id: d.id, ...d.data()})); appState.cacheEventos.sort((a,b) => new Date(a.data) - new Date(b.data)); 
    
    const htmlDropdown = '<option value="">Nenhum (Lançamento Avulso)</option>' + appState.cacheEventos.map(e => `<option value="${e.id}">${e.titulo} (${new Date(e.data+"T00:00:00").toLocaleDateString('pt-BR')})</option>`).join(''); 
    if(document.getElementById("lancarEventoSelect")) document.getElementById("lancarEventoSelect").innerHTML = htmlDropdown; 
    
    const hoje = new Date().toISOString().split('T')[0]; 
    const futuros = appState.cacheEventos.filter(e => e.data >= hoje).slice(0, 4); 
    let html = ""; 
    const hasGestao = appState.userRole === "admin" || appState.userPermissoes.includes("gestao"); 
    
    futuros.forEach(e => { 
      const d = new Date(e.data + "T00:00:00"); const mes = d.toLocaleString('pt-BR', {month: 'short'}).replace('.',''); const dia = d.getDate().toString().padStart(2, '0'); 
      let icon = e.modalidade === "Bicicleta" ? "🚴" : e.modalidade === "Corrida" ? "🏃" : "🤝"; 
      const kmInfo = Number(e.km || 0) > 0 ? ` • ${formatarKm(e.km)} km` : "";
      const btnExcluir = hasGestao ? `<button class="btn-excluir-evento" aria-label="Cancelar evento" data-id="${e.id}" style="background:transparent; border:none; color:var(--danger); cursor:pointer; float:right;"><i data-lucide="x" style="width:16px;"></i></button>` : ''; 
      html += `<div class="agenda-item"><div class="agenda-data"><span>${mes}</span><strong>${dia}</strong></div><div class="agenda-info" style="flex:1;">${btnExcluir}<h4>${e.titulo}</h4><p>${icon} ${e.local || 'Local não informado'}${kmInfo}</p></div></div>`; 
    }); 
    
    if(document.getElementById("listaEventosAgenda")) document.getElementById("listaEventosAgenda").innerHTML = html || `<div class="empty-state" style="padding:10px;"><p style="font-size:0.85rem;">Nenhum evento agendado.</p></div>`; 
    if(typeof lucide !== 'undefined') lucide.createIcons(); 
    
    document.querySelectorAll(".btn-excluir-evento").forEach(btn => { 
      btn.addEventListener("click", (e) => { 
        mostrarConfirmacao("Cancelar Evento", "Remover este evento da agenda?", async () => {
          await deleteDoc(doc(db, "agenda_eventos", e.currentTarget.dataset.id)); atualizarTelas(); 
        }, "danger");
      }); 
    }); 
  } catch (err) { console.error("Erro na agenda:", err); } 
}

function setupPermissoesModal() { 
  const modal = document.getElementById("modalPermissoes"); if(!modal) return; 
  document.getElementById("fecharModalPermissoes")?.addEventListener("click", () => modal.style.display = "none"); 
  document.getElementById("salvarPermissoesBtn")?.addEventListener("click", async (e) => { 
    const id = document.getElementById("permUserId").value; 
    let selecionadas = []; document.querySelectorAll(".chk-perm:checked").forEach(chk => selecionadas.push(chk.value)); 
    if(selecionadas.length === 0) return showToast("Precisa ter pelo menos uma aba marcada.", "error"); 
    
    e.target.textContent = "Salvando..."; e.target.classList.add("loading"); e.target.disabled = true; 
    try { await updateDoc(doc(db, "atletas", id), { permissoes: selecionadas }); showToast("Permissões atualizadas!", "success"); modal.style.display = "none"; atualizarTelas(); } 
    catch(err) { showToast("Erro ao gravar permissões.", "error"); } 
    finally { e.target.textContent = "Salvar Acessos"; e.target.classList.remove("loading"); e.target.disabled = false; }
  }); 
}



// =====================================================
// ↕️ DRAG AND DROP DAS FILAS
// =====================================================
function setupDragDropFilas() {
  let draggedId = null;
  let draggedEquipe = null;

  document.querySelectorAll(".fila-row").forEach(row => {
    if (row.dataset.dragSetup === "1") return;
    row.dataset.dragSetup = "1";

    row.addEventListener("dragstart", (e) => {
      draggedId = row.dataset.id;
      draggedEquipe = row.dataset.equipeFila;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedId || "");
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      document.querySelectorAll(".fila-row.drag-over").forEach(r => r.classList.remove("drag-over"));
      draggedId = null;
      draggedEquipe = null;
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!draggedId || draggedId === row.dataset.id) return;
      if (draggedEquipe !== row.dataset.equipeFila) return;
      row.classList.add("drag-over");
    });

    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));

    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");

      const targetId = row.dataset.id;
      if (!draggedId || !targetId || draggedId === targetId) return;

      const origem = appState.mapAtletas[draggedId];
      const destino = appState.mapAtletas[targetId];

      if (!origem || !destino || origem.equipe !== destino.equipe) {
        showToast("Só é possível reorganizar atletas dentro da mesma fila.", "error");
        return;
      }

      try {
        const origemCriadoEm = origem.criadoEm || new Date().toISOString();
        const destinoCriadoEm = destino.criadoEm || new Date().toISOString();

        await updateDoc(doc(db, "atletas", draggedId), {
          criadoEm: destinoCriadoEm,
          ordemFilaAtualizadaEm: new Date().toISOString(),
          ordemFilaAtualizadaPor: auth.currentUser?.uid || ""
        });

        await updateDoc(doc(db, "atletas", targetId), {
          criadoEm: origemCriadoEm,
          ordemFilaAtualizadaEm: new Date().toISOString(),
          ordemFilaAtualizadaPor: auth.currentUser?.uid || ""
        });

        showToast("Fila reorganizada com sucesso!", "success");
        atualizarTelas();
      } catch (err) {
        showToast("Erro ao reorganizar fila: " + err.message, "error");
      }
    });
  });
}

// =====================================================
// 🧍 CONSULTA DE ATLETAS E BUSCA GLOBAL
// =====================================================
function setupAtletasConsulta() {
  ["filtroAtletaCards", "filtroEquipeAtletaCards", "filtroStatusAtletaCards"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.listenerAplicado) return;
    el.dataset.listenerAplicado = "1";
    el.addEventListener("input", renderAtletasConsulta);
    el.addEventListener("change", renderAtletasConsulta);
  });

  const busca = document.getElementById("buscaGlobalAtleta");
  const resultados = document.getElementById("resultadoBuscaGlobal");

  if (busca && resultados && !busca.dataset.listenerAplicado) {
    busca.dataset.listenerAplicado = "1";

    busca.addEventListener("input", () => {
      renderBuscaGlobalAtletas(busca.value);
    });

    busca.addEventListener("focus", () => {
      if (busca.value.trim()) renderBuscaGlobalAtletas(busca.value);
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".global-search")) resultados.classList.remove("active");
    });
  }
}

function renderAtletasConsulta() {
  const grid = document.getElementById("gridAtletasConsulta");
  if (!grid) return;

  const termo = (document.getElementById("filtroAtletaCards")?.value || "").toLowerCase();
  const equipe = document.getElementById("filtroEquipeAtletaCards")?.value || "";
  const status = document.getElementById("filtroStatusAtletaCards")?.value || "ativos";

  let atletas = Object.values(appState.mapAtletas || {})
    .filter(a => a.role !== "admin" && a.status === "Aprovado")
    .filter(a => {
      const ativo = a.ativo !== false;
      if (status === "ativos" && !ativo) return false;
      if (status === "inativos" && ativo) return false;
      if (equipe && (a.equipe || "Nenhuma") !== equipe) return false;

      const busca = `${a.nome || ""} ${a.equipe || ""} ${a.localidade || ""}`.toLowerCase();
      return !termo || busca.includes(termo);
    });

  atletas.sort((a, b) => {
    const scoreA = Number(a.pontuacaoTotal) || 0;
    const scoreB = Number(b.pontuacaoTotal) || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return String(a.nome || "").localeCompare(String(b.nome || ""));
  });

  atualizarResumoKmAtletas(atletas);

  if (atletas.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i data-lucide="users"></i>
        <p>Nenhum atleta encontrado com os filtros selecionados.</p>
      </div>
    `;
    if(typeof lucide !== "undefined") lucide.createIcons();
    return;
  }

  grid.innerHTML = atletas.map(a => criarCardAtleta(a)).join("");

  grid.querySelectorAll(".athlete-card-premium").forEach(card => {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      abrirFichaAtleta(card.dataset.id);
    });
  });

  if(typeof lucide !== "undefined") lucide.createIcons();
}

function criarCardAtleta(a) {
  const ativo = a.ativo !== false;
  const equipe = a.equipe || "Nenhuma";
  const isFila = equipe.startsWith("Fila");
  const tipoHero = isFila ? "wait" : (equipe === "Corrida" ? "run" : "bike");
  const modalidade = isFila ? "Fila" : (equipe === "Corrida" ? "Corrida" : equipe === "Bicicleta" || equipe === "Bike" ? "Bike" : equipe);
  const hist = (appState.historicoCompleto || []).filter(h => h.atletaId === a.id);
  const eventos = new Set(hist.map(h => h.eventoId || h.loteId || `${h.dataTreino}|${h.descTreino}`)).size;
  const kmTotal = calcularKmAtleta(a.id);
  const ultimo = hist.length > 0 ? hist[0].dataTreino : "";
  const iniciais = getIniciais(a.nome);

  return `
    <article class="athlete-card-premium ${ativo ? "" : "inativo"}" data-id="${escapeAttr(a.id)}">
      <div class="athlete-card-hero ${tipoHero}">
        <div class="athlete-card-status">${ativo ? "Ativo" : "Inativo"}</div>
        <div class="athlete-card-avatar">${iniciais}</div>
      </div>

      <div class="athlete-card-body">
        <div class="athlete-card-title">
          <h3>${escapeHtml(a.nome || "Sem nome")}</h3>
          <span>${modalidade}</span>
        </div>

        <p class="athlete-card-meta">${escapeHtml(a.localidade || "Localidade não informada")} • Entrada ${escapeHtml(a.anoEntrada || "-")}</p>

        <div class="athlete-card-stats">
          <div>
            <strong>${Number(a.pontuacaoTotal) || 0}</strong>
            <span>pontos</span>
          </div>
          <div>
            <strong>${formatarKm(kmTotal)}</strong>
            <span>km</span>
          </div>
          <div>
            <strong>${eventos}</strong>
            <span>eventos</span>
          </div>
          <div>
            <strong>${ultimo ? formatarDataCurta(ultimo) : "-"}</strong>
            <span>último</span>
          </div>
        </div>

        <button type="button" class="athlete-card-button">Ver ficha completa</button>
      </div>
    </article>
  `;
}

function renderBuscaGlobalAtletas(valor) {
  const resultados = document.getElementById("resultadoBuscaGlobal");
  if (!resultados) return;

  const termo = (valor || "").trim().toLowerCase();

  if (!termo) {
    resultados.classList.remove("active");
    resultados.innerHTML = "";
    return;
  }

  const encontrados = Object.values(appState.mapAtletas || {})
    .filter(a => a.status === "Aprovado")
    .filter(a => `${a.nome || ""} ${a.equipe || ""} ${a.localidade || ""}`.toLowerCase().includes(termo))
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")))
    .slice(0, 8);

  if (encontrados.length === 0) {
    resultados.innerHTML = `<div class="empty-state" style="padding:16px;"><p>Nenhum atleta encontrado.</p></div>`;
    resultados.classList.add("active");
    return;
  }

  resultados.innerHTML = encontrados.map(a => `
    <div class="search-result-item" data-id="${escapeAttr(a.id)}">
      <div class="search-result-avatar">${getIniciais(a.nome)}</div>
      <div class="search-result-body">
        <strong>${escapeHtml(a.nome || "Sem nome")}</strong>
        <small>${escapeHtml(a.equipe || "-")} • ${Number(a.pontuacaoTotal) || 0} pts • ${formatarKm(calcularKmAtleta(a.id))} km</small>
      </div>
    </div>
  `).join("");

  resultados.querySelectorAll(".search-result-item").forEach(item => {
    item.addEventListener("click", () => {
      resultados.classList.remove("active");
      const busca = document.getElementById("buscaGlobalAtleta");
      if (busca) busca.value = "";
      abrirFichaAtleta(item.dataset.id);
    });
  });

  resultados.classList.add("active");
}


function calcularKmAtleta(atletaId) {
  const vistos = new Set();
  let total = 0;

  (appState.historicoCompleto || [])
    .filter(h => h.atletaId === atletaId)
    .forEach(h => {
      const km = Number(h.kmPercorrido || h.km || 0);
      if (!km || km <= 0) return;

      const chave = h.loteId || h.eventoId || `${h.dataTreino || ""}|${h.descTreino || ""}`;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      total += km;
    });

  return total;
}

function atualizarResumoKmAtletas(atletas = []) {
  let totalKm = 0;
  let kmBike = 0;
  let kmCorrida = 0;
  let totalParticipacoes = 0;

  atletas.forEach(a => {
    const km = calcularKmAtleta(a.id);
    const hist = (appState.historicoCompleto || []).filter(h => h.atletaId === a.id);
    const eventos = new Set(hist.map(h => h.eventoId || h.loteId || `${h.dataTreino}|${h.descTreino}`)).size;

    totalKm += km;
    totalParticipacoes += eventos;

    if (a.equipe === "Bicicleta" || a.equipe === "Bike") kmBike += km;
    if (a.equipe === "Corrida") kmCorrida += km;
  });

  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setText("totalKmAtletas", `${formatarKm(totalKm)} km`);
  setText("totalKmBike", `${formatarKm(kmBike)} km`);
  setText("totalKmCorrida", `${formatarKm(kmCorrida)} km`);
  setText("totalAtletasConsulta", atletas.length);
  setText("totalEventosConsulta", `${totalParticipacoes} participações`);
}

function formatarKm(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1
  });
}

function getIniciais(nome = "") {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "AT";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function formatarDataCurta(dataStr) {
  if (!dataStr) return "-";
  try {
    return new Date(dataStr + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return dataStr;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function setupFichaAtleta() { 
  document.getElementById("fecharModalFicha")?.addEventListener("click", () => document.getElementById("modalFichaAtleta").style.display = "none"); 

  document.getElementById("btnSalvarComentario")?.addEventListener("click", async () => { 
    const aId = document.getElementById("fichaAtletaId").value; 
    const txt = document.getElementById("novoComentarioFicha").value.trim(); 
    if(!txt) return; 
    const meuNome = appState.mapAtletas[auth.currentUser?.uid] ? appState.mapAtletas[auth.currentUser.uid].nome : "Comitê Gestor"; 
    const btn = document.getElementById("btnSalvarComentario"); 
    btn.disabled = true; 
    btn.textContent = "Salvando..."; 
    try { 
      await addDoc(collection(db, "comentarios_atletas"), { atletaId: aId, texto: txt, autorNome: meuNome, criadoEm: new Date().toISOString() }); 
      document.getElementById("novoComentarioFicha").value = ""; 
      carregarComentarios(aId); 
      showToast("Comentário salvo!", "success"); 
    } catch(e) { showToast("Erro ao guardar comentário.", "error"); } 
    finally { btn.disabled = false; btn.textContent = "Adicionar Comentário"; }
  }); 

  document.getElementById("btnSalvarStatusFicha")?.addEventListener("click", salvarStatusFichaAtleta);
  document.getElementById("btnAdicionarCampoExtra")?.addEventListener("click", salvarCampoExtraFicha);
}

async function abrirFichaAtleta(id) { 
  const a = appState.mapAtletas[id]; 
  if(!a) return; 

  document.getElementById("fichaNome").textContent = a.nome; 
  document.getElementById("fichaEquipe").textContent = a.equipe; 
  document.getElementById("fichaPontos").textContent = a.pontuacaoTotal || 0; 
  if(document.getElementById("fichaKm")) document.getElementById("fichaKm").textContent = `${formatarKm(calcularKmAtleta(id))} km`; 

  const renderCampo = (idEl, val, fallback) => { if(document.getElementById(idEl)) document.getElementById(idEl).textContent = val || fallback; };
  renderCampo("fichaLocalidade", a.localidade, "Não informada"); 
  renderCampo("fichaNasc", a.dataNascimento ? new Date(a.dataNascimento+"T00:00:00").toLocaleDateString('pt-BR') : "Não informada", ""); 
  renderCampo("fichaSexo", a.sexo, "Não informado"); 
  renderCampo("fichaAnoEntrada", a.anoEntrada, "-");

  const statusEl = document.getElementById("fichaStatus"); 
  const ativo = a.ativo !== false;
  if(statusEl) {
    if(ativo) { statusEl.textContent = "Ativo"; statusEl.style.color = "var(--secondary)"; } 
    else { statusEl.textContent = `Inativo`; statusEl.style.color = "var(--danger)"; } 
  }

  const toggleAtivo = document.getElementById("fichaToggleAtivo");
  if(toggleAtivo) toggleAtivo.checked = ativo;
  const motivo = document.getElementById("fichaMotivoStatus");
  if(motivo) motivo.value = a.motivoSaida || a.motivoStatus || "";
  document.getElementById("fichaAtletaId").value = id; 

  renderCamposExtrasFicha(a);

  const hist = appState.historicoCompleto.filter(h => h.atletaId === id); 
  let htmlH = ""; 
  if(hist.length === 0) htmlH = "<p style='color:#999; margin-top: 10px;'>Nenhum registro encontrado.</p>"; 
  hist.forEach(h => { 
    const dataF = new Date(h.dataTreino+"T00:00:00").toLocaleDateString('pt-BR'); 
    const isFalta = Number(h.pontos) === 0; 
    const cor = isFalta ? "var(--accent)" : "var(--secondary)"; 
    const ptsStr = isFalta ? "Falta Justificada" : `+${h.pontos} pts`; 
    const kmInfo = Number(h.kmPercorrido || 0) > 0 ? `<br><small style="color:var(--primary);">${formatarKm(h.kmPercorrido)} km</small>` : "";
    htmlH += `<div style="border-bottom: 1px solid var(--border); padding: 8px 0; display:flex; justify-content:space-between; align-items:center; gap:10px;"><div><strong>${dataF}</strong> - ${escapeHtml(h.descTreino || "-")}<br><small style="color:#666;">${escapeHtml(h.regraDesc || "-")}</small>${kmInfo}</div><div style="color:${cor}; font-weight:bold; text-align:right; white-space:nowrap;">${ptsStr}</div></div>`; 
  }); 
  document.getElementById("fichaHistorico").innerHTML = htmlH; 
  await carregarComentarios(id); 
  document.getElementById("modalFichaAtleta").style.display = "flex"; 
}

function renderCamposExtrasFicha(atleta) {
  const lista = document.getElementById("fichaCamposExtrasLista");
  if(!lista) return;

  const campos = atleta.camposExtras || {};
  const entries = Object.entries(campos).filter(([k]) => k);

  if(entries.length === 0) {
    lista.innerHTML = `<small style="color:var(--text-light);">Nenhum campo adicional cadastrado para este atleta.</small>`;
    return;
  }

  lista.innerHTML = entries.map(([campo, valor]) => `
    <div class="ficha-extra-item">
      <strong>${escapeHtml(campo)}</strong>
      <span>${escapeHtml(valor || "-")}</span>
      <button class="btn-acao btn-remover-campo-extra" data-campo="${escapeAttr(campo)}" style="color:var(--danger); padding:6px;"><i data-lucide="trash-2" style="width:15px;"></i></button>
    </div>
  `).join("");

  lista.querySelectorAll(".btn-remover-campo-extra").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = document.getElementById("fichaAtletaId").value;
      const atual = {...(appState.mapAtletas[id]?.camposExtras || {})};
      delete atual[btn.dataset.campo];
      try {
        await updateDoc(doc(db, "atletas", id), { camposExtras: atual, atualizadoEm: new Date().toISOString() });
        appState.mapAtletas[id].camposExtras = atual;
        renderCamposExtrasFicha(appState.mapAtletas[id]);
        showToast("Campo removido.", "success");
      } catch(err) { showToast("Erro ao remover campo: " + err.message, "error"); }
    });
  });

  if(typeof lucide !== 'undefined') lucide.createIcons();
}

async function salvarCampoExtraFicha() {
  const id = document.getElementById("fichaAtletaId")?.value;
  const campo = document.getElementById("novoCampoExtraNome")?.value.trim();
  const valor = document.getElementById("novoCampoExtraValor")?.value.trim();
  if(!id || !campo) return showToast("Informe o nome do campo adicional.", "error");

  const atual = {...(appState.mapAtletas[id]?.camposExtras || {})};
  atual[campo] = valor || "-";

  try {
    await updateDoc(doc(db, "atletas", id), { camposExtras: atual, atualizadoEm: new Date().toISOString() });
    appState.mapAtletas[id].camposExtras = atual;
    document.getElementById("novoCampoExtraNome").value = "";
    document.getElementById("novoCampoExtraValor").value = "";
    renderCamposExtrasFicha(appState.mapAtletas[id]);
    showToast("Campo adicional salvo.", "success");
  } catch(err) { showToast("Erro ao salvar campo adicional: " + err.message, "error"); }
}

async function salvarStatusFichaAtleta() {
  const id = document.getElementById("fichaAtletaId")?.value;
  const ativo = document.getElementById("fichaToggleAtivo")?.checked;
  const motivo = document.getElementById("fichaMotivoStatus")?.value.trim() || "";
  if(!id) return;

  if(ativo === false && !motivo) {
    return showToast("Informe uma justificativa para desativar o atleta.", "error");
  }

  try {
    await updateDoc(doc(db, "atletas", id), {
      ativo,
      motivoSaida: ativo ? "" : motivo,
      motivoStatus: motivo,
      statusAtualizadoEm: new Date().toISOString(),
      statusAtualizadoPor: auth.currentUser?.uid || ""
    });
    if(appState.mapAtletas[id]) {
      appState.mapAtletas[id].ativo = ativo;
      appState.mapAtletas[id].motivoSaida = ativo ? "" : motivo;
      appState.mapAtletas[id].motivoStatus = motivo;
    }
    showToast("Status atualizado.", "success");
    await abrirFichaAtleta(id);
    atualizarTelas();
  } catch(err) { showToast("Erro ao atualizar status: " + err.message, "error"); }
}


async function carregarComentarios(id) { 
  try { 
    const snap = await getDocs(query(collection(db, "comentarios_atletas"), where("atletaId", "==", id))); 
    let coments = []; snap.forEach(d => coments.push(d.data())); coments.sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm)); 
    let html = ""; 
    coments.forEach(c => { 
      const d = new Date(c.criadoEm).toLocaleDateString('pt-BR') + " às " + new Date(c.criadoEm).toLocaleTimeString('pt-BR').substring(0,5); 
      html += `<div class="comentario-box"><div class="comentario-header"><span class="comentario-autor">${c.autorNome}</span> <span>${d}</span></div><div style="margin-top: 4px;">${c.texto}</div></div>`; 
    }); 
    document.getElementById("fichaComentariosLista").innerHTML = html || "<p style='color:#999; font-size:0.85rem;'>Nenhum comentário registado.</p>"; 
  } catch(e) { document.getElementById("fichaComentariosLista").innerHTML = "<p style='color:red; font-size:0.85rem;'>Sem permissão para ler.</p>"; } 
}

async function setupAprovacoes() { 
  const tbody = document.getElementById("listaAprovacoes"); if (!tbody) return; 
  const snap = await getDocs(query(collection(db, "atletas"), where("status", "==", "Pendente"))); 
  tbody.innerHTML = ""; 
  if (snap.empty) { tbody.innerHTML = "<tr><td colspan='4'>Nenhuma pendência.</td></tr>"; return; } 
  snap.forEach(d => { 
    const u = d.data(); 
    tbody.innerHTML += `<tr><td data-label="Nome"><strong>${u.nome}</strong></td><td data-label="E-mail">${u.email}</td><td data-label="Ação"><button class="btn-acao btn-aprovar" data-id="${d.id}" style="color:var(--secondary); border-color:var(--secondary); margin-right:5px;">Aprovar</button><button class="btn-acao btn-rejeitar" data-id="${d.id}" style="color:var(--danger); border-color:var(--danger);">Rejeitar</button></td></tr>`; 
  }); 
  
  document.querySelectorAll(".btn-aprovar").forEach(btn => btn.addEventListener("click", async (e) => { 
    mostrarConfirmacao("Aprovar Acesso", "Confirmar o acesso administrativo deste membro?", async () => {
      e.currentTarget.disabled = true; await updateDoc(doc(db, "atletas", e.currentTarget.dataset.id), { status: "Aprovado" }); atualizarTelas(); 
    });
  })); 
  document.querySelectorAll(".btn-rejeitar").forEach(btn => btn.addEventListener("click", async (e) => { 
    mostrarConfirmacao("Rejeitar Pedido", "Negar e excluir o pedido de acesso?", async () => {
      e.currentTarget.disabled = true; await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); atualizarTelas(); 
    }, "danger");
  })); 
}

function setupModalEditar() { 
  const modal = document.getElementById("modalEditarAtleta"); 
  document.getElementById("fecharModalEdit")?.addEventListener("click", () => modal.style.display = "none"); 
  document.getElementById("salvarEditBtn")?.addEventListener("click", async (e) => { 
    const id = document.getElementById("editId").value; const nome = document.getElementById("editNome").value.trim(); const email = document.getElementById("editEmail").value.trim(); const papel = document.getElementById("editPapel").value; 
    const sexo = document.getElementById("editSexo").value; const nasc = document.getElementById("editNasc").value; const localidade = document.getElementById("editLocalidade").value.trim(); const anoEntrada = document.getElementById("editAnoEntrada").value;
    
    if (!nome) return; let role = "atleta"; let equipe = papel; if (papel === "Comitê") { role = "comite"; equipe = "Nenhuma"; } 
    e.target.textContent = "Salvando..."; e.target.classList.add("loading"); e.target.disabled = true; 
    
    try { 
      await updateDoc(doc(db, "atletas", id), { nome, email, role, equipe, sexo, dataNascimento: nasc, localidade, anoEntrada }); 
      showToast("Ficha atualizada com sucesso!", "success"); modal.style.display = "none"; atualizarTelas(); document.getElementById("modalFichaAtleta").style.display = "none";
    } catch (err) { showToast("Erro ao editar dados.", "error"); } 
    finally { e.target.textContent = "Salvar Alterações"; e.target.classList.remove("loading"); e.target.disabled = false; }
  }); 
}

// =====================================================
// ⚙️ GESTÃO DE REGRAS DE PONTUAÇÃO
// =====================================================
function setupModalRegras() {
  const modal = document.getElementById("modalRegra");
  if (!modal) return;

  document.getElementById("abrirModalRegra")?.addEventListener("click", () => {
    document.getElementById("regraEditId").value = "";
    document.getElementById("regraDescricao").value = "";
    document.getElementById("regraModalidade").value = "Ambas";
    document.getElementById("regraPontos").value = "";
    document.querySelectorAll(".chk-tipo-regra").forEach(chk => chk.checked = true);
    renderizarVinculosRegras([]);
    modal.style.display = "flex";
  });

  document.getElementById("fecharModalRegra")?.addEventListener("click", () => modal.style.display = "none");

  document.getElementById("salvarRegraBtn")?.addEventListener("click", async (e) => {
    const id = document.getElementById("regraEditId").value;
    const desc = document.getElementById("regraDescricao").value.trim();
    const mod = document.getElementById("regraModalidade").value;
    const pts = Number(document.getElementById("regraPontos").value);

    if (!desc || isNaN(pts)) return showToast("Preencha a descrição e defina os pontos!", "error");

    const vinculadas = [];
    document.querySelectorAll(".chk-vinculo-regra:checked").forEach(chk => vinculadas.push(chk.value));

    const tiposLancamento = [];
    document.querySelectorAll(".chk-tipo-regra:checked").forEach(chk => tiposLancamento.push(chk.value));
    if (tiposLancamento.length === 0) return showToast("Selecione pelo menos um tipo de lançamento para a regra.", "error");

    e.target.disabled = true;
    e.target.textContent = "Salvando...";
    e.target.classList.add("loading");

    try {
      const dados = {
        descricao: desc,
        modalidade: mod,
        pontos: pts,
        regrasVinculadas: vinculadas,
        tiposLancamento,
        atualizadoEm: new Date().toISOString()
      };

      if (id) {
        await updateDoc(doc(db, "regras_pontuacao", id), dados);
        showToast("Regra atualizada com sucesso!", "success");
      } else {
        dados.criadoEm = new Date().toISOString();
        await addDoc(collection(db, "regras_pontuacao"), dados);
        showToast("Nova regra criada!", "success");
      }

      modal.style.display = "none";
      await carregarRegras();
    } catch (err) {
      showToast("Erro ao salvar regra: " + err.message, "error");
    } finally {
      e.target.disabled = false;
      e.target.textContent = "Salvar Regra";
      e.target.classList.remove("loading");
    }
  });
}

async function carregarRegras() {
  try {
    const snap = await getDocs(query(collection(db, "regras_pontuacao")));
    appState.listaTodasRegras = [];
    snap.forEach(d => appState.listaTodasRegras.push({ id: d.id, ...d.data() }));

    const tbody = document.getElementById("listaRegras");
    if (!tbody) return;

    let html = "";

    if (appState.listaTodasRegras.length === 0) {
      html = "<tr><td colspan='5' style='text-align:center;'>Nenhuma regra cadastrada.</td></tr>";
    } else {
      appState.listaTodasRegras.forEach(r => {
        const tipos = Array.isArray(r.tiposLancamento) && r.tiposLancamento.length ? r.tiposLancamento : ["treino", "evento", "avulso"];
        const tiposTxt = tipos.map(t => ({treino:"Treino", evento:"Evento", avulso:"Avulso"}[t] || t)).join(", ");
        html += `
          <tr>
            <td data-label="Regra"><strong>${escapeHtml(r.descricao)}</strong></td>
            <td data-label="Modalidade">${escapeHtml(r.modalidade || "-")}</td>
            <td data-label="Tipos"><small>${escapeHtml(tiposTxt)}</small></td>
            <td data-label="Pontos" style="color:var(--primary); font-weight:bold;">+${Number(r.pontos) || 0}</td>
            <td data-label="Ações" style="text-align:right;">
              <button class="btn-acao btn-edit-regra" aria-label="Editar Regra" data-id="${r.id}" style="color:var(--primary); padding:6px; margin-right:5px;"><i data-lucide="edit-2" style="width:16px;"></i></button>
              <button class="btn-acao btn-del-regra" aria-label="Excluir Regra" data-id="${r.id}" style="color:var(--danger); padding:6px;"><i data-lucide="trash" style="width:16px;"></i></button>
            </td>
          </tr>`;
      });
    }

    tbody.innerHTML = html;
    if(typeof lucide !== 'undefined') lucide.createIcons();

    document.querySelectorAll(".btn-del-regra").forEach(btn => {
      btn.addEventListener("click", (e) => {
        mostrarConfirmacao("Apagar Regra", "Deseja realmente excluir esta regra? Isso pode afetar lançamentos futuros.", async () => {
          await deleteDoc(doc(db, "regras_pontuacao", e.currentTarget.dataset.id));
          await carregarRegras();
          showToast("Regra removida", "info");
        }, "danger");
      });
    });

    document.querySelectorAll(".btn-edit-regra").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const r = appState.listaTodasRegras.find(x => x.id === e.currentTarget.dataset.id);
        if(!r) return;

        document.getElementById("regraEditId").value = r.id;
        document.getElementById("regraDescricao").value = r.descricao || "";
        document.getElementById("regraModalidade").value = r.modalidade || "Ambas";
        document.getElementById("regraPontos").value = r.pontos || 0;

        const tipos = Array.isArray(r.tiposLancamento) && r.tiposLancamento.length ? r.tiposLancamento : ["treino", "evento", "avulso"];
        document.querySelectorAll(".chk-tipo-regra").forEach(chk => chk.checked = tipos.includes(chk.value));

        renderizarVinculosRegras(r.regrasVinculadas || [], r.id);
        document.getElementById("modalRegra").style.display = "flex";
      });
    });
  } catch (err) {
    console.error("Erro ao carregar regras:", err);
  }
}

function renderizarVinculosRegras(selecionadas = [], idIgnorado = null) {
  const div = document.getElementById("listaVinculosRegras");
  if (!div) return;

  let html = "";
  (appState.listaTodasRegras || []).forEach(r => {
    if (r.id === idIgnorado) return;
    const checked = selecionadas.includes(r.id) ? "checked" : "";
    html += `<label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; cursor:pointer;"><input type="checkbox" class="chk-vinculo-regra" value="${r.id}" ${checked}> <span style="color:var(--text);">${escapeHtml(r.descricao || "-")}</span></label>`;
  });

  div.innerHTML = html || "<small style='color:var(--text-light);'>Nenhuma outra regra cadastrada ainda.</small>";
}
