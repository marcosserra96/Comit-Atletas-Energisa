import { 
  auth, db, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc,
  onAuthStateChanged, signOut, query, where, orderBy, writeBatch, increment,
  updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "./firebase.js";

let userRole = "atleta";
let userPermissoes = [];
let historicoCompleto = []; 
let mapAtletas = {};        
let graficoLinhaInstancia = null; 
let graficoEngajBike = null;
let graficoEngajCorrida = null;
let gastoTotalGlobal = 0; 
let cacheEventos = [];

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer"); if (!container) return;
  const t = document.createElement("div"); t.className = `toast ${type}`; t.innerHTML = message;
  container.appendChild(t); lucide.createIcons(); setTimeout(() => t.remove(), 4000);
}

// =====================================================
// 🔒 INICIALIZAÇÃO & PERMISSÕES DINÂMICAS
// =====================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    if (docSnap.exists() && (docSnap.data().role === "admin" || docSnap.data().role === "comite")) {
      userRole = docSnap.data().role;
      userPermissoes = userRole === "admin" ? 
        ["visao-geral", "contabilizacao", "financeiro_view", "financeiro_edit", "gestao", "configuracoes"] : 
        (docSnap.data().permissoes || ["visao-geral", "configuracoes"]);
      
      construirMenu(); iniciarPainelAdmin();
    } else { window.location.href = "index.html"; }
  } else { window.location.href = "index.html"; }
});

function construirMenu() {
  const menu = document.getElementById("menuNavegacao"); menu.innerHTML = "";
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
    if (item.permCheck) { hasAccess = item.permCheck.some(p => userPermissoes.includes(p)); } 
    else { hasAccess = userPermissoes.includes(item.id); }

    if (hasAccess || userRole === "admin") {
      const isFirst = !abaAtiva; if(isFirst) abaAtiva = true;
      menu.innerHTML += `<div class="menu-item ${isFirst ? 'active' : ''}" data-section="${item.id}"><i data-lucide="${item.icon}"></i><span>${item.text}</span></div>`;
    }
  });
  
  document.querySelectorAll("main section").forEach(sec => {
    sec.classList.remove("active-section");
    const activeMenu = document.querySelector('.menu-item.active');
    if (activeMenu && sec.id === activeMenu.dataset.section) { sec.classList.add("active-section"); }
  });

  const badge = document.getElementById("userGroupBadge"); badge.style.display = "inline-block";
  if (userRole === "admin") { badge.textContent = "Admin"; badge.style.background = "var(--danger)"; } 
  else { badge.textContent = "Comitê"; badge.style.background = "var(--primary)"; }

  if (userRole !== "admin") { document.querySelectorAll(".admin-only-element").forEach(el => el.style.display = "none"); }
  
  document.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".menu-item").forEach(btn => btn.classList.remove("active")); item.classList.add("active");
      document.querySelectorAll("main section").forEach(sec => { sec.classList.remove("active-section"); if (sec.id === item.dataset.section) sec.classList.add("active-section"); });
      lucide.createIcons();
    });
  });
  lucide.createIcons();
}

function iniciarPainelAdmin() {
  Chart.defaults.color = document.body.getAttribute('data-theme') === 'dark' ? '#aaa' : '#666';
  document.getElementById("logoutBtn").addEventListener("click", async () => { if(confirm("Sair?")) { await signOut(auth); window.location.href = "index.html"; } });
  setupSubTabs(); setupCadastrarPessoa(); setupContabilizacao(); setupRelatorioConsolidado(); setupFinanceiro(); setupMetas(); setupPermissoesModal(); setupAgenda(); setupConfiguracoes(); setupModalRegras(); setupModalEditar(); setupLimparBase();
  atualizarTelas();
}

