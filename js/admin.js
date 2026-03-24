// =====================================================
// js/admin.js - ORQUESTRADOR PRINCIPAL
// =====================================================
import { 
  auth, db, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, 
  onAuthStateChanged, signOut, query, where, writeBatch, increment 
} from "./firebase.js";

// Importação dos Módulos
import { appState } from "./modules/state.js";
import { showToast, mostrarConfirmacao, setupSubTabs, setupConfiguracoesGerais } from "./modules/ui.js";
import { setupDashboard, renderGraficosETop } from "./modules/dashboard.js";
import { setupFinanceiroPlanilha, carregarFinanceiroPlanilha } from "./modules/financeiro.js";
import { setupContabilizacao, setAtualizarTelasCallback } from "./modules/pontuacao.js";
import { setupCadastrarPessoa, setupToggleAtivos, setupLimparBase, setAtualizarTelasGestao } from "./modules/gestao.js";

// =====================================================
// 🔒 INICIALIZAÇÃO E PERMISSÕES
// =====================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const docSnap = await getDoc(doc(db, "atletas", user.uid));
      if (docSnap.exists() && (docSnap.data().role === "admin" || docSnap.data().role === "comite")) {
        appState.userRole = docSnap.data().role;
        appState.userPermissoes = appState.userRole === "admin" ? 
          ["visao-geral", "contabilizacao", "financeiro_view", "financeiro_edit", "gestao", "configuracoes"] : 
          (docSnap.data().permissoes || ["visao-geral", "configuracoes"]);
        
        construirMenu(); 
        iniciarPainelAdmin();
      } else { 
        window.location.href = "index.html"; 
      }
    } catch (err) { 
      showToast("Erro ao validar permissões: " + err.message, "error"); 
    }
  } else { 
    window.location.href = "index.html"; 
  }
});

function construirMenu() {
  const menu = document.getElementById("menuNavegacao"); 
  menu.innerHTML = "";
  
  const itensDisponiveis = [
    { id: "visao-geral", icon: "layout-dashboard", text: "Estratégico" },
    { id: "contabilizacao", icon: "calculator", text: "Lançamentos" },
    { id: "financeiro", icon: "dollar-sign", text: "Financeiro", permCheck: ["financeiro_view", "financeiro_edit"] },
    { id: "gestao", icon: "users", text: "Gestão Base" },
    { id: "configuracoes", icon: "settings", text: "Ajustes" }
  ];

  let abaAtiva = false;
  itensDisponiveis.forEach(item => {
    let hasAccess = false;
    if (item.permCheck) { 
      hasAccess = item.permCheck.some(p => appState.userPermissoes.includes(p)); 
    } else { 
      hasAccess = appState.userPermissoes.includes(item.id); 
    }

    if (hasAccess || appState.userRole === "admin") {
      const isFirst = !abaAtiva; 
      if(isFirst) abaAtiva = true;
      menu.innerHTML += `<div class="menu-item ${isFirst ? 'active' : ''}" data-section="${item.id}"><i data-lucide="${item.icon}"></i><span>${item.text}</span></div>`;
    }
  });
  
  document.querySelectorAll("main section").forEach(sec => {
    sec.classList.remove("active-section");
    const activeMenu = document.querySelector('.menu-item.active');
    if (activeMenu && sec.id === activeMenu.dataset.section) {
      sec.classList.add("active-section"); 
    }
  });

  const badge = document.getElementById("userGroupBadge"); 
  if(badge) {
    badge.style.display = "inline-block";
    if (appState.userRole === "admin") { 
      badge.textContent = "Admin"; 
      badge.style.background = "var(--danger)"; 
    } else { 
      badge.textContent = "Comitê"; 
      badge.style.background = "var(--primary)"; 
    }
  }

  if (appState.userRole !== "admin") { 
    document.querySelectorAll(".admin-only-element").forEach(el => el.style.display = "none"); 
  }
  
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
  // Inicializa Módulos UI
  setupSubTabs(); 
  setupConfiguracoesGerais();
  
  // Inicializa Módulos de Funcionalidades
  setupDashboard();
  setupFinanceiroPlanilha();
  setupContabilizacao();
  setupCadastrarPessoa();
  setupToggleAtivos();
  setupLimparBase();

  // Liga os callbacks de atualização para que os módulos possam pedir "refresh" à tela
  setAtualizarTelasCallback(atualizarTelas);
  setAtualizarTelasGestao(atualizarTelas);

  // Inicializa Funcionalidades Locais (Controller)
  setupRelatorioConsolidado(); 
  setupPermissoesModal(); 
  setupAgenda(); 
  setupModalRegras(); 
  setupModalEditar(); 
  setupFichaAtleta();
  
  // Arranque dos Dados
  atualizarTelas();
}

async function atualizarTelas() {
  if (appState.userRole === "admin" || appState.userPermissoes.includes("gestao")) {
    setupAprovacoes();
  }
  
  await carregarAgenda(); 
  
  const snapA = await getDocs(query(collection(db, "atletas"), where("status", "==", "Aprovado")));
  appState.mapAtletas = {}; 
  snapA.forEach(d => { 
    appState.mapAtletas[d.id] = { id: d.id, ...d.data() }; 
  });
  
  await carregarHistorico(); 
  await carregarFinanceiroPlanilha(); 
  await carregarEquipesEDashboard(); 
  await carregarRegras();

  const modTreinoSelect = document.getElementById("modTreino");
  if (modTreinoSelect && modTreinoSelect.value) {
      modTreinoSelect.dispatchEvent(new Event('change'));
  }
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
      htmlFilaBike += `<tr><td data-label="Atleta"><strong>${idxBike}º - ${u.nome}</strong> ${badgeStrike}</td><td data-label="Ações" style="text-align: right; display:flex; justify-content:flex-end; gap:5px;">${acoesHTML}</td></tr>`; 
      idxBike++; contFila++; 
    } 
    
    if (u.equipe === "Fila - Corrida") { 
      htmlFilaCorrida += `<tr><td data-label="Atleta"><strong>${idxCorrida}º - ${u.nome}</strong> ${badgeStrike}</td><td data-label="Ações" style="text-align: right; display:flex; justify-content:flex-end; gap:5px;">${acoesHTML}</td></tr>`; 
      idxCorrida++; contFila++; 
    } 
  });
  
  titulares.forEach(u => { 
    const pts = Number(u.pontuacaoTotal) || 0; 
    const ativo = u.ativo !== false; 
    const switchAtivo = (hasGestao && u.role !== 'admin') ? `<label class="switch" title="Ativar/Desativar"><input type="checkbox" class="toggle-ativo" data-id="${u.id}" ${ativo ? 'checked' : ''}><span class="slider"></span></label>` : ''; 
    const btnFicha = `<button class="btn-acao btn-ficha" data-id="${u.id}" style="color: var(--primary); border-color: var(--primary); padding: 4px; margin-left: 5px;" title="Ver Ficha Completa"><i data-lucide="clipboard-list" style="width: 16px;"></i></button>`; 
    const btnPerm = (u.role === 'comite' && appState.userRole === 'admin') ? `<button class="btn-primario btn-permissoes" data-id="${u.id}" data-nome="${u.nome}" style="background: #f39c12; padding: 6px 10px; font-size: 0.8rem; margin-left: 5px;"><i data-lucide="key" style="width: 14px;"></i></button>` : ''; 
    const btnEditar = hasGestao ? `<button class="btn-acao btn-editar-membro" data-id="${u.id}" data-nome="${u.nome}" data-email="${u.email}" data-eq="${u.equipe}" style="color: var(--warning); border-color: var(--warning); padding: 4px; margin-left: 5px;"><i data-lucide="edit-2" style="width: 16px;"></i></button>` : ''; 
    const btnExcluir = (auth.currentUser?.uid !== u.id && hasGestao) ? `<button class="btn-acao btn-excluir-membro" data-id="${u.id}" style="color: red; border: 0; padding: 4px; margin-left: 5px;"><i data-lucide="x-circle" style="width: 18px;"></i></button>` : ''; 
    const displayPts = u.role === 'atleta' ? `<br><small style="color: var(--primary);">🏆 ${pts} pts</small>` : ''; 
    
    const linha = `<tr><td data-label="Atleta" class="${!ativo ? 'inativo-txt' : ''}" style="vertical-align:middle; text-align:left;"><strong>${u.nome}</strong>${displayPts}</td><td data-label="Ações" style="text-align: right; display:flex; justify-content:flex-end; align-items:center; min-height: 40px;">${switchAtivo} ${btnFicha} ${btnPerm} ${btnEditar} ${btnExcluir}</td></tr>`; 
    
    if (u.role === "admin" || u.role === "comite") { 
      htmlComite += linha; contComite++; 
    } else if (u.equipe === "Corrida") { 
      htmlCorrida += linha; contCorrida++; ptsCorrida += pts; 
      todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe, id: u.id, ativo: ativo}); 
    } else if (u.equipe === "Bicicleta" || u.equipe === "Bike") { 
      htmlBike += linha; contBike++; ptsBike += pts; 
      todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe, id: u.id, ativo: ativo}); 
    } 
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
  
  // Event Listeners das Ações da Tabela
  document.querySelectorAll(".btn-aprovar-fila").forEach(btn => { 
    btn.addEventListener("click", async (e) => { 
      mostrarConfirmacao("Aprovar Atleta", "Mover o atleta da fila para a equipe principal?", async () => {
        e.currentTarget.disabled = true; 
        try { 
          await updateDoc(doc(db, "atletas", e.currentTarget.dataset.id), { equipe: e.currentTarget.dataset.eq, recusas: 0 }); 
          atualizarTelas(); 
        } catch(err) { showToast("Erro ao aprovar.", "error"); } 
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
          }, "danger");
          return;
        } 
        try { 
          const eqFila = appState.mapAtletas[id].equipe; 
          const filaAtual = Object.values(appState.mapAtletas).filter(a => a.equipe === eqFila && a.ativo !== false).sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0)); 
          const idx = filaAtual.findIndex(a => a.id === id); 
          if (idx >= 0 && idx < filaAtual.length - 1) { 
            const idProximo = filaAtual[idx + 1].id; 
            const dataAtual = appState.mapAtletas[id].criadoEm; 
            const dataProximo = appState.mapAtletas[idProximo].criadoEm; 
            await updateDoc(doc(db, "atletas", id), { recusas: st, criadoEm: dataProximo }); 
            await updateDoc(doc(db, "atletas", idProximo), { criadoEm: dataAtual }); 
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
        try { 
          await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); 
          atualizarTelas(); 
        } catch(err) { showToast("Erro ao apagar.", "error"); } 
      }, "danger");
    }); 
  }); 
  
  document.querySelectorAll(".btn-editar-membro").forEach(btn => { 
    btn.addEventListener("click", (e) => { 
      const b = e.currentTarget; 
      document.getElementById("editId").value = b.dataset.id; 
      document.getElementById("editNome").value = b.dataset.nome; 
      document.getElementById("editEmail").value = b.dataset.email !== "undefined" ? b.dataset.email : ""; 
      document.getElementById("editPapel").value = b.dataset.eq; 
      document.getElementById("modalEditarAtleta").style.display = "flex"; 
    }); 
  }); 
  
  document.querySelectorAll(".btn-ficha").forEach(btn => { 
    btn.addEventListener("click", (e) => abrirFichaAtleta(e.currentTarget.dataset.id)); 
  }); 
  
  document.querySelectorAll(".btn-permissoes").forEach(btn => { 
    btn.addEventListener("click", (e) => { 
      const b = e.currentTarget; 
      document.getElementById("permNomeUsuario").textContent = b.dataset.nome; 
      document.getElementById("permUserId").value = b.dataset.id; 
      const permissoesDB = appState.mapAtletas[b.dataset.id].permissoes || ["visao-geral"]; 
      document.querySelectorAll(".chk-perm").forEach(chk => { 
        chk.checked = permissoesDB.includes(chk.value) || (permissoesDB.includes("financeiro") && chk.value.startsWith("financeiro")); 
      }); 
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
    
    return (!mes || (h.dataTreino||"").startsWith(mes)) && 
           (!eq || eqFiltro === eq) && 
           (!nomeBusca || nomeFiltro.toLowerCase().includes(nomeBusca)); 
  });
  
  const tbody = document.getElementById("listaHistorico"); 
  if(!tbody) return;
  tbody.innerHTML = "";
  
  if (dados.length === 0) { 
    tbody.innerHTML = `<tr><td colspan='6' style='text-align:center;'>Nenhum registo encontrado.</td></tr>`; 
    return; 
  }
  
  const podeEstornar = appState.userRole === "admin" || appState.userPermissoes.includes("contabilizacao");
  
  dados.forEach(h => {
    const atleta = appState.mapAtletas[h.atletaId]; 
    let nomeDisplay = h.atletaNome || (atleta ? atleta.nome : "Desconhecido"); 
    let eqDisplay = h.atletaEquipe || (atleta ? atleta.equipe : "-");
    
    if (atleta && atleta.ativo === false) { 
      nomeDisplay += " <small style='color:var(--danger); font-weight:bold;'>(Inativo)</small>"; 
    } else if (!atleta) { 
      nomeDisplay += " <small style='color:#999; font-weight:bold;'>(Excluído)</small>"; 
    }
    
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
          if (appState.mapAtletas[atlId] && pts > 0) { 
            await updateDoc(doc(db, "atletas", atlId), { pontuacaoTotal: increment(-pts) }); 
          } 
          await deleteDoc(doc(db, "historico_pontos", histId)); 
          showToast("Lançamento estornado!", "success"); 
          atualizarTelas(); 
        } catch (err) { showToast("Erro ao estornar.", "error"); } 
      }, "danger");
    }); 
  });
}