function setupSubTabs() {
  document.querySelectorAll(".sub-tab").forEach(tab => { tab.addEventListener("click", () => { const p = tab.closest('section'); p.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active")); p.querySelectorAll(".sub-content").forEach(c => c.classList.remove("active")); tab.classList.add("active"); document.getElementById(tab.dataset.target).classList.add("active"); }); });
  document.querySelectorAll(".t-tab").forEach(tab => { tab.addEventListener("click", () => { const p = tab.closest('.sub-content'); p.querySelectorAll(".t-tab").forEach(t => t.classList.remove("active")); p.querySelectorAll(".t-content").forEach(c => c.classList.remove("active")); tab.classList.add("active"); document.getElementById(tab.dataset.target).classList.add("active"); }); });
}

async function atualizarTelas() {
  if (userRole === "admin") setupAprovacoes();
  await carregarAgenda(); 
  await carregarHistorico(); 
  await carregarFinanceiro(); 
  await carregarEquipesEDashboard(); 
  await carregarRegras();
}

// =====================================================
// 📊 DASHBOARD & GERADOR DE PDF BI
// =====================================================
document.getElementById("btnExportarPDF").addEventListener("click", () => {
  showToast("Montando painel corporativo...", "info");
  
  const temaAtual = document.body.getAttribute("data-theme");
  if (temaAtual === "dark") {
    document.body.removeAttribute("data-theme");
    Chart.defaults.color = '#666';
    if(graficoLinhaInstancia) graficoLinhaInstancia.update();
  }

  setTimeout(() => {
    document.getElementById("pdfDataHoje").textContent = new Date().toLocaleDateString('pt-BR');
    document.getElementById("pdfAtivos").textContent = document.getElementById("totalAtivosGeral").textContent;
    document.getElementById("pdfBike").textContent = document.getElementById("totalBike").textContent;
    document.getElementById("pdfCorrida").textContent = document.getElementById("totalCorrida").textContent;
    document.getElementById("pdfInvest").textContent = document.getElementById("totalInvestimento").textContent;
    document.getElementById("pdfRoi").textContent = document.getElementById("roiAtleta").textContent;
    document.getElementById("pdfMediaBike").textContent = document.getElementById("mediaBike").textContent;
    document.getElementById("pdfMediaCorrida").textContent = document.getElementById("mediaCorrida").textContent;
    
    document.getElementById("pdfTopBike").innerHTML = document.getElementById("listaPodioBike").innerHTML;
    document.getElementById("pdfTopCorrida").innerHTML = document.getElementById("listaPodioCorrida").innerHTML;
    document.getElementById("pdfListaEvasao").innerHTML = document.getElementById("listaEvasao").innerHTML;

    const agendaClone = document.getElementById("listaEventosAgenda").cloneNode(true);
    agendaClone.querySelectorAll("button").forEach(b => b.remove()); 
    document.getElementById("pdfProximosEventos").innerHTML = agendaClone.innerHTML;

    const eventosPassados = {};
    historicoCompleto.forEach(h => {
      if(!h.dataTreino || !h.descTreino || h.descTreino.toLowerCase().includes("falta")) return;
      const key = `${h.dataTreino}::${h.descTreino}`;
      if(!eventosPassados[key]) eventosPassados[key] = { data: h.dataTreino, desc: h.descTreino, atletas: new Set() };
      eventosPassados[key].atletas.add(h.atletaId);
    });
    
    const listaUltimos = Object.values(eventosPassados).sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0, 4);
    let htmlUltimos = "";
    listaUltimos.forEach(e => {
       const d = new Date(e.data + "T00:00:00").toLocaleDateString('pt-BR').substring(0,5);
       htmlUltimos += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; border-bottom:1px solid #f5f5f5; padding-bottom:4px;">
         <span style="color:#666;"><strong>${d}</strong> - ${e.desc}</span>
         <strong style="color:var(--primary);">${e.atletas.size} 👤</strong>
       </div>`;
    });
    document.getElementById("pdfUltimosEventos").innerHTML = htmlUltimos || "<p style='color:#999; text-align:center;'>Nenhum evento.</p>";

    // CONGELAMENTO DO GRÁFICO
    const canvasLinha = document.getElementById('graficoTendencia');
    const widthOriginal = canvasLinha.style.width;
    const heightOriginal = canvasLinha.style.height;
    if(canvasLinha) { 
      canvasLinha.style.width = '700px'; 
      canvasLinha.style.height = '200px'; 
      if(graficoLinhaInstancia) graficoLinhaInstancia.resize();
      document.getElementById('pdfImgTendencia').src = canvasLinha.toDataURL("image/png", 1.0); 
    }

    const modalPdf = document.getElementById("pdfOverlay");
    const printArea = document.getElementById("pdfPrintArea");
    modalPdf.style.display = "flex";

    setTimeout(() => {
      const opt = {
        margin: 0, 
        filename: `Report_Atletas_${document.getElementById("pdfDataHoje").textContent.replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } 
      };

      html2pdf().set(opt).from(printArea).save().then(() => { 
        modalPdf.style.display = "none"; 
        
        if(canvasLinha) {
          canvasLinha.style.width = widthOriginal; 
          canvasLinha.style.height = heightOriginal; 
          if(graficoLinhaInstancia) graficoLinhaInstancia.resize();
        }

        if (temaAtual === "dark") {
          document.body.setAttribute("data-theme", "dark");
          Chart.defaults.color = '#aaa';
          if(graficoLinhaInstancia) graficoLinhaInstancia.update();
        }
        showToast("Download Concluído!", "success"); 
      });
    }, 600);
  }, 150); 
});

// =====================================================
// 🎯 METAS & FINANCEIRO & AGENDA
// =====================================================
async function setupMetas() {
  const btn = document.getElementById("btnEditarMeta");
  if(btn) {
    btn.addEventListener("click", async () => {
      const novaMeta = prompt("Digite a meta global de pontos (Digite 0 para ocultar):");
      if(novaMeta !== null) { await setDoc(doc(db, "configuracoes", "metas"), { valor: Number(novaMeta) || 0 }); atualizarTelas(); }
    });
  }
}

function setupFinanceiro() {
  const btnSalvar = document.getElementById("btnSalvarDespesa");
  if(!btnSalvar) return;
  btnSalvar.addEventListener("click", async () => {
    const desc = document.getElementById("descDespesa").value.trim(), cat = document.getElementById("catDespesa").value, val = document.getElementById("valorDespesa").value, data = document.getElementById("dataDespesa").value;
    const eventoId = document.getElementById("vincularEventoDespesa").value;
    
    let nomeEvento = "";
    if (eventoId) { const eventoEncontrado = cacheEventos.find(e => e.id === eventoId); if(eventoEncontrado) nomeEvento = eventoEncontrado.titulo; }
    if (!desc || !val || !data) return showToast("Preencha descrição, valor e data!", "error");
    
    btnSalvar.textContent = "Salvando..."; btnSalvar.disabled = true;
    try { 
      await addDoc(collection(db, "despesas"), { descricao: desc, categoria: cat, valor: parseFloat(val), data: data, eventoId: eventoId, eventoNome: nomeEvento, criadoEm: new Date().toISOString() }); 
      document.getElementById("descDespesa").value = ""; document.getElementById("valorDespesa").value = ""; document.getElementById("vincularEventoDespesa").value = "";
      showToast("Despesa registrada!", "success"); atualizarTelas(); 
    } catch(err) { showToast("Erro.", "error"); } finally { btnSalvar.textContent = "Registrar Gasto"; btnSalvar.disabled = false; }
  });
}

async function carregarFinanceiro() {
  const snap = await getDocs(query(collection(db, "despesas"), orderBy("data", "desc")));
  let html = ""; gastoTotalGlobal = 0;
  
  const canEdit = userRole === "admin" || userPermissoes.includes("financeiro_edit");
  const cardAdd = document.getElementById("cardNovaDespesa");
  if(cardAdd) cardAdd.style.display = canEdit ? "block" : "none";

  snap.forEach(d => {
    const desp = d.data(); gastoTotalGlobal += desp.valor;
    const btnExcluir = canEdit ? `<button class="btn-acao btn-excluir-despesa" data-id="${d.id}" style="color:red; border:0; padding:0;"><i data-lucide="trash" style="width:16px;"></i></button>` : '';
    const tagEvento = desp.eventoNome ? `<br><small style="color: var(--primary);"><i data-lucide="calendar" style="width:12px;"></i> ${desp.eventoNome}</small>` : '';
    html += `<tr><td>${new Date(desp.data + "T00:00:00").toLocaleDateString('pt-BR')}</td><td><strong>${desp.descricao}</strong>${tagEvento}</td><td style="color:var(--danger); font-weight:bold;">${desp.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td><td style="text-align:right;">${btnExcluir}</td></tr>`;
  });
  
  if(document.getElementById("listaDespesas")) document.getElementById("listaDespesas").innerHTML = html || `<tr><td colspan='4'>Sem registros.</td></tr>`;
  if(document.getElementById("totalInvestimento")) document.getElementById("totalInvestimento").textContent = gastoTotalGlobal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  lucide.createIcons();
  document.querySelectorAll(".btn-excluir-despesa").forEach(btn => { btn.addEventListener("click", async (e) => { if(confirm("Excluir despesa?")) { await deleteDoc(doc(db, "despesas", e.currentTarget.dataset.id)); atualizarTelas(); } }); });
}

function setupAgenda() {
  const modal = document.getElementById("modalEvento");
  if(document.getElementById("abrirModalEvento")) document.getElementById("abrirModalEvento").addEventListener("click", () => modal.style.display = "flex");
  if(document.getElementById("fecharModalEvento")) document.getElementById("fecharModalEvento").addEventListener("click", () => modal.style.display = "none");
  if(document.getElementById("salvarEventoBtn")) document.getElementById("salvarEventoBtn").addEventListener("click", async () => {
    const titulo = document.getElementById("eventoTitulo").value.trim(), local = document.getElementById("eventoLocal").value.trim(), mod = document.getElementById("eventoModalidade").value, data = document.getElementById("eventoData").value;
    if (!titulo || !data) return showToast("Título e Data são obrigatórios!", "error");
    await addDoc(collection(db, "agenda_eventos"), { titulo: titulo, local: local, modalidade: mod, data: data, criadoEm: new Date().toISOString() });
    modal.style.display = "none"; document.getElementById("eventoTitulo").value = ""; document.getElementById("eventoLocal").value = ""; showToast("Evento agendado!", "success"); atualizarTelas();
  });
}

async function carregarAgenda() {
  const snap = await getDocs(query(collection(db, "agenda_eventos")));
  cacheEventos = []; snap.forEach(d => cacheEventos.push({id: d.id, ...d.data()}));
  cacheEventos.sort((a,b) => new Date(a.data) - new Date(b.data)); 
  
  const htmlDropdown = '<option value="">Nenhum (Avulso)</option>' + cacheEventos.map(e => `<option value="${e.id}">${e.titulo} (${new Date(e.data+"T00:00:00").toLocaleDateString('pt-BR')})</option>`).join('');
  if(document.getElementById("vincularEventoDespesa")) document.getElementById("vincularEventoDespesa").innerHTML = htmlDropdown;
  if(document.getElementById("lancarEventoSelect")) document.getElementById("lancarEventoSelect").innerHTML = htmlDropdown;

  const hoje = new Date().toISOString().split('T')[0];
  const futuros = cacheEventos.filter(e => e.data >= hoje).slice(0, 4); 
  let html = "";
  futuros.forEach(e => {
    const d = new Date(e.data + "T00:00:00"); const mes = d.toLocaleString('pt-BR', {month: 'short'}).replace('.',''); const dia = d.getDate().toString().padStart(2, '0');
    let icon = e.modalidade === "Bicicleta" ? "🚴" : e.modalidade === "Corrida" ? "🏃" : "🤝";
    const btnExcluir = (userRole === "admin") ? `<button class="btn-excluir-evento" data-id="${e.id}" style="background:transparent; border:none; color:var(--danger); cursor:pointer; float:right;"><i data-lucide="x" style="width:16px;"></i></button>` : '';
    html += `<div class="agenda-item"><div class="agenda-data"><span>${mes}</span><strong>${dia}</strong></div><div class="agenda-info" style="flex:1;">${btnExcluir}<h4>${e.titulo}</h4><p>${icon} ${e.local}</p></div></div>`;
  });
  if(document.getElementById("listaEventosAgenda")) document.getElementById("listaEventosAgenda").innerHTML = html || `<div class="empty-state" style="padding:10px;"><p style="font-size:0.85rem;">Nenhum evento agendado.</p></div>`;
  lucide.createIcons();
  document.querySelectorAll(".btn-excluir-evento").forEach(btn => { btn.addEventListener("click", async (e) => { if(confirm("Cancelar evento?")) { await deleteDoc(doc(db, "agenda_eventos", e.currentTarget.dataset.id)); atualizarTelas(); } }); });
}

// =====================================================
// 👥 EQUIPES & RENDERIZAÇÃO GRÁFICOS
// =====================================================
async function carregarEquipesEDashboard() {
  const snap = await getDocs(query(collection(db, "atletas"), where("status", "==", "Aprovado")));
  let htmlFilaBike = "", htmlFilaCorrida = "", htmlBike = "", htmlCorrida = "", htmlComite = "";
  let contFila = 0, contBike = 0, contCorrida = 0, contComite = 0, ptsBike = 0, ptsCorrida = 0;
  let todosAtletas = []; mapAtletas = {}; 

  let listaOrdenada = []; snap.forEach(d => { mapAtletas[d.id] = { id: d.id, ...d.data() }; listaOrdenada.push(mapAtletas[d.id]); });
  const filaEspera = listaOrdenada.filter(u => u.equipe === "Fila - Bicicleta" || u.equipe === "Fila - Corrida" || u.equipe === "Fila de Espera");
  const titulares = listaOrdenada.filter(u => u.equipe !== "Fila - Bicicleta" && u.equipe !== "Fila - Corrida" && u.equipe !== "Fila de Espera");
  
  filaEspera.sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0));
  titulares.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));

  let idxBike = 1, idxCorrida = 1;
  filaEspera.forEach((u) => {
    const strikes = u.recusas || 0;
    const badgeStrike = strikes > 0 ? `<span class="strike-badge">⚠️ ${strikes}/3</span>` : '';
    
    if(u.equipe === "Fila - Bicicleta" || u.equipe === "Fila de Espera") { 
      const btnAprovar = `<button class="btn-acao btn-aprovar-fila" data-id="${u.id}" data-eq="Bicicleta" style="color:var(--secondary); padding:4px;"><i data-lucide="check" style="width:16px;"></i></button>`;
      const btnPular = `<button class="btn-acao btn-pular-fila" data-id="${u.id}" data-strikes="${strikes}" style="color:#f39c12; padding:4px;"><i data-lucide="skip-forward" style="width:16px;"></i></button>`;
      htmlFilaBike += `<tr><td><strong>${idxBike}º - ${u.nome}</strong> ${badgeStrike}</td><td style="text-align: right; display:flex; justify-content:flex-end; gap:5px;">${btnAprovar} ${btnPular}</td></tr>`;
      idxBike++; contFila++;
    } 
    if (u.equipe === "Fila - Corrida") {
      const btnAprovar = `<button class="btn-acao btn-aprovar-fila" data-id="${u.id}" data-eq="Corrida" style="color:var(--secondary); padding:4px;"><i data-lucide="check" style="width:16px;"></i></button>`;
      const btnPular = `<button class="btn-acao btn-pular-fila" data-id="${u.id}" data-strikes="${strikes}" style="color:#f39c12; padding:4px;"><i data-lucide="skip-forward" style="width:16px;"></i></button>`;
      htmlFilaCorrida += `<tr><td><strong>${idxCorrida}º - ${u.nome}</strong> ${badgeStrike}</td><td style="text-align: right; display:flex; justify-content:flex-end; gap:5px;">${btnAprovar} ${btnPular}</td></tr>`;
      idxCorrida++; contFila++;
    }
  });

  titulares.forEach(u => {
    const pts = Number(u.pontuacaoTotal) || 0; const ativo = u.ativo !== false;
    const btnPerm = (u.role === 'comite' && userRole === 'admin') ? `<button class="btn-primario btn-permissoes" data-id="${u.id}" data-nome="${u.nome}" style="background: #f39c12; padding: 6px 10px; font-size: 0.8rem; margin-left: 5px;"><i data-lucide="key" style="width: 14px;"></i> Acessos</button>` : '';
    const btnEditar = `<button class="btn-acao btn-editar-membro" data-id="${u.id}" data-nome="${u.nome}" data-email="${u.email}" data-eq="${u.equipe}" style="color: var(--warning); border-color: var(--warning); padding: 4px; margin-left: 5px;"><i data-lucide="edit-2" style="width: 16px;"></i></button>`;
    const btnExcluir = (auth.currentUser.uid !== u.id && userRole === "admin") ? `<button class="btn-acao btn-excluir-membro" data-id="${u.id}" style="color: red; border: 0; padding: 4px; margin-left: 5px;"><i data-lucide="x-circle" style="width: 18px;"></i></button>` : '';
    
    const displayPts = u.role === 'atleta' ? `<br><small style="color: var(--primary);">🏆 ${pts} pts</small>` : '';
    const linha = `<tr><td class="${!ativo ? 'inativo-txt' : ''}"><strong>${u.nome}</strong>${displayPts}</td><td style="text-align: right; display:flex; justify-content:flex-end; align-items:center;">${btnPerm} ${btnEditar} ${btnExcluir}</td></tr>`;
    
    if (u.role === "admin" || u.role === "comite") { htmlComite += linha; contComite++; }
    else if (u.equipe === "Corrida") { htmlCorrida += linha; contCorrida++; ptsCorrida += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe, id: u.id, ativo: ativo}); }
    else if (u.equipe === "Bicicleta") { htmlBike += linha; contBike++; ptsBike += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe, id: u.id, ativo: ativo}); }
  });

  if(document.getElementById("listaFilaBike")) document.getElementById("listaFilaBike").innerHTML = htmlFilaBike || `<tr><td colspan='2'>Ninguém na fila.</td></tr>`;
  if(document.getElementById("listaFilaCorrida")) document.getElementById("listaFilaCorrida").innerHTML = htmlFilaCorrida || `<tr><td colspan='2'>Ninguém na fila.</td></tr>`;
  if(document.getElementById("listaBicicleta")) document.getElementById("listaBicicleta").innerHTML = htmlBike || `<tr><td colspan='2'>Equipe vazia.</td></tr>`;
  if(document.getElementById("listaCorrida")) document.getElementById("listaCorrida").innerHTML = htmlCorrida || `<tr><td colspan='2'>Equipe vazia.</td></tr>`;
  if(document.getElementById("listaComite")) document.getElementById("listaComite").innerHTML = htmlComite || `<tr><td colspan='2'>Sem membros.</td></tr>`;
  
  if(document.getElementById("totalFila")) document.getElementById("totalFila").textContent = contFila;
  if(document.getElementById("totalComite")) document.getElementById("totalComite").textContent = contComite;
  if(document.getElementById("totalBike")) document.getElementById("totalBike").textContent = contBike;
  if(document.getElementById("totalCorrida")) document.getElementById("totalCorrida").textContent = contCorrida;

  renderGraficosETop(ptsBike, ptsCorrida, todosAtletas, contBike, contCorrida);
  lucide.createIcons();

  document.querySelectorAll(".btn-aprovar-fila").forEach(btn => { btn.addEventListener("click", async (e) => { if(confirm(`Aprovar atleta?`)) { await updateDoc(doc(db, "atletas", e.currentTarget.dataset.id), { equipe: e.currentTarget.dataset.eq, recusas: 0 }); atualizarTelas(); }}); });
  document.querySelectorAll(".btn-pular-fila").forEach(btn => { btn.addEventListener("click", async (e) => { const id = e.currentTarget.dataset.id; let st = parseInt(e.currentTarget.dataset.strikes); if(confirm(`Passar a vez do atleta?`)) { st++; if(st>=3) { alert("3 recusas! Movido pro fim da fila."); await updateDoc(doc(db, "atletas", id), { recusas: 0, criadoEm: new Date().toISOString() }); } else { await updateDoc(doc(db, "atletas", id), { recusas: st }); } atualizarTelas(); }}); });
  document.querySelectorAll(".btn-excluir-membro").forEach(btn => { btn.addEventListener("click", async (e) => { if(confirm("Apagar definitivamente?")) { await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); atualizarTelas(); }}); });
  document.querySelectorAll(".btn-editar-membro").forEach(btn => { btn.addEventListener("click", (e) => { const b = e.currentTarget; document.getElementById("editId").value = b.dataset.id; document.getElementById("editNome").value = b.dataset.nome; document.getElementById("editEmail").value = b.dataset.email !== "undefined" ? b.dataset.email : ""; document.getElementById("editPapel").value = b.dataset.eq; document.getElementById("modalEditarAtleta").style.display = "flex"; }); });

  document.querySelectorAll(".btn-permissoes").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const b = e.currentTarget; document.getElementById("permNomeUsuario").textContent = b.dataset.nome; document.getElementById("permUserId").value = b.dataset.id;
      const permissoesDB = mapAtletas[b.dataset.id].permissoes || ["visao-geral"];
      document.querySelectorAll(".chk-perm").forEach(chk => { chk.checked = permissoesDB.includes(chk.value) || (permissoesDB.includes("financeiro") && chk.value.startsWith("financeiro")); });
      document.getElementById("modalPermissoes").style.display = "flex";
    });
  });
}