["filtroMesHistorico", "filtroEquipeHistorico", "filtroNomeHistorico", "filtroStatusHistorico"].forEach(id => { 
  document.getElementById(id)?.addEventListener("input", filtrarHistorico); 
});

document.getElementById("btnLimparFiltrosExtrato")?.addEventListener("click", () => { 
  document.getElementById("filtroMesHistorico").value = ""; 
  document.getElementById("filtroEquipeHistorico").value = ""; 
  document.getElementById("filtroNomeHistorico").value = ""; 
  document.getElementById("filtroStatusHistorico").value = "ativos"; 
  filtrarHistorico(); 
});

function setupRelatorioConsolidado() { 
  if(document.getElementById("filtroAnoRelatorio")) document.getElementById("filtroAnoRelatorio").value = new Date().getFullYear(); 
  document.querySelector('[data-target="sub-relatorio"]')?.addEventListener("click", gerarRelatorioConsolidado); 
  document.getElementById("btnGerarRelatorio")?.addEventListener("click", gerarRelatorioConsolidado); 
  
  document.getElementById("chkTodosMeses")?.addEventListener("change", (e) => {
    document.querySelectorAll(".chk-mes-relatorio").forEach(chk => chk.checked = e.target.checked);
  });

  document.querySelectorAll(".chk-mes-relatorio").forEach(chk => {
    chk.addEventListener("change", () => {
      const allChecked = document.querySelectorAll(".chk-mes-relatorio:checked").length === 12;
      document.getElementById("chkTodosMeses").checked = allChecked;
    });
  });

  document.getElementById("btnExportarExcel")?.addEventListener("click", () => { 
    const tbody = document.getElementById("listaRelatorio"); 
    if(!tbody || tbody.innerText.includes("Clique em Filtrar") || tbody.innerText.includes("Nenhum atleta")) {
      return showToast("Gere o relatório primeiro!", "error"); 
    }
    const rows = document.getElementById("tabelaConsolidada").querySelectorAll("tr"); 
    let csv = "\uFEFF"; 
    rows.forEach(row => { 
      const cols = row.querySelectorAll("th, td"); 
      const rowData = Array.from(cols).map(c => `"${c.innerText.replace(/"/g, '""')}"`); 
      csv += rowData.join(";") + "\r\n"; 
    }); 
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement("a"); 
    a.href = url; a.download = `Relatorio_Consolidado.csv`; 
    a.click(); URL.revokeObjectURL(url); 
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
  
  document.querySelectorAll(".chk-mes-relatorio:checked").forEach(chk => {
    mesesSelecionados.push(parseInt(chk.value, 10));
  });

  if (mesesSelecionados.length === 0) return showToast("Selecione pelo menos um mês para avaliar!", "error");

  let theadHTML = `<tr><th>Atleta</th><th>Eq</th>`;
  mesesSelecionados.forEach(m => { theadHTML += `<th>${nomesMeses[m - 1]}</th>`; });
  theadHTML += `<th style="text-align:center;">Total (${mesesSelecionados.length}m)</th></tr>`;
  thead.innerHTML = theadHTML;
  
  const histAno = appState.historicoCompleto.filter(h => h.dataTreino && h.dataTreino.startsWith(ano)); 
  let atletasRelatorio = Object.values(appState.mapAtletas).filter(a => a.role === "atleta" && !a.equipe.startsWith("Fila") && a.equipe !== "Nenhuma"); 
  
  if (eqFiltro) atletasRelatorio = atletasRelatorio.filter(a => a.equipe === eqFiltro); 
  
  if(atletasRelatorio.length === 0) { 
    tbody.innerHTML = `<tr><td colspan='${mesesSelecionados.length + 3}' style='text-align:center;'>Nenhum atleta processado.</td></tr>`; 
    return; 
  } 
  
  let html = ""; 
  atletasRelatorio.forEach(atleta => { 
    atleta.totalPeriodo = 0; 
    atleta.ptsMesTemp = {}; 
    mesesSelecionados.forEach(m => atleta.ptsMesTemp[m] = 0);
    
    histAno.filter(h => h.atletaId === atleta.id).forEach(l => { 
      if(l.dataTreino && l.dataTreino.includes("-")) { 
        const mesInt = parseInt(l.dataTreino.split("-")[1], 10); 
        if(mesesSelecionados.includes(mesInt)) { 
          const pts = Number(l.pontos) || 0; 
          atleta.ptsMesTemp[mesInt] += pts; 
          atleta.totalPeriodo += pts; 
        } 
      } 
    }); 
  }); 
  
  atletasRelatorio.sort((a, b) => b.totalPeriodo - a.totalPeriodo); 
  
  atletasRelatorio.forEach(atleta => { 
    let colunas = ""; 
    mesesSelecionados.forEach(m => { 
      const p = atleta.ptsMesTemp[m];
      colunas += `<td data-label="${nomesMeses[m-1]}" style="text-align: center; color: ${p > 0 ? 'var(--secondary)' : '#ccc'}; font-weight: ${p > 0 ? '600' : '400'};">${p}</td>`; 
    }); 
    
    html += `<tr>
               <td data-label="Atleta" style="text-align:left;"><strong>${atleta.nome}</strong></td>
               <td data-label="Equipa"><small>${atleta.equipe}</small></td>
               ${colunas}
               <td data-label="Total" style="text-align: center; font-weight: bold; color: var(--primary);">${atleta.totalPeriodo}</td>
             </tr>`; 
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
    const titulo = document.getElementById("eventoTitulo").value.trim();
    const local = document.getElementById("eventoLocal").value.trim();
    const mod = document.getElementById("eventoModalidade").value;
    const data = document.getElementById("eventoData").value; 
    
    if (!titulo || !data) return showToast("Título e Data são obrigatórios!", "error"); 
    
    e.target.textContent = "Salvando..."; e.target.classList.add("loading");
    e.target.disabled = true; 
    
    try { 
      await addDoc(collection(db, "agenda_eventos"), { 
        titulo: titulo, local: local, modalidade: mod, data: data, 
        criadoEm: new Date().toISOString() 
      }); 
      
      modal.style.display = "none"; 
      document.getElementById("eventoTitulo").value = ""; 
      document.getElementById("eventoLocal").value = ""; 
      
      showToast("Evento agendado!", "success"); 
      atualizarTelas(); 
    } catch (err) { showToast("Erro ao agendar: " + err.message, "error"); } 
    finally {
      e.target.textContent = "Salvar Evento"; e.target.classList.remove("loading");
      e.target.disabled = false; 
    }
  }); 
}

async function carregarAgenda() { 
  try { 
    const snap = await getDocs(query(collection(db, "agenda_eventos"))); 
    appState.cacheEventos = []; 
    snap.forEach(d => appState.cacheEventos.push({id: d.id, ...d.data()})); 
    appState.cacheEventos.sort((a,b) => new Date(a.data) - new Date(b.data)); 
    
    const htmlDropdown = '<option value="">Nenhum (Lançamento Avulso)</option>' + appState.cacheEventos.map(e => `<option value="${e.id}">${e.titulo} (${new Date(e.data+"T00:00:00").toLocaleDateString('pt-BR')})</option>`).join(''); 
    if(document.getElementById("lancarEventoSelect")) document.getElementById("lancarEventoSelect").innerHTML = htmlDropdown; 
    
    const hoje = new Date().toISOString().split('T')[0]; 
    const futuros = appState.cacheEventos.filter(e => e.data >= hoje).slice(0, 4); 
    let html = ""; 
    const hasGestao = appState.userRole === "admin" || appState.userPermissoes.includes("gestao"); 
    
    futuros.forEach(e => { 
      const d = new Date(e.data + "T00:00:00"); 
      const mes = d.toLocaleString('pt-BR', {month: 'short'}).replace('.',''); 
      const dia = d.getDate().toString().padStart(2, '0'); 
      let icon = e.modalidade === "Bicicleta" ? "🚴" : e.modalidade === "Corrida" ? "🏃" : "🤝"; 
      const btnExcluir = hasGestao ? `<button class="btn-excluir-evento" aria-label="Cancelar evento" data-id="${e.id}" style="background:transparent; border:none; color:var(--danger); cursor:pointer; float:right;"><i data-lucide="x" style="width:16px;"></i></button>` : ''; 
      
      html += `
        <div class="agenda-item">
          <div class="agenda-data"><span>${mes}</span><strong>${dia}</strong></div>
          <div class="agenda-info" style="flex:1;">
            ${btnExcluir}<h4>${e.titulo}</h4><p>${icon} ${e.local}</p>
          </div>
        </div>`; 
    }); 
    
    if(document.getElementById("listaEventosAgenda")) {
      document.getElementById("listaEventosAgenda").innerHTML = html || `<div class="empty-state" style="padding:10px;"><p style="font-size:0.85rem;">Nenhum evento agendado.</p></div>`; 
    }
    
    if(typeof lucide !== 'undefined') lucide.createIcons(); 
    
    document.querySelectorAll(".btn-excluir-evento").forEach(btn => { 
      btn.addEventListener("click", (e) => { 
        mostrarConfirmacao("Cancelar Evento", "Remover este evento da agenda?", async () => {
          await deleteDoc(doc(db, "agenda_eventos", e.currentTarget.dataset.id)); 
          atualizarTelas(); 
        }, "danger");
      }); 
    }); 
  } catch (err) { console.error("Erro na agenda:", err); } 
}

function setupPermissoesModal() { 
  const modal = document.getElementById("modalPermissoes"); 
  if(!modal) return; 
  
  document.getElementById("fecharModalPermissoes")?.addEventListener("click", () => modal.style.display = "none"); 
  document.getElementById("salvarPermissoesBtn")?.addEventListener("click", async (e) => { 
    const id = document.getElementById("permUserId").value; 
    let selecionadas = []; 
    document.querySelectorAll(".chk-perm:checked").forEach(chk => selecionadas.push(chk.value)); 
    
    if(selecionadas.length === 0) return showToast("Precisa ter pelo menos uma aba marcada.", "error"); 
    
    e.target.textContent = "Salvando..."; e.target.classList.add("loading");
    e.target.disabled = true; 
    
    try { 
      await updateDoc(doc(db, "atletas", id), { permissoes: selecionadas }); 
      showToast("Permissões atualizadas!", "success"); 
      modal.style.display = "none"; 
      atualizarTelas(); 
    } catch(err) { showToast("Erro ao gravar permissões.", "error"); } 
    finally {
      e.target.textContent = "Salvar Acessos"; e.target.classList.remove("loading");
      e.target.disabled = false; 
    }
  }); 
}

function setupFichaAtleta() { 
  document.getElementById("fecharModalFicha")?.addEventListener("click", () => document.getElementById("modalFichaAtleta").style.display = "none"); 
  
  document.getElementById("btnSalvarComentario")?.addEventListener("click", async () => { 
    const aId = document.getElementById("fichaAtletaId").value; 
    const txt = document.getElementById("novoComentarioFicha").value.trim(); 
    if(!txt) return; 
    
    const meuNome = appState.mapAtletas[auth.currentUser?.uid] ? appState.mapAtletas[auth.currentUser.uid].nome : "Comitê Gestor"; 
    const btn = document.getElementById("btnSalvarComentario"); 
    btn.disabled = true; btn.textContent = "Salvando..."; 
    
    try { 
      await addDoc(collection(db, "comentarios_atletas"), { 
        atletaId: aId, texto: txt, autorNome: meuNome, criadoEm: new Date().toISOString() 
      }); 
      
      document.getElementById("novoComentarioFicha").value = ""; 
      carregarComentarios(aId); 
      showToast("Comentário salvo!", "success"); 
    } catch(e) { showToast("Erro ao guardar comentário.", "error"); } 
    finally { btn.disabled = false; btn.textContent = "Adicionar Comentário"; }
  }); 
}

async function abrirFichaAtleta(id) { 
  const a = appState.mapAtletas[id]; 
  if(!a) return; 
  
  document.getElementById("fichaNome").textContent = a.nome; 
  document.getElementById("fichaEquipe").textContent = a.equipe; 
  document.getElementById("fichaPontos").textContent = a.pontuacaoTotal || 0; 
  
  // Renderiza Campos Completos da Ficha
  const renderCampo = (idEl, val, fallback) => { if(document.getElementById(idEl)) document.getElementById(idEl).textContent = val || fallback; };
  renderCampo("fichaLocalidade", a.localidade, "Não informada");
  renderCampo("fichaNasc", a.dataNascimento ? new Date(a.dataNascimento+"T00:00:00").toLocaleDateString('pt-BR') : "Não informada", "");
  renderCampo("fichaSexo", a.sexo, "Não informado");
  renderCampo("fichaAnoEntrada", a.anoEntrada, "-");

  const statusEl = document.getElementById("fichaStatus"); 
  if(a.ativo !== false) { 
    statusEl.textContent = "Ativo no Sistema"; statusEl.style.color = "var(--secondary)"; 
  } else { 
    statusEl.textContent = `Inativo: ${a.motivoSaida || 'Sem motivo'}`; statusEl.style.color = "var(--danger)"; 
  } 
  
  document.getElementById("fichaAtletaId").value = id; 
  const hist = appState.historicoCompleto.filter(h => h.atletaId === id); 
  let htmlH = ""; 
  
  if(hist.length === 0) htmlH = "<p style='color:#999; margin-top: 10px;'>Nenhum registo encontrado.</p>"; 
  hist.forEach(h => { 
    const dataF = new Date(h.dataTreino+"T00:00:00").toLocaleDateString('pt-BR'); 
    const isFalta = Number(h.pontos) === 0; 
    const cor = isFalta ? "var(--accent)" : "var(--secondary)"; 
    const ptsStr = isFalta ? "Falta Justificada" : `+${h.pontos} pts`; 
    
    htmlH += `
      <div style="border-bottom: 1px solid var(--border); padding: 8px 0; display:flex; justify-content:space-between; align-items:center;">
        <div><strong>${dataF}</strong> - ${h.descTreino}<br><small style="color:#666;">${h.regraDesc}</small></div>
        <div style="color:${cor}; font-weight:bold; text-align:right;">${ptsStr}</div>
      </div>`; 
  }); 
  
  document.getElementById("fichaHistorico").innerHTML = htmlH; 
  await carregarComentarios(id); 
  document.getElementById("modalFichaAtleta").style.display = "flex"; 
}

async function carregarComentarios(id) { 
  try { 
    const snap = await getDocs(query(collection(db, "comentarios_atletas"), where("atletaId", "==", id))); 
    let coments = []; snap.forEach(d => coments.push(d.data())); 
    coments.sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm)); 
    
    let html = ""; 
    coments.forEach(c => { 
      const d = new Date(c.criadoEm).toLocaleDateString('pt-BR') + " às " + new Date(c.criadoEm).toLocaleTimeString('pt-BR').substring(0,5); 
      html += `
        <div class="comentario-box">
          <div class="comentario-header"><span class="comentario-autor">${c.autorNome}</span> <span>${d}</span></div>
          <div style="margin-top: 4px;">${c.texto}</div>
        </div>`; 
    }); 
    
    document.getElementById("fichaComentariosLista").innerHTML = html || "<p style='color:#999; font-size:0.85rem;'>Nenhum comentário registado.</p>"; 
  } catch(e) { 
    document.getElementById("fichaComentariosLista").innerHTML = "<p style='color:red; font-size:0.85rem;'>Sem permissão para ler.</p>"; 
  } 
}

async function setupAprovacoes() { 
  const tbody = document.getElementById("listaAprovacoes"); 
  if (!tbody) return; 
  
  const snap = await getDocs(query(collection(db, "atletas"), where("status", "==", "Pendente"))); 
  tbody.innerHTML = ""; 
  
  if (snap.empty) { tbody.innerHTML = "<tr><td colspan='4'>Nenhuma pendência.</td></tr>"; return; } 
  
  snap.forEach(d => { 
    const u = d.data(); 
    tbody.innerHTML += `
      <tr>
        <td data-label="Nome"><strong>${u.nome}</strong></td>
        <td data-label="E-mail">${u.email}</td>
        <td data-label="Ação">
          <button class="btn-acao btn-aprovar" data-id="${d.id}" style="color:var(--secondary); border-color:var(--secondary); margin-right:5px;">Aprovar</button>
          <button class="btn-acao btn-rejeitar" data-id="${d.id}" style="color:var(--danger); border-color:var(--danger);">Rejeitar</button>
        </td>
      </tr>`; 
  }); 
  
  document.querySelectorAll(".btn-aprovar").forEach(btn => btn.addEventListener("click", async (e) => { 
    mostrarConfirmacao("Aprovar Acesso", "Confirmar o acesso administrativo deste membro?", async () => {
      e.currentTarget.disabled = true; 
      await updateDoc(doc(db, "atletas", e.currentTarget.dataset.id), { status: "Aprovado" }); 
      atualizarTelas(); 
    });
  })); 
  
  document.querySelectorAll(".btn-rejeitar").forEach(btn => btn.addEventListener("click", async (e) => { 
    mostrarConfirmacao("Rejeitar Pedido", "Negar e excluir o pedido de acesso?", async () => {
      e.currentTarget.disabled = true; 
      await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); 
      atualizarTelas(); 
    }, "danger");
  })); 
}