function setupPermissoesModal() {
  const modal = document.getElementById("modalPermissoes"); if(!modal) return;
  document.getElementById("fecharModalPermissoes").addEventListener("click", () => modal.style.display = "none");
  document.getElementById("salvarPermissoesBtn").addEventListener("click", async () => {
    const id = document.getElementById("permUserId").value; let selecionadas = [];
    document.querySelectorAll(".chk-perm:checked").forEach(chk => selecionadas.push(chk.value));
    if(selecionadas.length === 0) return showToast("Precisa ter pelo menos uma aba.", "error");
    await updateDoc(doc(db, "atletas", id), { permissoes: selecionadas }); showToast("Permissões atualizadas!", "success"); modal.style.display = "none"; atualizarTelas();
  });
}

async function renderGraficosETop(ptsBike, ptsCorrida, arrayAtletas, totalBike, totalCorrida) {
  const snapMeta = await getDoc(doc(db, "configuracoes", "metas"));
  const metaValor = snapMeta.exists() ? snapMeta.data().valor : 0;
  const cardMeta = document.getElementById("cardMeta");
  if(metaValor > 0 && cardMeta) {
    cardMeta.style.display = "block"; const totalPts = ptsBike + ptsCorrida; const percMeta = Math.min((totalPts / metaValor) * 100, 100).toFixed(1);
    document.getElementById("barraMetaGeral").style.width = `${percMeta}%`; document.getElementById("textoMetaGeral").textContent = `${totalPts} / ${metaValor} pts (${percMeta}%)`;
  } else if (cardMeta) { cardMeta.style.display = "none"; }

  document.getElementById("mediaBike").textContent = totalBike > 0 ? Math.round(ptsBike / totalBike) : 0;
  document.getElementById("mediaCorrida").textContent = totalCorrida > 0 ? Math.round(ptsCorrida / totalCorrida) : 0;

  const htmlPodio = (arr) => {
    if(arr.length===0) return "<li style='color:#999; font-size:0.85rem;'>Sem pontos</li>";
    return arr.map((a,i) => `<li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);"><span>${i===0?'🥇':i===1?'🥈':'🥉'} <strong>${a.nome}</strong></span><strong>${a.pts}</strong></li>`).join('');
  };
  
  const bikeAtletas = arrayAtletas.filter(a => a.eq === 'Bicicleta').sort((a,b) => b.pts - a.pts).slice(0,3);
  const corridaAtletas = arrayAtletas.filter(a => a.eq === 'Corrida').sort((a,b) => b.pts - a.pts).slice(0,3);
  if(document.getElementById("listaPodioBike")) document.getElementById("listaPodioBike").innerHTML = htmlPodio(bikeAtletas);
  if(document.getElementById("listaPodioCorrida")) document.getElementById("listaPodioCorrida").innerHTML = htmlPodio(corridaAtletas);

  // RADAR DE EVASÃO (Inativos e Zerados)
  const evasaoAtletas = arrayAtletas.filter(a => a.pts === 0 || a.ativo === false).slice(0, 6);
  const htmlEvasao = (arr) => {
    if(arr.length===0) return "<li style='color:var(--secondary); font-size:0.85rem;'>Nenhum alerta. Todos participando! 🎉</li>";
    return arr.map(a => `<li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--danger);"><span style="color:var(--danger);">⚠️ <strong>${a.nome}</strong></span><small style="color:#999;">${a.eq}</small></li>`).join('');
  };
  if(document.getElementById("listaEvasao")) document.getElementById("listaEvasao").innerHTML = htmlEvasao(evasaoAtletas);

  const anoAtual = new Date().getFullYear().toString();
  const idsQuePontuaram = new Set();
  historicoCompleto.forEach(h => { if(h.dataTreino && h.dataTreino.startsWith(anoAtual) && h.pontos > 0) idsQuePontuaram.add(h.atletaId); });

  let ativosBike = 0, ativosCorrida = 0;
  arrayAtletas.forEach(a => { if(idsQuePontuaram.has(a.id)) { if(a.eq === "Bicicleta") ativosBike++; else ativosCorrida++; } });

  const inatBike = totalBike - ativosBike; const inatCorrida = totalCorrida - ativosCorrida;
  document.getElementById('txtAtivosBike').textContent = totalBike === 0 ? "0%" : `${Math.round((ativosBike/totalBike)*100)}%`;
  document.getElementById('txtAtivosCorrida').textContent = totalCorrida === 0 ? "0%" : `${Math.round((ativosCorrida/totalCorrida)*100)}%`;

  const totalAtivosGerais = ativosBike + ativosCorrida;
  if(document.getElementById("totalAtivosGeral")) document.getElementById("totalAtivosGeral").textContent = totalAtivosGerais;
  if(document.getElementById("roiAtleta")) {
    const roi = totalAtivosGerais > 0 ? (gastoTotalGlobal / totalAtivosGerais) : 0;
    document.getElementById("roiAtleta").textContent = roi.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  }

  if(document.getElementById('graficoEngajBike')) {
    if(graficoEngajBike) graficoEngajBike.destroy();
    graficoEngajBike = new Chart(document.getElementById('graficoEngajBike'), { type: 'doughnut', data: { datasets: [{ data: [ativosBike, inatBike], backgroundColor: ['#009bc1', '#e3e6eb'], borderWidth: 0 }] }, options: { cutout: '75%', plugins: { tooltip:{enabled:false} } } });
  }
  if(document.getElementById('graficoEngajCorrida')) {
    if(graficoEngajCorrida) graficoEngajCorrida.destroy();
    graficoEngajCorrida = new Chart(document.getElementById('graficoEngajCorrida'), { type: 'doughnut', data: { datasets: [{ data: [ativosCorrida, inatCorrida], backgroundColor: ['#00b37e', '#e3e6eb'], borderWidth: 0 }] }, options: { cutout: '75%', plugins: { tooltip:{enabled:false} } } });
  }

  if(document.getElementById('graficoTendencia')) {
    if(graficoLinhaInstancia) graficoLinhaInstancia.destroy();
    let ptsPorMes = [0,0,0,0,0,0,0,0,0,0,0,0];
    historicoCompleto.forEach(h => { if(h.dataTreino && h.dataTreino.startsWith(anoAtual)) { const m = parseInt(h.dataTreino.split("-")[1], 10); if(!isNaN(m) && m >= 1 && m <= 12) ptsPorMes[m - 1] += (Number(h.pontos) || 0); } });
    graficoLinhaInstancia = new Chart(document.getElementById('graficoTendencia'), { type: 'line', data: { labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'], datasets: [{ data: ptsPorMes, borderColor: '#009bc1', backgroundColor: 'rgba(0,155,193,0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  }
}

// =====================================================
// 📝 LANÇAMENTO LOTE & EXTRATO & RELATÓRIOS
// =====================================================
function setupContabilizacao() {
  document.getElementById("dataTreino").valueAsDate = new Date();
  
  document.getElementById("lancarEventoSelect").addEventListener("change", (e) => {
    const evId = e.target.value;
    if(evId) {
      const evento = cacheEventos.find(x => x.id === evId);
      if(evento) {
        document.getElementById("descTreino").value = evento.titulo;
        document.getElementById("dataTreino").value = evento.data;
        if(evento.modalidade !== "Ambas") {
          document.getElementById("modTreino").value = evento.modalidade;
          document.getElementById("modTreino").dispatchEvent(new Event('change'));
        }
      }
    } else {
      document.getElementById("descTreino").value = "";
      document.getElementById("dataTreino").valueAsDate = new Date();
    }
  });

  document.getElementById("modTreino").addEventListener("change", async (e) => {
    const mod = e.target.value; const areaRegras = document.getElementById("areaSelecaoRegras"), listaRegras = document.getElementById("listaRegrasTreino"), btnGerar = document.getElementById("btnGerarLista");
    document.getElementById("areaTabelaPontuacao").style.display = "none"; 
    document.getElementById("checkSelecionarTodasRegras").checked = false;
    if (!mod) { areaRegras.style.display = "none"; btnGerar.style.display = "none"; return; }
    listaRegras.innerHTML = "<span style='font-size: 0.85rem; color: #999;'>Buscando regras...</span>"; areaRegras.style.display = "block";
    const snapRegras = await getDocs(query(collection(db, "regras_pontuacao"), where("modalidade", "in", ["Ambas", mod])));
    if (snapRegras.empty) { listaRegras.innerHTML = "Nenhuma regra."; btnGerar.style.display = "none"; return; }
    listaRegras.innerHTML = "";
    snapRegras.forEach(d => { const r = d.data(); const chip = document.createElement("label"); chip.className = "regra-chip"; chip.innerHTML = `<input type="checkbox" value="${d.id}" data-desc="${r.descricao}" data-pontos="${r.pontos}"> ${r.descricao} <strong style="color:var(--secondary);">+${r.pontos}</strong>`; chip.querySelector("input").addEventListener("change", (ev) => { if(ev.target.checked) chip.classList.add("selected"); else chip.classList.remove("selected"); }); listaRegras.appendChild(chip); });
    btnGerar.style.display = "inline-flex";
  });

  document.getElementById("checkSelecionarTodasRegras").addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll("#listaRegrasTreino .regra-chip input[type='checkbox']").forEach(chk => { chk.checked = isChecked; if(isChecked) chk.closest('.regra-chip').classList.add('selected'); else chk.closest('.regra-chip').classList.remove('selected'); });
  });

  document.getElementById("btnGerarLista").addEventListener("click", async () => {
    const desc = document.getElementById("descTreino").value.trim(), data = document.getElementById("dataTreino").value, mod = document.getElementById("modTreino").value;
    const regras = []; document.querySelectorAll("#listaRegrasTreino input:checked").forEach(chk => { regras.push({ id: chk.value, descricao: chk.dataset.desc, pontos: parseInt(chk.dataset.pontos) }); });
    if (!desc || !data || !mod) return showToast("Preencha tudo!", "error"); if (regras.length === 0) return showToast("Selecione uma regra!", "error");
    const btn = document.getElementById("btnGerarLista"); btn.textContent = "Gerando..."; btn.disabled = true;
    await gerarTabelaContabilizacao(mod, regras);
    btn.textContent = "Gerar Tabela de Atletas"; btn.disabled = false; document.getElementById("areaTabelaPontuacao").style.display = "block";
  });
  document.getElementById("btnSalvarPontuacao").addEventListener("click", salvarPontuacoesEmLote);
}

async function gerarTabelaContabilizacao(modalidade, regras) {
  const tabela = document.getElementById("tabelaPontuacao");
  const snapAtletas = await getDocs(query(collection(db, "atletas"), where("status", "==", "Aprovado"), where("equipe", "==", modalidade)));
  let atletas = []; snapAtletas.forEach(d => { if(d.data().ativo !== false) atletas.push({id: d.id, ...d.data()}); });
  atletas.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  if (atletas.length === 0) { tabela.innerHTML = `<tr><td style='text-align:center;'>Nenhum atleta ativo.</td></tr>`; return; }

  let thead = `<thead><tr><th>Nome</th><th style="text-align:center; color:var(--accent);">Falta<br><input type="checkbox" id="checkMasterFalta"> Todas</th>`;
  regras.forEach(r => { thead += `<th style="text-align:center;">${r.descricao}<br><strong>+${r.pontos}</strong><br><input type="checkbox" class="checkMasterRegra" data-regra-id="${r.id}"> Todos</th>`; });
  thead += "</tr></thead>";

  let tbody = "<tbody>";
  atletas.forEach(a => {
    tbody += `<tr><td><strong>${a.nome}</strong></td><td style="text-align:center; background: rgba(243,112,33,0.05);"><input type="checkbox" class="check-falta" data-atleta-id="${a.id}" data-atleta-nome="${a.nome}" data-atleta-equipe="${a.equipe}"></td>`;
    regras.forEach(r => { tbody += `<td style="text-align:center;"><input type="checkbox" class="check-ponto" data-atleta-id="${a.id}" data-atleta-nome="${a.nome}" data-atleta-equipe="${a.equipe}" data-regra-id="${r.id}" data-regra-desc="${r.descricao}" data-pontos="${r.pontos}"></td>`; });
    tbody += `</tr>`;
  });
  tbody += "</tbody>"; tabela.innerHTML = thead + tbody;

  document.querySelectorAll(".checkMasterRegra").forEach(m => { m.addEventListener("change", (e) => { document.querySelectorAll(`.check-ponto[data-regra-id="${e.target.dataset.regraId}"]`).forEach(chk => { if(!chk.disabled) chk.checked = e.target.checked; }); }); });
  document.getElementById("checkMasterFalta").addEventListener("change", (e) => { document.querySelectorAll(".check-falta").forEach(chk => { chk.checked = e.target.checked; chk.dispatchEvent(new Event('change')); }); });
  document.querySelectorAll(".check-falta").forEach(chk => { chk.addEventListener("change", (e) => { e.target.closest("tr").querySelectorAll(".check-ponto").forEach(p => { p.disabled = e.target.checked; if(e.target.checked) p.checked = false; }); }); });
}

async function salvarPontuacoesEmLote() {
  const desc = document.getElementById("descTreino").value.trim(), data = document.getElementById("dataTreino").value;
  const eventoIdSelecionado = document.getElementById("lancarEventoSelect").value;
  const checksPontos = document.querySelectorAll(".check-ponto:checked"), checksFaltas = document.querySelectorAll(".check-falta:checked");
  
  if (checksPontos.length === 0 && checksFaltas.length === 0) return showToast("Nenhum lançamento!", "error");
  if (!confirm(`Confirmar lançamento no sistema?`)) return;
  const btn = document.getElementById("btnSalvarPontuacao"); btn.innerHTML = "Registrando Lote..."; btn.disabled = true;

  try {
    const batch = writeBatch(db); let pontosPorAtleta = {};
    for (let f of checksFaltas) { 
      batch.set(doc(collection(db, "historico_pontos")), { atletaId: f.dataset.atletaId, atletaNome: f.dataset.atletaNome, atletaEquipe: f.dataset.atletaEquipe, regraId: "falta_just", regraDesc: "Falta Justificada", pontos: 0, descTreino: desc, dataTreino: data, eventoId: eventoIdSelecionado, criadoEm: new Date().toISOString() }); 
    }
    for (let check of checksPontos) {
      const aId = check.dataset.atletaId; const pts = Number(check.dataset.pontos) || 0;
      batch.set(doc(collection(db, "historico_pontos")), { atletaId: aId, atletaNome: check.dataset.atletaNome, atletaEquipe: check.dataset.atletaEquipe, regraId: check.dataset.regraId, regraDesc: check.dataset.regraDesc, pontos: pts, descTreino: desc, dataTreino: data, eventoId: eventoIdSelecionado, criadoEm: new Date().toISOString() });
      if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0; pontosPorAtleta[aId] += pts;
    }
    for (let aId in pontosPorAtleta) { batch.update(doc(db, "atletas", aId), { pontuacaoTotal: increment(pontosPorAtleta[aId]) }); }
    await batch.commit();

    showToast("Sucesso!", "success");
    document.getElementById("areaTabelaPontuacao").style.display = "none"; document.getElementById("areaSelecaoRegras").style.display = "none";
    document.getElementById("btnGerarLista").style.display = "none"; 
    document.getElementById("descTreino").value = ""; 
    document.getElementById("lancarEventoSelect").value = "";
    atualizarTelas(); 
  } catch (error) { showToast("Erro ao salvar.", "error"); } finally { btn.innerHTML = `Salvar Lançamentos em Lote`; btn.disabled = false; }
}

async function carregarHistorico() {
  const snap = await getDocs(collection(db, "historico_pontos")); historicoCompleto = []; snap.forEach(d => { historicoCompleto.push({ id: d.id, ...d.data() }); });
  historicoCompleto.sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
  filtrarHistorico();
}

function filtrarHistorico() {
  const mes = document.getElementById("filtroMesHistorico").value; 
  const eq = document.getElementById("filtroEquipeHistorico").value; 
  const nomeBusca = document.getElementById("filtroNomeHistorico").value.toLowerCase();
  const statusFiltro = document.getElementById("filtroStatusHistorico").value;

  const dados = historicoCompleto.filter(h => { 
    const atleta = mapAtletas[h.atletaId]; 
    const isAtivo = atleta ? (atleta.ativo !== false) : false;
    if (statusFiltro === "ativos" && !isAtivo) return false;
    const nomeFiltro = h.atletaNome || (atleta ? atleta.nome : "");
    const eqFiltro = h.atletaEquipe || (atleta ? atleta.equipe : "");
    return (!mes || (h.dataTreino||"").startsWith(mes)) && (!eq || eqFiltro === eq) && (!nomeBusca || nomeFiltro.toLowerCase().includes(nomeBusca)); 
  });

  const tbody = document.getElementById("listaHistorico"); tbody.innerHTML = "";
  if (dados.length === 0) { tbody.innerHTML = `<tr><td colspan='6' style='text-align:center;'>Nenhum registro.</td></tr>`; return; }

  dados.forEach(h => {
    const atleta = mapAtletas[h.atletaId]; 
    let nomeDisplay = h.atletaNome || (atleta ? atleta.nome : "Desconhecido");
    let eqDisplay = h.atletaEquipe || (atleta ? atleta.equipe : "-");
    
    if (atleta && atleta.ativo === false) { nomeDisplay += " <small style='color:var(--danger); font-weight:bold;'>(Inativo)</small>"; } 
    else if (!atleta) { nomeDisplay += " <small style='color:#999; font-weight:bold;'>(Excluído)</small>"; }

    let ptsV = h.pontos === 0 ? `<span style="color:var(--accent);">Justificada</span>` : `+${h.pontos}`;
    const btnEstorno = (userRole === "admin") ? `<button class="btn-acao btn-estornar" data-id="${h.id}" data-atleta="${h.atletaId}" data-pontos="${h.pontos}" style="color:var(--danger); border-color:var(--danger);"><i data-lucide="undo-2" style="width:16px;"></i></button>` : '';
    tbody.innerHTML += `<tr><td>${(h.dataTreino?new Date(h.dataTreino+"T00:00:00").toLocaleDateString('pt-BR'):"-")}</td><td><strong>${nomeDisplay}</strong></td><td>${eqDisplay}</td><td>${h.descTreino}<br><small style="color:var(--primary);">${h.regraDesc}</small></td><td style="text-align:center; color:var(--secondary); font-weight:bold;">${ptsV}</td><td style="text-align:right;">${btnEstorno}</td></tr>`;
  });
  lucide.createIcons();
  
  document.querySelectorAll(".btn-estornar").forEach(btn => { btn.addEventListener("click", async (e) => { const histId = e.currentTarget.dataset.id, atlId = e.currentTarget.dataset.atleta, pts = parseInt(e.currentTarget.dataset.pontos); if(!confirm(`Estornar?`)) return; try { if (mapAtletas[atlId] && pts > 0) { await updateDoc(doc(db, "atletas", atlId), { pontuacaoTotal: increment(-pts) }); } await deleteDoc(doc(db, "historico_pontos", histId)); showToast("Estornado!", "success"); atualizarTelas(); } catch (err) { showToast("Erro.", "error"); } }); });
}

["filtroMesHistorico", "filtroEquipeHistorico", "filtroNomeHistorico", "filtroStatusHistorico"].forEach(id => { document.getElementById(id).addEventListener("input", filtrarHistorico); });
document.getElementById("btnLimparFiltrosExtrato").addEventListener("click", () => { document.getElementById("filtroMesHistorico").value = ""; document.getElementById("filtroEquipeHistorico").value = ""; document.getElementById("filtroNomeHistorico").value = ""; document.getElementById("filtroStatusHistorico").value = "ativos"; filtrarHistorico(); });

function setupRelatorioConsolidado() {
  document.getElementById("filtroAnoRelatorio").value = new Date().getFullYear();
  document.querySelector('[data-target="sub-relatorio"]').addEventListener("click", gerarRelatorioConsolidado);
  document.getElementById("btnGerarRelatorio").addEventListener("click", gerarRelatorioConsolidado);
  
  document.getElementById("btnExportarExcel").addEventListener("click", () => {
    const tbody = document.getElementById("listaRelatorio");
    if(tbody.innerText.includes("Clique em Filtrar") || tbody.innerText.includes("Nenhum atleta")) return showToast("Gere o relatório primeiro!", "error");
    
    const rows = document.getElementById("tabelaConsolidada").querySelectorAll("tr"); 
    let csv = "\uFEFF"; 
    rows.forEach(row => { 
      const cols = row.querySelectorAll("th, td"); 
      const rowData = Array.from(cols).map(c => `"${c.innerText.replace(/"/g, '""')}"`); 
      csv += rowData.join(";") + "\r\n"; 
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); 
    a.href = url; a.download = `Relatorio_Consolidado.csv`; a.click(); URL.revokeObjectURL(url);
  });
}

function gerarRelatorioConsolidado() {
  const ano = String(document.getElementById("filtroAnoRelatorio").value).trim(); const eqFiltro = document.getElementById("filtroEquipeRelatorio").value; const tbody = document.getElementById("listaRelatorio");
  const histAno = historicoCompleto.filter(h => h.dataTreino && h.dataTreino.startsWith(ano));
  let atletasRelatorio = Object.values(mapAtletas).filter(a => a.role === "atleta" && !a.equipe.startsWith("Fila") && a.equipe !== "Nenhuma");
  if (eqFiltro) atletasRelatorio = atletasRelatorio.filter(a => a.equipe === eqFiltro);
  if(atletasRelatorio.length === 0) { tbody.innerHTML = `<tr><td colspan='15' style='text-align:center;'>Nenhum atleta.</td></tr>`; return; }

  let html = "";
  atletasRelatorio.forEach(atleta => {
    atleta.totalAnoTemp = 0; atleta.ptsMesTemp = [0,0,0,0,0,0,0,0,0,0,0,0];
    histAno.filter(h => h.atletaId === atleta.id).forEach(l => { if(l.dataTreino && l.dataTreino.includes("-")) { const mesInt = parseInt(l.dataTreino.split("-")[1], 10); if(!isNaN(mesInt) && mesInt >= 1 && mesInt <= 12) { const pts = Number(l.pontos) || 0; atleta.ptsMesTemp[mesInt - 1] += pts; atleta.totalAnoTemp += pts; } } });
  });
  atletasRelatorio.sort((a, b) => b.totalAnoTemp - a.totalAnoTemp);
  atletasRelatorio.forEach(atleta => {
    let colunas = ""; atleta.ptsMesTemp.forEach(p => { colunas += `<td style="text-align: center; color: ${p > 0 ? 'var(--secondary)' : '#ccc'}; font-weight: ${p > 0 ? '600' : '400'};">${p}</td>`; });
    html += `<tr><td><strong>${atleta.nome}</strong></td><td><small>${atleta.equipe}</small></td>${colunas}<td style="text-align: center; font-weight: bold; color: var(--primary);">${atleta.totalAnoTemp}</td></tr>`;
  });
  tbody.innerHTML = html;
}

// =====================================================
// GESTÃO GERAL E ZONA DE PERIGO
// =====================================================
function setupLimparBase() {
  const btnL = document.getElementById("btnLimparBase"); if(!btnL) return;
  btnL.addEventListener("click", async () => {
    if (userRole !== "admin") return;
    if (prompt("CUIDADO EXTREMO! Isso apagará TODOS os atletas, regras e histórico.\nDigite 'LIMPAR' para confirmar:") !== "LIMPAR") return;
    if (!prompt("Digite sua senha de administrador para autorizar:")) return;
    const btn = document.getElementById("btnLimparBase"); btn.innerHTML = "Apagando a base..."; btn.disabled = true;
    try {
      const snapH = await getDocs(collection(db, "historico_pontos")); snapH.forEach(async (d) => { await deleteDoc(doc(db, "historico_pontos", d.id)); });
      const snapR = await getDocs(collection(db, "regras_pontuacao")); snapR.forEach(async (d) => { await deleteDoc(doc(db, "regras_pontuacao", d.id)); });
      const snapD = await getDocs(collection(db, "despesas")); snapD.forEach(async (d) => { await deleteDoc(doc(db, "despesas", d.id)); });
      const snapA = await getDocs(collection(db, "atletas")); snapA.forEach(async (d) => { if (d.id !== auth.currentUser.uid) await deleteDoc(doc(db, "atletas", d.id)); });
      showToast("Base Limpa com sucesso!", "success"); setTimeout(() => window.location.reload(), 2000); 
    } catch(err) { showToast("Erro ao apagar.", "error"); btn.disabled = false; }
  });
}

async function setupAprovacoes() {
  const tbody = document.getElementById("listaAprovacoes"); if (!tbody) return;
  const snap = await getDocs(query(collection(db, "atletas"), where("status", "==", "Pendente"))); tbody.innerHTML = "";
  if (snap.empty) { tbody.innerHTML = "<tr><td colspan='4'>Nenhuma pendência.</td></tr>"; return; }
  snap.forEach(d => { const u = d.data(); tbody.innerHTML += `<tr><td><strong>${u.nome}</strong></td><td>${u.email}</td><td>Acesso ao Comitê</td><td><button class="btn-acao btn-aprovar" data-id="${d.id}" style="color:var(--secondary); border-color:var(--secondary); margin-right:5px;">Aprovar</button><button class="btn-acao btn-rejeitar" data-id="${d.id}" style="color:var(--danger); border-color:var(--danger);">Rejeitar</button></td></tr>`; });
  document.querySelectorAll(".btn-aprovar").forEach(btn => btn.addEventListener("click", async (e) => { if(confirm("Aprovar?")) { await updateDoc(doc(db, "atletas", e.currentTarget.dataset.id), { status: "Aprovado" }); atualizarTelas(); } }));
  document.querySelectorAll(".btn-rejeitar").forEach(btn => btn.addEventListener("click", async (e) => { if(confirm("Rejeitar?")) { await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); atualizarTelas(); } }));
}

function setupCadastrarPessoa() {
  document.getElementById("btnCadastrarPessoa").addEventListener("click", async (e) => {
    const nome = document.getElementById("novoNome").value.trim(), email = document.getElementById("novoEmail").value.trim(), papel = document.getElementById("novoPapel").value, btn = e.target;
    if (!nome) return showToast("Por favor, preencha o nome!", "error");
    let role = "atleta"; let equipe = papel; 
    try {
      btn.textContent = "Salvando..."; btn.disabled = true;
      await addDoc(collection(db, "atletas"), { nome: nome, email: email, role: role, equipe: equipe, status: "Aprovado", ativo: true, pontuacaoTotal: 0, recusas: 0, criadoEm: new Date().toISOString() });
      showToast(`${nome} adicionado!`, "success"); document.getElementById("novoNome").value = ""; document.getElementById("novoEmail").value = ""; btn.textContent = "Adicionar"; btn.disabled = false; atualizarTelas(); 
    } catch (error) { showToast("Erro.", "error"); btn.textContent = "Adicionar"; btn.disabled = false; }
  });
}

async function carregarRegras() {
  const tbody = document.getElementById("listaRegras"); const snap = await getDocs(collection(db, "regras_pontuacao")); tbody.innerHTML = "";
  if (snap.empty) { tbody.innerHTML = `<tr><td colspan='4'>Nenhuma regra.</td></tr>`; return; }
  snap.forEach(d => { const r = d.data(); const btnExcluir = (userRole === "admin") ? `<button class="btn-acao btn-excluir-regra" data-id="${d.id}" style="color:var(--danger); border-color:var(--danger);"><i data-lucide="trash" style="width:16px;"></i></button>` : ''; tbody.innerHTML += `<tr><td><strong>${r.descricao}</strong></td><td>${r.modalidade}</td><td><strong style="color:var(--primary);">+ ${r.pontos}</strong></td><td style="text-align:center;">${btnExcluir}</td></tr>`; });
  lucide.createIcons();
  document.querySelectorAll(".btn-excluir-regra").forEach(btn => { btn.addEventListener("click", async (e) => { if(confirm("Apagar regra?")) { await deleteDoc(doc(db, "regras_pontuacao", e.currentTarget.dataset.id)); carregarRegras(); } }); });
}

function setupModalRegras() {
  const modal = document.getElementById("modalRegra");
  if(document.getElementById("abrirModalRegra")) document.getElementById("abrirModalRegra").addEventListener("click", () => modal.style.display = "flex");
  document.getElementById("fecharModalRegra").addEventListener("click", () => modal.style.display = "none");
  document.getElementById("salvarRegraBtn").addEventListener("click", async () => {
    if (userRole !== "admin") return;
    const desc = document.getElementById("regraDescricao").value.trim(), mod = document.getElementById("regraModalidade").value, pts = document.getElementById("regraPontos").value.trim();
    if (!desc || !pts) return;
    await addDoc(collection(db, "regras_pontuacao"), { descricao: desc, modalidade: mod, pontos: Number(pts), criadoEm: new Date().toISOString() });
    modal.style.display = "none"; document.getElementById("regraDescricao").value = ""; document.getElementById("regraPontos").value = ""; showToast("Regra criada!", "success"); carregarRegras();
  });
}

function setupModalEditar() {
  const modal = document.getElementById("modalEditarAtleta");
  document.getElementById("fecharModalEdit").addEventListener("click", () => modal.style.display = "none");
  document.getElementById("salvarEditBtn").addEventListener("click", async () => {
    const id = document.getElementById("editId").value, nome = document.getElementById("editNome").value.trim(), email = document.getElementById("editEmail").value.trim(), papel = document.getElementById("editPapel").value;
    if (!nome) return; let role = "atleta"; let equipe = papel; if (papel === "Comitê") { role = "comite"; equipe = "Nenhuma"; }
    try { await updateDoc(doc(db, "atletas", id), { nome: nome, email: email, role: role, equipe: equipe }); showToast("Atualizado!", "success"); modal.style.display = "none"; atualizarTelas(); } catch (err) { showToast("Erro.", "error"); }
  });
}

function setupConfiguracoes() {
  document.querySelectorAll(".btn-zoom").forEach(btn => { btn.addEventListener("click", (e) => { document.documentElement.style.fontSize = e.target.dataset.size; }); });
  const aplicarTema = (tema) => { if(tema === "dark") { document.body.setAttribute("data-theme", "dark"); localStorage.setItem("theme", "dark"); } else { document.body.removeAttribute("data-theme"); localStorage.setItem("theme", "light"); } Chart.defaults.color = tema === 'dark' ? '#aaa' : '#666'; if(graficoLinhaInstancia) graficoLinhaInstancia.update(); if(graficoEngajBike) graficoEngajBike.update(); if(graficoEngajCorrida) graficoEngajCorrida.update(); };
  if (localStorage.getItem("theme") === "dark") aplicarTema("dark");
  document.getElementById("btnTemaClaro").addEventListener("click", () => aplicarTema("light")); document.getElementById("btnTemaEscuro").addEventListener("click", () => aplicarTema("dark"));

  document.getElementById("btnSalvarConta").addEventListener("click", async () => {
    const senhaAtual = document.getElementById("confSenhaAtual").value, novoEmail = document.getElementById("confNovoEmail").value.trim(), novaSenha = document.getElementById("confNovaSenha").value.trim(), btn = document.getElementById("btnSalvarConta");
    if(!senhaAtual) return showToast("A senha atual é obrigatória.", "error"); if(!novoEmail && !novaSenha) return;
    btn.textContent = "Autenticando..."; btn.disabled = true;
    try {
      const user = auth.currentUser; const credential = EmailAuthProvider.credential(user.email, senhaAtual); await reauthenticateWithCredential(user, credential);
      btn.textContent = "Salvando..."; if(novoEmail) { await updateEmail(user, novoEmail); } if(novaSenha) { await updatePassword(user, novaSenha); }
      showToast("Conta atualizada!", "success"); document.getElementById("confSenhaAtual").value = ""; document.getElementById("confNovoEmail").value = ""; document.getElementById("confNovaSenha").value = "";
    } catch(err) { showToast("Erro.", "error"); } btn.innerHTML = `Salvar Alterações`; btn.disabled = false;
  });
}