function setupModalEditar() { 
  const modal = document.getElementById("modalEditarAtleta"); 
  document.getElementById("fecharModalEdit")?.addEventListener("click", () => modal.style.display = "none"); 
  
  document.getElementById("salvarEditBtn")?.addEventListener("click", async (e) => { 
    const id = document.getElementById("editId").value;
    const nome = document.getElementById("editNome").value.trim();
    const email = document.getElementById("editEmail").value.trim();
    const papel = document.getElementById("editPapel").value; 
    
    if (!nome) return; 
    let role = "atleta"; let equipe = papel; 
    if (papel === "Comitê") { role = "comite"; equipe = "Nenhuma"; } 
    
    e.target.textContent = "Salvando..."; e.target.classList.add("loading");
    e.target.disabled = true; 
    
    try { 
      await updateDoc(doc(db, "atletas", id), { nome: nome, email: email, role: role, equipe: equipe }); 
      showToast("Dados atualizados!", "success"); 
      modal.style.display = "none"; atualizarTelas(); 
    } catch (err) { showToast("Erro ao editar dados.", "error"); } 
    finally {
      e.target.textContent = "Atualizar"; e.target.classList.remove("loading");
      e.target.disabled = false; 
    }
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

    let vinculadas = [];
    document.querySelectorAll(".chk-vinculo-regra:checked").forEach(chk => vinculadas.push(chk.value));

    e.target.disabled = true; e.target.textContent = "Salvando..."; e.target.classList.add("loading");

    try {
      const dados = { descricao: desc, modalidade: mod, pontos: pts, regrasVinculadas: vinculadas, atualizadoEm: new Date().toISOString() };
      if (id) {
        await updateDoc(doc(db, "regras_pontuacao", id), dados);
        showToast("Regra atualizada com sucesso!", "success");
      } else {
        dados.criadoEm = new Date().toISOString();
        await addDoc(collection(db, "regras_pontuacao"), dados);
        showToast("Nova regra criada!", "success");
      }
      modal.style.display = "none"; await carregarRegras(); 
    } catch (err) { showToast("Erro ao salvar regra: " + err.message, "error"); }
    finally {
      e.target.disabled = false; e.target.textContent = "Salvar Regra"; e.target.classList.remove("loading");
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
      html = "<tr><td colspan='4' style='text-align:center;'>Nenhuma regra cadastrada.</td></tr>";
    } else {
      appState.listaTodasRegras.forEach(r => {
        html += `
          <tr>
            <td data-label="Regra"><strong>${r.descricao}</strong></td>
            <td data-label="Modalidade">${r.modalidade}</td>
            <td data-label="Pontos" style="color:var(--primary); font-weight:bold;">+${r.pontos}</td>
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
        document.getElementById("regraDescricao").value = r.descricao;
        document.getElementById("regraModalidade").value = r.modalidade;
        document.getElementById("regraPontos").value = r.pontos;
        
        renderizarVinculosRegras(r.regrasVinculadas || [], r.id);
        document.getElementById("modalRegra").style.display = "flex";
      });
    });
  } catch (err) { console.error("Erro ao carregar regras:", err); }
}

function renderizarVinculosRegras(selecionadas = [], idIgnorado = null) {
  const div = document.getElementById("listaVinculosRegras");
  if (!div) return;
  
  let html = "";
  appState.listaTodasRegras.forEach(r => {
    if (r.id === idIgnorado) return; 
    
    const checked = selecionadas.includes(r.id) ? "checked" : "";
    html += `
      <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px; cursor:pointer;">
        <input type="checkbox" class="chk-vinculo-regra" value="${r.id}" ${checked}> 
        <span style="color:var(--text);">${r.descricao}</span>
      </label>`;
  });
  
  div.innerHTML = html || "<small style='color:var(--text-light);'>Nenhuma outra regra cadastrada ainda.</small>";
}
