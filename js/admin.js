import { 
  auth, db, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc,
  onAuthStateChanged, signOut, query, where, orderBy, writeBatch, increment,
  updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "./firebase.js";

let userRole = "atleta";
let userPermissoes = [];
let historicoCompleto = []; 
let historicoFinanceiro = []; 
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
// 🔒 INICIALIZAÇÃO E PERMISSÕES
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
  setupSubTabs(); setupCadastrarPessoa(); setupContabilizacao(); setupRelatorioConsolidado(); setupFinanceiroPlanilha(); setupPermissoesModal(); setupAgenda(); setupConfiguracoes(); setupModalRegras(); setupModalEditar(); setupLimparBase(); setupFichaAtleta();
  atualizarTelas();
}

function setupSubTabs() {
  document.querySelectorAll(".sub-tab").forEach(tab => { tab.addEventListener("click", () => { const p = tab.closest('section'); p.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active")); p.querySelectorAll(".sub-content").forEach(c => c.classList.remove("active")); tab.classList.add("active"); document.getElementById(tab.dataset.target).classList.add("active"); }); });
  document.querySelectorAll(".t-tab").forEach(tab => { tab.addEventListener("click", () => { const p = tab.closest('.sub-content'); p.querySelectorAll(".t-tab").forEach(t => t.classList.remove("active")); p.querySelectorAll(".t-content").forEach(c => c.classList.remove("active")); tab.classList.add("active"); document.getElementById(tab.dataset.target).classList.add("active"); }); });
}

async function atualizarTelas() {
  if (userRole === "admin" || userPermissoes.includes("gestao")) setupAprovacoes();
  await carregarAgenda(); 
  
  const snapA = await getDocs(query(collection(db, "atletas"), where("status", "==", "Aprovado")));
  mapAtletas = {}; snapA.forEach(d => { mapAtletas[d.id] = { id: d.id, ...d.data() }; });

  await carregarHistorico(); 
  await carregarEquipesEDashboard(); 
  await carregarFinanceiroPlanilha(); 
  await carregarRegras();
}

// =====================================================
// 📊 DASHBOARD & GERADOR DE PDF BI 
// =====================================================
document.getElementById("btnExportarPDF").addEventListener("click", () => {
  showToast("Montando painel corporativo...", "info");
  
  const temaAtual = document.body.getAttribute("data-theme");
  if (temaAtual === "dark") { document.body.removeAttribute("data-theme"); Chart.defaults.color = '#666'; if(graficoLinhaInstancia) graficoLinhaInstancia.update(); }

  setTimeout(() => {
    document.getElementById("pdfDataHoje").textContent = new Date().toLocaleDateString('pt-BR');
    
    if(document.getElementById("pdfAtivos")) document.getElementById("pdfAtivos").textContent = document.getElementById("totalAtivosGeral").textContent;
    if(document.getElementById("pdfEngajamento")) document.getElementById("pdfEngajamento").textContent = document.getElementById("engajamento30d").textContent;
    if(document.getElementById("pdfInvest")) document.getElementById("pdfInvest").textContent = document.getElementById("totalInvestimento").textContent;
    if(document.getElementById("pdfRoi")) document.getElementById("pdfRoi").textContent = document.getElementById("roiAtleta").textContent;
    
    if(document.getElementById("pdfMediaBike")) document.getElementById("pdfMediaBike").textContent = document.getElementById("mediaBike").textContent;
    if(document.getElementById("pdfMediaCorrida")) document.getElementById("pdfMediaCorrida").textContent = document.getElementById("mediaCorrida").textContent;
    
    if(document.getElementById("pdfTopBike")) document.getElementById("pdfTopBike").innerHTML = document.getElementById("listaPodioBike").innerHTML;
    if(document.getElementById("pdfTopCorrida")) document.getElementById("pdfTopCorrida").innerHTML = document.getElementById("listaPodioCorrida").innerHTML;
    
    if(document.getElementById("pdfListaEvasao")) {
       document.getElementById("pdfListaEvasao").innerHTML = document.getElementById("listaEvasaoBike").innerHTML + document.getElementById("listaEvasaoCorrida").innerHTML;
    }

    const agendaClone = document.getElementById("listaEventosAgenda").cloneNode(true);
    agendaClone.querySelectorAll("button").forEach(b => b.remove()); 
    if(document.getElementById("pdfProximosEventos")) document.getElementById("pdfProximosEventos").innerHTML = agendaClone.innerHTML;

    const eventosPassados = {};
    historicoCompleto.forEach(h => {
      if(!h.dataTreino || !h.descTreino || h.descTreino.toLowerCase().includes("falta")) return;
      const key = `${h.dataTreino}::${h.descTreino}`;
      if(!eventosPassados[key]) eventosPassados[key] = { data: h.dataTreino, desc: h.descTreino, atletas: new Set() };
      eventosPassados[key].atletas.add(h.atletaId);
    });
    
    const listaUltimos = Object.values(eventosPassados).sort((a,b) => new Date(b.data || "1970-01-01") - new Date(a.data || "1970-01-01")).slice(0, 4);
    let htmlUltimos = "";
    listaUltimos.forEach(e => {
       const d = new Date(e.data + "T00:00:00").toLocaleDateString('pt-BR').substring(0,5);
       htmlUltimos += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; border-bottom:1px solid #f5f5f5; padding-bottom:4px;"><span style="color:#666;"><strong>${d}</strong> - ${e.desc}</span><strong style="color:var(--primary);">${e.atletas.size} 👤</strong></div>`;
    });
    if(document.getElementById("pdfUltimosEventos")) document.getElementById("pdfUltimosEventos").innerHTML = htmlUltimos || "<p style='color:#999; text-align:center;'>Nenhum evento processado.</p>";

    const canvasLinha = document.getElementById('graficoTendencia');
    const widthOriginal = canvasLinha.style.width; const heightOriginal = canvasLinha.style.height;
    if(canvasLinha) { canvasLinha.style.width = '700px'; canvasLinha.style.height = '200px'; if(graficoLinhaInstancia) graficoLinhaInstancia.resize(); document.getElementById('pdfImgTendencia').src = canvasLinha.toDataURL("image/png", 1.0); }

    const modalPdf = document.getElementById("pdfOverlay"); const printArea = document.getElementById("pdfPrintArea");
    modalPdf.style.display = "flex";

    setTimeout(() => {
      const opt = { margin: 0, filename: `Report_Atletas_${document.getElementById("pdfDataHoje").textContent.replace(/\//g, '-')}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } };
      html2pdf().set(opt).from(printArea).save().then(() => { 
        modalPdf.style.display = "none"; 
        if(canvasLinha) { canvasLinha.style.width = widthOriginal; canvasLinha.style.height = heightOriginal; if(graficoLinhaInstancia) graficoLinhaInstancia.resize(); }
        if (temaAtual === "dark") { document.body.setAttribute("data-theme", "dark"); Chart.defaults.color = '#aaa'; if(graficoLinhaInstancia) graficoLinhaInstancia.update(); }
        showToast("Download Concluído!", "success"); 
      });
    }, 600);
  }, 150); 
});

// =====================================================
// 💰 NOVO FINANCEIRO (HÍBRIDO: CATEGORIAS + PLANILHA)
// =====================================================
function setupFinanceiroPlanilha() {
  const modal = document.getElementById("modalLinhaVerba");
  const canEdit = userRole === "admin" || userPermissoes.includes("financeiro_edit");
  
  if(document.getElementById("areaAcoesFinanceiro")) {
      document.getElementById("areaAcoesFinanceiro").style.display = canEdit ? "block" : "none";
  }

  const chkAvulso = document.getElementById("checkAvulso");
  const areaProposto = document.getElementById("areaProposto");
  if(chkAvulso) {
    chkAvulso.addEventListener("change", (e) => {
      if(e.target.checked) {
         areaProposto.style.opacity = "0.3";
         areaProposto.style.pointerEvents = "none";
         document.getElementById("vPropInsc").value = ""; document.getElementById("vPropTransp").value = ""; document.getElementById("vPropHosp").value = ""; document.getElementById("vPropAlim").value = ""; document.getElementById("vPropDemais").value = "";
      } else {
         areaProposto.style.opacity = "1";
         areaProposto.style.pointerEvents = "auto";
      }
    });
  }

  if (document.getElementById("btnAbrirModalDespesa")) {
    document.getElementById("btnAbrirModalDespesa").addEventListener("click", () => {
      document.getElementById("verbaEditId").value = "";
      document.getElementById("verbaCategoria").value = "Provas / Inscrições";
      document.getElementById("verbaEquipe").value = "Corrida e Bike";
      document.getElementById("verbaEvento").value = "";
      
      if(chkAvulso) { chkAvulso.checked = false; chkAvulso.dispatchEvent(new Event('change')); }
      document.getElementById("vPropInsc").value = ""; document.getElementById("vPropTransp").value = ""; document.getElementById("vPropHosp").value = ""; document.getElementById("vPropAlim").value = ""; document.getElementById("vPropDemais").value = "";
      document.getElementById("vRealizadoTotal").value = "";
      modal.style.display = "flex";
    });
  }

  document.getElementById("fecharModalVerba")?.addEventListener("click", () => modal.style.display = "none");

  document.getElementById("salvarVerbaBtn")?.addEventListener("click", async (e) => {
    const idEdit = document.getElementById("verbaEditId").value;
    const cat = document.getElementById("verbaCategoria").value;
    const eq = document.getElementById("verbaEquipe").value;
    const ev = document.getElementById("verbaEvento").value.trim();
    
    if(!ev) return showToast("Informe o Título/Evento!", "error");

    const p = (id) => parseFloat(document.getElementById(id).value) || 0;
    
    let propInsc = 0, propTransp = 0, propHosp = 0, propAlim = 0, propDemais = 0, totalProp = 0;
    
    if(chkAvulso && !chkAvulso.checked) {
       propInsc = p("vPropInsc"); propTransp = p("vPropTransp"); propHosp = p("vPropHosp"); propAlim = p("vPropAlim"); propDemais = p("vPropDemais");
       totalProp = propInsc + propTransp + propHosp + propAlim + propDemais;
    }
    
    const totalRealizado = p("vRealizadoTotal");
    const desvio = totalProp - totalRealizado;

    // Salvando na coleção 'despesas' que já tem regras de segurança autorizadas!
    const dados = {
      categoria: cat, equipe: eq, evento: ev, avulso: chkAvulso ? chkAvulso.checked : false,
      propInsc: propInsc, propTransp: propTransp, propHosp: propHosp, propAlim: propAlim, propDemais: propDemais,
      totalProposto: totalProp, totalRealizado: totalRealizado, desvio: desvio,
      atualizadoEm: new Date().toISOString()
    };

    e.target.textContent = "Salvando..."; e.target.disabled = true;
    try {
      if(idEdit) { 
          await updateDoc(doc(db, "despesas", idEdit), dados); 
          showToast("Linha atualizada!", "success"); 
      } else { 
          dados.criadoEm = new Date().toISOString(); 
          await addDoc(collection(db, "despesas"), dados); 
          showToast("Linha adicionada!", "success"); 
      }
      modal.style.display = "none"; 
      carregarFinanceiroPlanilha();
    } catch(err) { 
      console.error("Erro Firebase:", err);
      showToast("Erro ao gravar! " + err.message, "error"); 
    }
    e.target.textContent = "Salvar na Planilha"; e.target.disabled = false;
  });

  document.getElementById("btnExportarFinExcel")?.addEventListener("click", exportarFinanceiroPlanilha);
}

async function carregarFinanceiroPlanilha() {
  // Puxa da coleção "despesas" para garantir compatibilidade e não estourar Index no Firebase
  const snap = await getDocs(collection(db, "despesas"));
  
  let tempDocs = [];
  snap.forEach(d => tempDocs.push({id: d.id, ...d.data()}));
  
  // Ordena via Javascript para não causar falha no 'orderBy' do Firestore
  tempDocs.sort((a, b) => new Date(a.criadoEm || a.dataBase || 0) - new Date(b.criadoEm || b.dataBase || 0));
  historicoFinanceiro = tempDocs;

  let htmlMaster = "";
  let resumoEquipes = { Corrida: { prop: 0, real: 0 }, Bike: { prop: 0, real: 0 }, Ambas: { prop: 0, real: 0 } };
  let resumoCategorias = { 
    "Provas / Inscrições": { prop: 0, real: 0, color: "var(--secondary)" },
    "Mensalidade Treinador": { prop: 0, real: 0, color: "#3498db" },
    "Encontros e Eventos": { prop: 0, real: 0, color: "#f39c12" },
    "Uniformes e Materiais": { prop: 0, real: 0, color: "var(--primary)" },
    "Outros": { prop: 0, real: 0, color: "#95a5a6" }
  };

  let globalProp = 0; let globalReal = 0;
  const canEdit = userRole === "admin" || userPermissoes.includes("financeiro_edit");
  const num = (v) => (v||0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const moneyStr = (v) => v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  historicoFinanceiro.forEach(v => {
    // Compatibilidade com as despesas antigas já gravadas
    const equipe = v.equipe || "Ambas";
    const categoria = v.categoria || "Outros";
    const evento = v.evento || v.descricao || "Custo Antigo";
    const totalProp = v.totalProposto || v.orcadoTotal || 0;
    const totalReal = v.totalRealizado || 0;
    const desvio = v.desvio !== undefined ? v.desvio : (totalProp - totalReal);

    globalProp += totalProp;
    globalReal += totalReal;

    if(equipe === "Corrida") { resumoEquipes.Corrida.prop += totalProp; resumoEquipes.Corrida.real += totalReal; }
    else if(equipe === "Bicicleta" || equipe === "Bike") { resumoEquipes.Bike.prop += totalProp; resumoEquipes.Bike.real += totalReal; }
    else { resumoEquipes.Ambas.prop += totalProp; resumoEquipes.Ambas.real += totalReal; }

    if(resumoCategorias[categoria]) {
        resumoCategorias[categoria].prop += totalProp;
        resumoCategorias[categoria].real += totalReal;
    } else {
        resumoCategorias["Outros"].prop += totalProp;
        resumoCategorias["Outros"].real += totalReal;
    }

    const isAvulso = v.avulso ? `<span title="Lançamento Não Previsto" style="color:var(--accent); font-size:0.75rem; font-weight:bold;">[AVULSO]</span>` : "";
    const corDesvio = desvio < 0 ? "color: var(--danger); font-weight:bold;" : "color: var(--secondary);";
    const bgReal = totalReal > 0 ? "background: rgba(39, 174, 96, 0.05);" : "";
    let btnAcoes = "";
    if(canEdit) { btnAcoes = `<button class="btn-acao btn-edit-verba" data-id="${v.id}" style="color:var(--primary); padding:4px;"><i data-lucide="edit-2" style="width:14px;"></i></button> <button class="btn-acao btn-del-verba" data-id="${v.id}" style="color:var(--danger); padding:4px;"><i data-lucide="trash" style="width:14px;"></i></button>`; }

    htmlMaster += `
      <tr>
        <td><small style="font-weight:600;">${equipe}</small></td>
        <td><span style="font-size:0.75rem; color:var(--text-light); background:var(--border); padding:2px 6px; border-radius:4px;">${categoria}</span></td>
        <td><strong>${evento}</strong> ${isAvulso}</td>
        <td>${v.propInsc > 0 ? num(v.propInsc) : '-'}</td>
        <td>${v.propTransp > 0 ? num(v.propTransp) : '-'}</td>
        <td>${v.propHosp > 0 ? num(v.propHosp) : '-'}</td>
        <td>${v.propAlim > 0 ? num(v.propAlim) : '-'}</td>
        <td>${v.propDemais > 0 ? num(v.propDemais) : '-'}</td>
        <td style="font-weight:600; background: rgba(0,0,0,0.02);">${num(totalProp)}</td>
        <td style="font-weight:600; color: #27ae60; ${bgReal}">${num(totalReal)}</td>
        <td style="${corDesvio}">${num(desvio)}</td>
        <td style="text-align:right; white-space:nowrap;">${btnAcoes}</td>
      </tr>
    `;
  });

  if(document.getElementById("tabelaMasterFin")) document.getElementById("tabelaMasterFin").innerHTML = htmlMaster || `<tr><td colspan='12' style='text-align:center;'>Nenhum planejamento registrado.</td></tr>`;

  gastoTotalGlobal = globalReal || 0; 
  if(document.getElementById("totalInvestimento")) document.getElementById("totalInvestimento").textContent = moneyStr(globalReal);
  if(document.getElementById("dashFinOrcadoTotal")) document.getElementById("dashFinOrcadoTotal").textContent = moneyStr(globalProp);
  if(document.getElementById("dashFinRealizadoTotal")) document.getElementById("dashFinRealizadoTotal").textContent = moneyStr(globalReal);
  if(document.getElementById("dashFinSaldoTotal")) {
    const desvioTotal = globalProp - globalReal;
    const el = document.getElementById("dashFinSaldoTotal");
    el.textContent = moneyStr(desvioTotal); 
    
    // Altera a cor do texto do Saldo
    el.style.color = desvioTotal < 0 ? 'var(--danger)' : 'var(--secondary)';
    
    // Altera a cor da margem (borda) esquerda do Card do Saldo
    if (el.parentElement) {
      el.parentElement.style.borderLeftColor = desvioTotal < 0 ? 'var(--danger)' : 'var(--secondary)';
    }
  }

  // Tabela Consolidada Excel
  let htmlResumo = "";
  const arrResumo = [{nome: "Corrida", data: resumoEquipes.Corrida}, {nome: "Bicicleta", data: resumoEquipes.Bike}, {nome: "Equipe Geral (Ambas)", data: resumoEquipes.Ambas}];
  arrResumo.forEach(r => {
    if(r.data.prop > 0 || r.data.real > 0) {
      const desvioEquipe = r.data.prop - r.data.real;
      const cor = desvioEquipe < 0 ? "color:var(--danger);" : "color:var(--secondary);";
      htmlResumo += `<tr><td><strong>${r.nome}</strong></td><td>R$ ${num(r.data.prop)}</td><td style="color:var(--danger); font-weight:bold;">R$ ${num(r.data.real)}</td><td style="font-weight:bold; ${cor}">R$ ${num(desvioEquipe)}</td></tr>`;
    }
  });
  if(document.getElementById("tabelaResumoEquipes")) document.getElementById("tabelaResumoEquipes").innerHTML = htmlResumo || `<tr><td colspan='4'>Sem dados processados.</td></tr>`;
  
  // Progresso de Categorias Estratégicas
  let htmlCategorias = "";
  Object.keys(resumoCategorias).forEach(nomeCat => {
     const c = resumoCategorias[nomeCat];
     if(c.prop > 0 || c.real > 0) {
         const perc = c.prop > 0 ? Math.min((c.real / c.prop) * 100, 100) : 100;
         const corBarra = (c.real > c.prop && c.prop > 0) || (c.prop === 0 && c.real > 0) ? "var(--danger)" : c.color;
         htmlCategorias += `
          <div class="card" style="margin:0; padding:15px; border-left: 4px solid ${c.color};">
             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><strong style="color:var(--text); font-size:0.9rem;">${nomeCat}</strong></div>
             <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:5px;"><span style="color:#666;">Proposto: ${moneyStr(c.prop)}</span><span style="color:${c.color}; font-weight:bold;">Real: ${moneyStr(c.real)}</span></div>
             <div class="progress-bar-bg" style="height:6px; margin-bottom:5px;"><div class="progress-bar-fill" style="width: ${perc}%; background: ${corBarra};"></div></div>
             <div style="text-align:right; font-size:0.75rem; color:#999;">Desvio: <strong style="${c.prop - c.real < 0 ? 'color:var(--danger)' : ''}">${moneyStr(c.prop - c.real)}</strong></div>
          </div>`;
     }
  });
  if(document.getElementById("listaPotesOrcamento")) document.getElementById("listaPotesOrcamento").innerHTML = htmlCategorias || `<p style='color:#999; font-size:0.85rem;'>Sem desdobramento orçamentário.</p>`;

  lucide.createIcons();

  document.querySelectorAll(".btn-del-verba").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if(confirm("Excluir linha permanentemente?")) { e.currentTarget.disabled = true; await deleteDoc(doc(db, "despesas", e.currentTarget.dataset.id)); carregarFinanceiroPlanilha(); }
    });
  });

  document.querySelectorAll(".btn-edit-verba").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.id; const v = historicoFinanceiro.find(x => x.id === id); if(!v) return;
      document.getElementById("verbaEditId").value = v.id; 
      document.getElementById("verbaCategoria").value = v.categoria || "Outros"; 
      document.getElementById("verbaEquipe").value = v.equipe || "Corrida e Bike"; 
      document.getElementById("verbaEvento").value = v.evento || v.descricao || "";
      
      const chkAvulso = document.getElementById("checkAvulso");
      if(chkAvulso) { chkAvulso.checked = v.avulso === true; chkAvulso.dispatchEvent(new Event('change')); }

      document.getElementById("vPropInsc").value = v.propInsc || ""; 
      document.getElementById("vPropTransp").value = v.propTransp || ""; 
      document.getElementById("vPropHosp").value = v.propHosp || ""; 
      document.getElementById("vPropAlim").value = v.propAlim || ""; 
      document.getElementById("vPropDemais").value = v.propDemais || "";
      document.getElementById("vRealizadoTotal").value = v.totalRealizado || "";
      document.getElementById("modalLinhaVerba").style.display = "flex";
    });
  });
}

function exportarFinanceiroPlanilha() {
  if(historicoFinanceiro.length === 0) return showToast("Nenhuma linha para exportar.", "error");
  let csv = "\uFEFFEquipe;Categoria;Evento_Custo;Tipo;Inscrições;Transporte;Hospedagem;Alimentação;Demais Custos;Total Proposto;Total Realizado;Desvio\r\n";
  historicoFinanceiro.forEach(v => {
    const n = (val) => (val || 0).toFixed(2).replace('.', ',');
    const tipo = v.avulso ? "Avulso" : "Planejado";
    let linha = [ v.equipe || "Ambas", v.categoria || "-", v.evento || v.descricao, tipo, n(v.propInsc), n(v.propTransp), n(v.propHosp), n(v.propAlim), n(v.propDemais), n(v.totalProposto || v.orcadoTotal), n(v.totalRealizado), n(v.desvio !== undefined ? v.desvio : ((v.totalProposto||v.orcadoTotal||0) - (v.totalRealizado||0))) ];
    csv += linha.map(col => `"${String(col).replace(/"/g, '""')}"`).join(";") + "\r\n";
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `Controle_Orcamentario_Atletas.csv`; a.click(); URL.revokeObjectURL(url);
}


// =====================================================
// 📅 AGENDA E EVENTOS
// =====================================================
function setupAgenda() {
  const modal = document.getElementById("modalEvento");
  if(document.getElementById("abrirModalEvento")) document.getElementById("abrirModalEvento").addEventListener("click", () => modal.style.display = "flex");
  if(document.getElementById("fecharModalEvento")) document.getElementById("fecharModalEvento").addEventListener("click", () => modal.style.display = "none");
  if(document.getElementById("salvarEventoBtn")) document.getElementById("salvarEventoBtn").addEventListener("click", async (e) => {
    const titulo = document.getElementById("eventoTitulo").value.trim(), local = document.getElementById("eventoLocal").value.trim(), mod = document.getElementById("eventoModalidade").value, data = document.getElementById("eventoData").value;
    if (!titulo || !data) return showToast("Título e Data são obrigatórios!", "error");
    e.target.textContent = "Salvando..."; e.target.disabled = true;
    await addDoc(collection(db, "agenda_eventos"), { titulo: titulo, local: local, modalidade: mod, data: data, criadoEm: new Date().toISOString() });
    modal.style.display = "none"; document.getElementById("eventoTitulo").value = ""; document.getElementById("eventoLocal").value = ""; showToast("Evento agendado!", "success"); 
    e.target.textContent = "Salvar Evento"; e.target.disabled = false; atualizarTelas();
  });
}

async function carregarAgenda() {
  const snap = await getDocs(query(collection(db, "agenda_eventos")));
  cacheEventos = []; snap.forEach(d => cacheEventos.push({id: d.id, ...d.data()}));
  cacheEventos.sort((a,b) => new Date(a.data) - new Date(b.data)); 
  
  const htmlDropdown = '<option value="">Nenhum (Lançamento Avulso)</option>' + cacheEventos.map(e => `<option value="${e.id}">${e.titulo} (${new Date(e.data+"T00:00:00").toLocaleDateString('pt-BR')})</option>`).join('');
  if(document.getElementById("lancarEventoSelect")) document.getElementById("lancarEventoSelect").innerHTML = htmlDropdown;

  const hoje = new Date().toISOString().split('T')[0];
  const futuros = cacheEventos.filter(e => e.data >= hoje).slice(0, 4); 
  let html = "";
  const hasGestao = userRole === "admin" || userPermissoes.includes("gestao");
  
  futuros.forEach(e => {
    const d = new Date(e.data + "T00:00:00"); const mes = d.toLocaleString('pt-BR', {month: 'short'}).replace('.',''); const dia = d.getDate().toString().padStart(2, '0');
    let icon = e.modalidade === "Bicicleta" ? "🚴" : e.modalidade === "Corrida" ? "🏃" : "🤝";
    const btnExcluir = hasGestao ? `<button class="btn-excluir-evento" data-id="${e.id}" style="background:transparent; border:none; color:var(--danger); cursor:pointer; float:right;"><i data-lucide="x" style="width:16px;"></i></button>` : '';
    html += `<div class="agenda-item"><div class="agenda-data"><span>${mes}</span><strong>${dia}</strong></div><div class="agenda-info" style="flex:1;">${btnExcluir}<h4>${e.titulo}</h4><p>${icon} ${e.local}</p></div></div>`;
  });
  if(document.getElementById("listaEventosAgenda")) document.getElementById("listaEventosAgenda").innerHTML = html || `<div class="empty-state" style="padding:10px;"><p style="font-size:0.85rem;">Nenhum evento agendado.</p></div>`;
  lucide.createIcons();
  document.querySelectorAll(".btn-excluir-evento").forEach(btn => { btn.addEventListener("click", async (e) => { if(confirm("Cancelar evento?")) { await deleteDoc(doc(db, "agenda_eventos", e.currentTarget.dataset.id)); atualizarTelas(); } }); });
}

// =====================================================
// 👥 EQUIPES E DASHBOARD C-LEVEL
// =====================================================
async function carregarEquipesEDashboard() {
  let htmlFilaBike = "", htmlFilaCorrida = "", htmlBike = "", htmlCorrida = "", htmlComite = "";
  let contFila = 0, contBike = 0, contCorrida = 0, contComite = 0, ptsBike = 0, ptsCorrida = 0;
  let todosAtletas = []; 

  let listaOrdenada = Object.values(mapAtletas);
  const filaEspera = listaOrdenada.filter(u => u.equipe === "Fila - Bicicleta" || u.equipe === "Fila - Corrida" || u.equipe === "Fila de Espera");
  const titulares = listaOrdenada.filter(u => u.equipe !== "Fila - Bicicleta" && u.equipe !== "Fila - Corrida" && u.equipe !== "Fila de Espera");
  
  filaEspera.sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0));
  titulares.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));

  const hasGestao = userRole === "admin" || userPermissoes.includes("gestao");

  let idxBike = 1, idxCorrida = 1;
  filaEspera.forEach((u) => {
    const strikes = u.recusas || 0; const badgeStrike = strikes > 0 ? `<span class="strike-badge">⚠️ ${strikes}/3</span>` : '';
    let acoesHTML = "";
    if(hasGestao) { acoesHTML = `<button class="btn-acao btn-aprovar-fila" data-id="${u.id}" data-eq="${u.equipe === 'Fila - Corrida' ? 'Corrida' : 'Bicicleta'}" style="color:var(--secondary); padding:4px;"><i data-lucide="check" style="width:16px;"></i></button> <button class="btn-acao btn-pular-fila" data-id="${u.id}" data-strikes="${strikes}" style="color:#f39c12; padding:4px;"><i data-lucide="skip-forward" style="width:16px;"></i></button>`; }
    if(u.equipe === "Fila - Bicicleta" || u.equipe === "Fila de Espera") { htmlFilaBike += `<tr><td><strong>${idxBike}º - ${u.nome}</strong> ${badgeStrike}</td><td style="text-align: right; display:flex; justify-content:flex-end; gap:5px;">${acoesHTML}</td></tr>`; idxBike++; contFila++; } 
    if (u.equipe === "Fila - Corrida") { htmlFilaCorrida += `<tr><td><strong>${idxCorrida}º - ${u.nome}</strong> ${badgeStrike}</td><td style="text-align: right; display:flex; justify-content:flex-end; gap:5px;">${acoesHTML}</td></tr>`; idxCorrida++; contFila++; }
  });

  titulares.forEach(u => {
    const pts = Number(u.pontuacaoTotal) || 0; const ativo = u.ativo !== false;
    const switchAtivo = (hasGestao && u.role !== 'admin') ? `<label class="switch" title="Ativar/Desativar"><input type="checkbox" class="toggle-ativo" data-id="${u.id}" ${ativo ? 'checked' : ''}><span class="slider"></span></label>` : '';
    const btnFicha = `<button class="btn-acao btn-ficha" data-id="${u.id}" style="color: var(--primary); border-color: var(--primary); padding: 4px; margin-left: 5px;" title="Ver Ficha Completa"><i data-lucide="clipboard-list" style="width: 16px;"></i></button>`;
    const btnPerm = (u.role === 'comite' && userRole === 'admin') ? `<button class="btn-primario btn-permissoes" data-id="${u.id}" data-nome="${u.nome}" style="background: #f39c12; padding: 6px 10px; font-size: 0.8rem; margin-left: 5px;"><i data-lucide="key" style="width: 14px;"></i></button>` : '';
    const btnEditar = hasGestao ? `<button class="btn-acao btn-editar-membro" data-id="${u.id}" data-nome="${u.nome}" data-email="${u.email}" data-eq="${u.equipe}" style="color: var(--warning); border-color: var(--warning); padding: 4px; margin-left: 5px;"><i data-lucide="edit-2" style="width: 16px;"></i></button>` : '';
    const btnExcluir = (auth.currentUser.uid !== u.id && hasGestao) ? `<button class="btn-acao btn-excluir-membro" data-id="${u.id}" style="color: red; border: 0; padding: 4px; margin-left: 5px;"><i data-lucide="x-circle" style="width: 18px;"></i></button>` : '';
    const displayPts = u.role === 'atleta' ? `<br><small style="color: var(--primary);">🏆 ${pts} pts</small>` : '';
    const linha = `<tr><td class="${!ativo ? 'inativo-txt' : ''}" style="vertical-align:middle;"><strong>${u.nome}</strong>${displayPts}</td><td style="text-align: right; display:flex; justify-content:flex-end; align-items:center; min-height: 40px;">${switchAtivo} ${btnFicha} ${btnPerm} ${btnEditar} ${btnExcluir}</td></tr>`;
    if (u.role === "admin" || u.role === "comite") { htmlComite += linha; contComite++; } else if (u.equipe === "Corrida") { htmlCorrida += linha; contCorrida++; ptsCorrida += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe, id: u.id, ativo: ativo}); } else if (u.equipe === "Bicicleta" || u.equipe === "Bike") { htmlBike += linha; contBike++; ptsBike += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe, id: u.id, ativo: ativo}); }
  });

  if(document.getElementById("listaFilaBike")) document.getElementById("listaFilaBike").innerHTML = htmlFilaBike || `<tr><td colspan='2'>Ninguém na fila.</td></tr>`;
  if(document.getElementById("listaFilaCorrida")) document.getElementById("listaFilaCorrida").innerHTML = htmlFilaCorrida || `<tr><td colspan='2'>Ninguém na fila.</td></tr>`;
  if(document.getElementById("listaBicicleta")) document.getElementById("listaBicicleta").innerHTML = htmlBike || `<tr><td colspan='2'>Equipe vazia.</td></tr>`;
  if(document.getElementById("listaCorrida")) document.getElementById("listaCorrida").innerHTML = htmlCorrida || `<tr><td colspan='2'>Equipe vazia.</td></tr>`;
  if(document.getElementById("listaComite")) document.getElementById("listaComite").innerHTML = htmlComite || `<tr><td colspan='2'>Sem membros.</td></tr>`;
  
  if(document.getElementById("totalBike")) document.getElementById("totalBike").textContent = contBike;
  if(document.getElementById("totalCorrida")) document.getElementById("totalCorrida").textContent = contCorrida;

  renderGraficosETop(ptsBike, ptsCorrida, todosAtletas, contBike, contCorrida); lucide.createIcons();

  document.querySelectorAll(".btn-aprovar-fila").forEach(btn => { btn.addEventListener("click", async (e) => { if(confirm(`Aprovar atleta?`)) { e.currentTarget.disabled = true; await updateDoc(doc(db, "atletas", e.currentTarget.dataset.id), { equipe: e.currentTarget.dataset.eq, recusas: 0 }); atualizarTelas(); }}); });
  document.querySelectorAll(".btn-pular-fila").forEach(btn => { btn.addEventListener("click", async (e) => { const id = e.currentTarget.dataset.id; let st = parseInt(e.currentTarget.dataset.strikes); if(confirm(`Passar a vez do atleta? Ele trocará de posição com o próximo da fila.`)) { st++; if(st >= 3) { if(confirm("3 recusas! Remover da fila?")) { await updateDoc(doc(db, "atletas", id), { ativo: false, equipe: "Nenhuma" }); showToast("Removido.", "info"); atualizarTelas(); return; } else { st = 0; } }
        const eqFila = mapAtletas[id].equipe; const filaAtual = Object.values(mapAtletas).filter(a => a.equipe === eqFila && a.ativo !== false).sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0)); const idx = filaAtual.findIndex(a => a.id === id);
        if (idx >= 0 && idx < filaAtual.length - 1) { const idProximo = filaAtual[idx + 1].id; const dataAtual = mapAtletas[id].criadoEm; const dataProximo = mapAtletas[idProximo].criadoEm; await updateDoc(doc(db, "atletas", id), { recusas: st, criadoEm: dataProximo }); await updateDoc(doc(db, "atletas", idProximo), { criadoEm: dataAtual }); showToast("Posições trocadas!", "success"); } else { await updateDoc(doc(db, "atletas", id), { recusas: st }); showToast("Último da fila.", "info"); } atualizarTelas(); }}); });
  
  document.querySelectorAll(".btn-excluir-membro").forEach(btn => { btn.addEventListener("click", async (e) => { if(confirm("Apagar definitivamente?")) { e.currentTarget.disabled = true; await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); atualizarTelas(); }}); });
  document.querySelectorAll(".btn-editar-membro").forEach(btn => { btn.addEventListener("click", (e) => { const b = e.currentTarget; document.getElementById("editId").value = b.dataset.id; document.getElementById("editNome").value = b.dataset.nome; document.getElementById("editEmail").value = b.dataset.email !== "undefined" ? b.dataset.email : ""; document.getElementById("editPapel").value = b.dataset.eq; document.getElementById("modalEditarAtleta").style.display = "flex"; }); });
  document.querySelectorAll(".toggle-ativo").forEach(chk => { chk.addEventListener("change", async (e) => { const isAtivo = e.target.checked; await updateDoc(doc(db, "atletas", e.target.dataset.id), { ativo: isAtivo }); const td = e.target.closest('tr').querySelector('td'); if(isAtivo) td.classList.remove('inativo-txt'); else td.classList.add('inativo-txt'); showToast(isAtivo ? "Atleta Ativado!" : "Atleta Inativado.", "info"); }); });
  document.querySelectorAll(".btn-ficha").forEach(btn => { btn.addEventListener("click", (e) => abrirFichaAtleta(e.currentTarget.dataset.id)); });
  document.querySelectorAll(".btn-permissoes").forEach(btn => { btn.addEventListener("click", (e) => { const b = e.currentTarget; document.getElementById("permNomeUsuario").textContent = b.dataset.nome; document.getElementById("permUserId").value = b.dataset.id; const permissoesDB = mapAtletas[b.dataset.id].permissoes || ["visao-geral"]; document.querySelectorAll(".chk-perm").forEach(chk => { chk.checked = permissoesDB.includes(chk.value) || (permissoesDB.includes("financeiro") && chk.value.startsWith("financeiro")); }); document.getElementById("modalPermissoes").style.display = "flex"; }); });
}

function setupPermissoesModal() {
  const modal = document.getElementById("modalPermissoes"); if(!modal) return;
  document.getElementById("fecharModalPermissoes").addEventListener("click", () => modal.style.display = "none");
  document.getElementById("salvarPermissoesBtn").addEventListener("click", async (e) => {
    const id = document.getElementById("permUserId").value; let selecionadas = [];
    document.querySelectorAll(".chk-perm:checked").forEach(chk => selecionadas.push(chk.value));
    if(selecionadas.length === 0) return showToast("Precisa ter pelo menos uma aba.", "error");
    e.target.textContent = "Salvando..."; e.target.disabled = true;
    await updateDoc(doc(db, "atletas", id), { permissoes: selecionadas }); showToast("Permissões atualizadas!", "success"); modal.style.display = "none"; e.target.textContent = "Salvar Acessos"; e.target.disabled = false; atualizarTelas();
  });
}

function setupFichaAtleta() {
  document.getElementById("fecharModalFicha").addEventListener("click", () => document.getElementById("modalFichaAtleta").style.display = "none");
  document.getElementById("btnSalvarComentario").addEventListener("click", async () => {
    const aId = document.getElementById("fichaAtletaId").value; const txt = document.getElementById("novoComentarioFicha").value.trim();
    if(!txt) return; const meuNome = mapAtletas[auth.currentUser.uid] ? mapAtletas[auth.currentUser.uid].nome : "Comitê"; document.getElementById("btnSalvarComentario").disabled = true; document.getElementById("btnSalvarComentario").textContent = "Salvando...";
    try { await addDoc(collection(db, "comentarios_atletas"), { atletaId: aId, texto: txt, autorNome: meuNome, criadoEm: new Date().toISOString() }); document.getElementById("novoComentarioFicha").value = ""; carregarComentarios(aId); showToast("Comentário salvo!", "success"); } catch(e) { showToast("Erro ao salvar comentário.", "error"); } document.getElementById("btnSalvarComentario").disabled = false; document.getElementById("btnSalvarComentario").textContent = "Adicionar Comentário";
  });
}

async function abrirFichaAtleta(id) {
  const a = mapAtletas[id]; if(!a) return;
  document.getElementById("fichaNome").textContent = a.nome;
  document.getElementById("fichaEquipe").textContent = a.equipe;
  document.getElementById("fichaPontos").textContent = a.pontuacaoTotal || 0;
  const statusEl = document.getElementById("fichaStatus"); if(a.ativo !== false) { statusEl.textContent = "Ativo no Sistema"; statusEl.style.color = "var(--secondary)"; } else { statusEl.textContent = "Desativado"; statusEl.style.color = "var(--danger)"; }
  document.getElementById("fichaAtletaId").value = id;
  const hist = historicoCompleto.filter(h => h.atletaId === id); let htmlH = ""; if(hist.length === 0) htmlH = "<p style='color:#999; margin-top: 10px;'>Nenhum registro encontrado.</p>";
  hist.forEach(h => { const dataF = new Date(h.dataTreino+"T00:00:00").toLocaleDateString('pt-BR'); const isFalta = Number(h.pontos) === 0; const cor = isFalta ? "var(--accent)" : "var(--secondary)"; const ptsStr = isFalta ? "Falta Justificada" : `+${h.pontos} pts`; htmlH += `<div style="border-bottom: 1px solid var(--border); padding: 8px 0; display:flex; justify-content:space-between; align-items:center;"><div><strong>${dataF}</strong> - ${h.descTreino}<br><small style="color:#666;">${h.regraDesc}</small></div><div style="color:${cor}; font-weight:bold; text-align:right;">${ptsStr}</div></div>`; });
  document.getElementById("fichaHistorico").innerHTML = htmlH; await carregarComentarios(id); document.getElementById("modalFichaAtleta").style.display = "flex";
}

async function carregarComentarios(id) {
  try {
    const snap = await getDocs(query(collection(db, "comentarios_atletas"), where("atletaId", "==", id))); let coments = []; snap.forEach(d => coments.push(d.data())); coments.sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm)); 
    let html = ""; coments.forEach(c => { const d = new Date(c.criadoEm).toLocaleDateString('pt-BR') + " às " + new Date(c.criadoEm).toLocaleTimeString('pt-BR').substring(0,5); html += `<div class="comentario-box"><div class="comentario-header"><span class="comentario-autor">${c.autorNome}</span> <span>${d}</span></div><div style="margin-top: 4px;">${c.texto}</div></div>`; });
    document.getElementById("fichaComentariosLista").innerHTML = html || "<p style='color:#999; font-size:0.85rem;'>Nenhum comentário registado.</p>";
  } catch(e) { document.getElementById("fichaComentariosLista").innerHTML = "<p style='color:red; font-size:0.85rem;'>Sem permissão.</p>"; }
}

async function renderGraficosETop(ptsBike, ptsCorrida, arrayAtletas, totalBike, totalCorrida) {
  const hoje = new Date();
  const limite30d = new Date(); limite30d.setDate(limite30d.getDate() - 30);
  
  let engajados30d = 0; let totalPontosGlobal = 0;

  arrayAtletas.forEach(a => {
      totalPontosGlobal += a.pts;
      if (a.ativo !== false) {
          const lastEntry = historicoCompleto.find(h => h.atletaId === a.id && Number(h.pontos) > 0);
          if (lastEntry && lastEntry.dataTreino) {
              const dataTreino = new Date(lastEntry.dataTreino + "T00:00:00");
              const diffTime = Math.abs(hoje - dataTreino);
              a.diasAusente = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (dataTreino >= limite30d) engajados30d++;
          } else { a.diasAusente = 999; }
      } else { a.diasAusente = -1; } 
  });

  document.getElementById("mediaBike").textContent = totalBike > 0 ? Math.round(ptsBike / totalBike) : 0;
  document.getElementById("mediaCorrida").textContent = totalCorrida > 0 ? Math.round(ptsCorrida / totalCorrida) : 0;

  // Pódio com Truncate
  const htmlPodio = (arr) => {
    if(arr.length===0) return "<li style='color:#999; font-size:0.85rem;'>Sem pontos</li>";
    return arr.map((a,i) => `
      <li style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border);">
        <span style="display:flex; align-items:center; gap:5px; flex: 1; min-width: 0; margin-right: 10px;">
          <span style="font-size:0.85rem; flex-shrink: 0;">${i===0?'🥇':i===1?'🥈':'🥉'}</span>
          <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.85rem;" title="${a.nome}">${a.nome}</strong>
        </span>
        <strong style="font-size:0.85rem; flex-shrink: 0;">${a.pts}</strong>
      </li>`).join('');
  };
  
  const bikeAtletas = arrayAtletas.filter(a => a.eq === 'Bicicleta' || a.eq === 'Bike').sort((a,b) => b.pts - a.pts).slice(0,3);
  const corridaAtletas = arrayAtletas.filter(a => a.eq === 'Corrida').sort((a,b) => b.pts - a.pts).slice(0,3);
  if(document.getElementById("listaPodioBike")) document.getElementById("listaPodioBike").innerHTML = htmlPodio(bikeAtletas);
  if(document.getElementById("listaPodioCorrida")) document.getElementById("listaPodioCorrida").innerHTML = htmlPodio(corridaAtletas);

  // Evasão com Truncate
  const radarBike = arrayAtletas.filter(a => a.diasAusente > 30 && (a.eq === 'Bicicleta' || a.eq === 'Bike')).sort((a,b) => b.diasAusente - a.diasAusente).slice(0, 5);
  const radarCorrida = arrayAtletas.filter(a => a.diasAusente > 30 && a.eq === 'Corrida').sort((a,b) => b.diasAusente - a.diasAusente).slice(0, 5);
  const htmlEvasao = (arr) => {
    if(arr.length===0) return "<li style='color:var(--secondary); font-size:0.8rem;'>Nenhum alerta.</li>";
    return arr.map(a => `
      <li style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px dashed var(--danger);">
        <span style="display:flex; align-items:center; gap:5px; flex: 1; min-width: 0; margin-right: 10px;">
           <span style="color:var(--danger); font-size:0.8rem; flex-shrink:0;">⚠️</span>
           <strong style="color:var(--danger); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.8rem;" title="${a.nome}">${a.nome}</strong>
        </span>
        <small style="color:#999; font-weight:600; font-size:0.75rem; flex-shrink:0;">${a.diasAusente === 999 ? 'Nunca foi' : a.diasAusente + 'd'}</small>
      </li>`).join('');
  };
  if(document.getElementById("listaEvasaoBike")) document.getElementById("listaEvasaoBike").innerHTML = htmlEvasao(radarBike);
  if(document.getElementById("listaEvasaoCorrida")) document.getElementById("listaEvasaoCorrida").innerHTML = htmlEvasao(radarCorrida);

  const totalAtivosGerais = arrayAtletas.filter(a => a.ativo !== false).length;
  if(document.getElementById("totalAtivosGeral")) document.getElementById("totalAtivosGeral").textContent = totalAtivosGerais;
  if(document.getElementById("engajamento30d")) { document.getElementById("engajamento30d").textContent = (totalAtivosGerais > 0 ? Math.round((engajados30d / totalAtivosGerais)*100) : 0) + "%"; }
  if(document.getElementById("roiAtleta")) { document.getElementById("roiAtleta").textContent = (totalAtivosGerais > 0 ? (gastoTotalGlobal / totalAtivosGerais) : 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); }

  let ativosBikeG = arrayAtletas.filter(a => (a.eq === 'Bicicleta' || a.eq === 'Bike') && a.diasAusente <= 30 && a.diasAusente !== -1).length;
  let ativosCorridaG = arrayAtletas.filter(a => a.eq === 'Corrida' && a.diasAusente <= 30 && a.diasAusente !== -1).length;
  
  document.getElementById('txtAtivosBike').textContent = totalBike === 0 ? "0% ativos (30d)" : `${Math.round((ativosBikeG/totalBike)*100)}% ativos (30d)`;
  document.getElementById('txtAtivosCorrida').textContent = totalCorrida === 0 ? "0% ativos (30d)" : `${Math.round((ativosCorridaG/totalCorrida)*100)}% ativos (30d)`;

  if(document.getElementById('graficoEngajBike')) { if(graficoEngajBike) graficoEngajBike.destroy(); graficoEngajBike = new Chart(document.getElementById('graficoEngajBike'), { type: 'doughnut', data: { datasets: [{ data: [ativosBikeG, (totalBike - ativosBikeG)], backgroundColor: ['#009bc1', '#e3e6eb'], borderWidth: 0 }] }, options: { cutout: '75%', plugins: { tooltip:{enabled:false} } } }); }
  if(document.getElementById('graficoEngajCorrida')) { if(graficoEngajCorrida) graficoEngajCorrida.destroy(); graficoEngajCorrida = new Chart(document.getElementById('graficoEngajCorrida'), { type: 'doughnut', data: { datasets: [{ data: [ativosCorridaG, (totalCorrida - ativosCorridaG)], backgroundColor: ['#00b37e', '#e3e6eb'], borderWidth: 0 }] }, options: { cutout: '75%', plugins: { tooltip:{enabled:false} } } }); }

  if(document.getElementById('graficoTendencia')) {
    if(graficoLinhaInstancia) graficoLinhaInstancia.destroy(); const anoAtual = new Date().getFullYear().toString(); let ptsPorMes = [0,0,0,0,0,0,0,0,0,0,0,0];
    historicoCompleto.forEach(h => { if(h.dataTreino && h.dataTreino.startsWith(anoAtual)) { const m = parseInt(h.dataTreino.split("-")[1], 10); if(!isNaN(m) && m >= 1 && m <= 12) ptsPorMes[m - 1] += (Number(h.pontos) || 0); } });
    graficoLinhaInstancia = new Chart(document.getElementById('graficoTendencia'), { type: 'line', data: { labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'], datasets: [{ data: ptsPorMes, borderColor: '#009bc1', backgroundColor: 'rgba(0,155,193,0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  }
}

// =====================================================
// 📝 LANÇAMENTO LOTE INTELIGENTE & RELATÓRIOS
// =====================================================
function setupContabilizacao() {
  document.getElementById("dataTreino").valueAsDate = new Date();
  document.getElementById("lancarEventoSelect").addEventListener("change", (e) => { const evId = e.target.value; if(evId) { const evento = cacheEventos.find(x => x.id === evId); if(evento) { document.getElementById("descTreino").value = evento.titulo; document.getElementById("dataTreino").value = evento.data; if(evento.modalidade !== "Ambas") { document.getElementById("modTreino").value = evento.modalidade; document.getElementById("modTreino").dispatchEvent(new Event('change')); } } } else { document.getElementById("descTreino").value = ""; document.getElementById("dataTreino").valueAsDate = new Date(); } });
  document.getElementById("modTreino").addEventListener("change", async (e) => { const mod = e.target.value; document.getElementById("areaTabelaPontuacao").style.display = "none"; if (!mod) return; const snapRegras = await getDocs(query(collection(db, "regras_pontuacao"), where("modalidade", "in", ["Ambas", mod]))); if (snapRegras.empty) return showToast("Nenhuma regra.", "error"); let regrasArray = []; snapRegras.forEach(d => { const r = d.data(); regrasArray.push({ id: d.id, descricao: r.descricao, pontos: r.pontos }); }); await gerarTabelaContabilizacao(mod, regrasArray); document.getElementById("areaTabelaPontuacao").style.display = "block"; });
  document.getElementById("btnSalvarPontuacao").addEventListener("click", salvarPontuacoesEmLote);
}

async function gerarTabelaContabilizacao(modalidade, regras) {
  const tabela = document.getElementById("tabelaPontuacao");
  const snapAtletas = await getDocs(query(collection(db, "atletas"), where("status", "==", "Aprovado"), where("equipe", "==", modalidade)));
  let atletas = []; snapAtletas.forEach(d => { if(d.data().ativo !== false) atletas.push({id: d.id, ...d.data()}); });
  atletas.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  if (atletas.length === 0) { tabela.innerHTML = `<tr><td style='text-align:center; padding:20px;'>Nenhum atleta ativo.</td></tr>`; return; }

  let thead = `<thead><tr><th style="vertical-align:middle; font-size:1rem;">Nome do Atleta</th><th style="text-align:center; color:var(--accent); vertical-align:middle; min-width: 90px; border-left: 1px solid var(--border);"><div style="display:flex; flex-direction:column; align-items:center; gap:5px;"><span style="font-weight:bold; font-size: 0.8rem;">Falta Justificada</span><label style="font-size:0.75rem; display:flex; align-items:center; gap:4px; cursor:pointer; margin:0;"><input type="checkbox" id="checkMasterFalta"> Todo Time</label></div></th><th style="text-align:center; color:var(--secondary); vertical-align:middle; min-width: 90px; border-right: 2px solid var(--border);"><div style="display:flex; flex-direction:column; align-items:center; gap:5px;"><span style="font-weight:bold; font-size: 0.8rem;">Cumpriu Todas</span><label style="font-size:0.75rem; display:flex; align-items:center; gap:4px; cursor:pointer; margin:0;"><input type="checkbox" id="checkMasterCumpriu"> Todo Time</label></div></th>`;
  regras.forEach(r => { thead += `<th style="text-align:center; vertical-align:middle; min-width: 100px;"><div style="display:flex; flex-direction:column; align-items:center; gap:5px;"><span style="font-size:0.75rem; line-height:1.2; font-weight:normal;">${r.descricao}</span><strong style="color:var(--primary); font-size:0.95rem;">+${r.pontos}</strong></div></th>`; });
  thead += "</tr></thead><tbody>";
  atletas.forEach(a => {
    thead += `<tr><td style="vertical-align:middle; font-weight:500;">${a.nome}</td><td style="text-align:center; background: rgba(243,112,33,0.05); vertical-align:middle; border-left: 1px solid var(--border);"><input type="checkbox" class="check-falta" data-atleta-id="${a.id}" data-atleta-nome="${a.nome}" data-atleta-equipe="${a.equipe}"></td><td style="text-align:center; background: rgba(0,179,126,0.05); vertical-align:middle; border-right: 2px solid var(--border);"><input type="checkbox" class="check-cumpriu" data-atleta-id="${a.id}"></td>`;
    regras.forEach(r => { thead += `<td style="text-align:center; vertical-align:middle;"><input type="checkbox" class="check-ponto" data-atleta-id="${a.id}" data-atleta-nome="${a.nome}" data-atleta-equipe="${a.equipe}" data-regra-id="${r.id}" data-regra-desc="${r.descricao}" data-pontos="${r.pontos}"></td>`; });
    thead += `</tr>`;
  }); thead += "</tbody>"; tabela.innerHTML = thead;
  document.getElementById("checkMasterCumpriu").addEventListener("change", (e) => { document.querySelectorAll(".check-cumpriu").forEach(chk => { if(!chk.disabled) { chk.checked = e.target.checked; chk.dispatchEvent(new Event('change')); } }); });
  document.getElementById("checkMasterFalta").addEventListener("change", (e) => { document.querySelectorAll(".check-falta").forEach(chk => { chk.checked = e.target.checked; chk.dispatchEvent(new Event('change')); }); });
  document.querySelectorAll(".check-falta").forEach(chk => { chk.addEventListener("change", (e) => { const tr = e.target.closest("tr"); const cCumpriu = tr.querySelector(".check-cumpriu"); cCumpriu.disabled = e.target.checked; if(e.target.checked) cCumpriu.checked = false; tr.querySelectorAll(".check-ponto").forEach(p => { p.disabled = e.target.checked; if(e.target.checked) p.checked = false; }); }); });
  document.querySelectorAll(".check-cumpriu").forEach(chk => { chk.addEventListener("change", (e) => { const tr = e.target.closest("tr"); tr.querySelectorAll(".check-ponto").forEach(p => { if(!p.disabled) p.checked = e.target.checked; }); }); });
}

async function salvarPontuacoesEmLote() {
  const desc = document.getElementById("descTreino").value.trim(), data = document.getElementById("dataTreino").value;
  const hoje = new Date().toISOString().split('T')[0]; if (data > hoje) return showToast("Acesso Negado: Não é permitido lançar no futuro!", "error");
  const eventoIdSelecionado = document.getElementById("lancarEventoSelect").value;
  const checksPontos = document.querySelectorAll(".check-ponto:checked"), checksFaltas = document.querySelectorAll(".check-falta:checked");
  if (checksPontos.length === 0 && checksFaltas.length === 0) return showToast("Nenhum selecionado!", "error");
  if(!desc || !data) return showToast("Preencha Descrição e Data!", "error");
  if (!confirm(`Confirmar gravação?`)) return;
  const btn = document.getElementById("btnSalvarPontuacao"); btn.innerHTML = "Registrando Lote..."; btn.disabled = true;

  try {
    const batch = writeBatch(db); let pontosPorAtleta = {};
    for (let f of checksFaltas) { batch.set(doc(collection(db, "historico_pontos")), { atletaId: f.dataset.atletaId, atletaNome: f.dataset.atletaNome, atletaEquipe: f.dataset.atletaEquipe, regraId: "falta_just", regraDesc: "Falta Justificada", pontos: 0, descTreino: desc, dataTreino: data, eventoId: eventoIdSelecionado, criadoEm: new Date().toISOString() }); }
    for (let check of checksPontos) {
      const aId = check.dataset.atletaId; const pts = Number(check.dataset.pontos) || 0;
      batch.set(doc(collection(db, "historico_pontos")), { atletaId: aId, atletaNome: check.dataset.atletaNome, atletaEquipe: check.dataset.atletaEquipe, regraId: check.dataset.regraId, regraDesc: check.dataset.regraDesc, pontos: pts, descTreino: desc, dataTreino: data, eventoId: eventoIdSelecionado, criadoEm: new Date().toISOString() });
      if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0; pontosPorAtleta[aId] += pts;
    }
    for (let aId in pontosPorAtleta) { batch.update(doc(db, "atletas", aId), { pontuacaoTotal: increment(pontosPorAtleta[aId]) }); }
    await batch.commit(); showToast("Sucesso!", "success"); document.getElementById("areaTabelaPontuacao").style.display = "none"; document.getElementById("descTreino").value = ""; document.getElementById("lancarEventoSelect").value = ""; document.getElementById("modTreino").value = ""; atualizarTelas(); 
  } catch (error) { showToast("Erro ao salvar lote.", "error"); } finally { btn.innerHTML = `Salvar Lançamentos em Lote`; btn.disabled = false; }
}

function filtrarHistorico() {
  const mes = document.getElementById("filtroMesHistorico").value; const eq = document.getElementById("filtroEquipeHistorico").value; const nomeBusca = document.getElementById("filtroNomeHistorico").value.toLowerCase(); const statusFiltro = document.getElementById("filtroStatusHistorico").value;
  const dados = historicoCompleto.filter(h => { const atleta = mapAtletas[h.atletaId]; const isAtivo = atleta ? (atleta.ativo !== false) : false; if (statusFiltro === "ativos" && !isAtivo) return false; const nomeFiltro = h.atletaNome || (atleta ? atleta.nome : ""); const eqFiltro = h.atletaEquipe || (atleta ? atleta.equipe : ""); return (!mes || (h.dataTreino||"").startsWith(mes)) && (!eq || eqFiltro === eq) && (!nomeBusca || nomeFiltro.toLowerCase().includes(nomeBusca)); });
  const tbody = document.getElementById("listaHistorico"); tbody.innerHTML = "";
  if (dados.length === 0) { tbody.innerHTML = `<tr><td colspan='6' style='text-align:center;'>Nenhum registro.</td></tr>`; return; }

  const podeEstornar = userRole === "admin" || userPermissoes.includes("contabilizacao");

  dados.forEach(h => {
    const atleta = mapAtletas[h.atletaId]; let nomeDisplay = h.atletaNome || (atleta ? atleta.nome : "Desconhecido"); let eqDisplay = h.atletaEquipe || (atleta ? atleta.equipe : "-");
    if (atleta && atleta.ativo === false) { nomeDisplay += " <small style='color:var(--danger); font-weight:bold;'>(Inativo)</small>"; } else if (!atleta) { nomeDisplay += " <small style='color:#999; font-weight:bold;'>(Excluído)</small>"; }
    let ptsV = Number(h.pontos) === 0 ? `<span style="color:var(--accent);">Justificada</span>` : `+${h.pontos}`;
    const btnEstorno = podeEstornar ? `<button class="btn-acao btn-estornar" data-id="${h.id}" data-atleta="${h.atletaId}" data-pontos="${h.pontos}" style="color:var(--danger); border-color:var(--danger);"><i data-lucide="undo-2" style="width:16px;"></i></button>` : '';
    tbody.innerHTML += `<tr><td>${(h.dataTreino?new Date(h.dataTreino+"T00:00:00").toLocaleDateString('pt-BR'):"-")}</td><td><strong>${nomeDisplay}</strong></td><td>${eqDisplay}</td><td>${h.descTreino}<br><small style="color:var(--primary);">${h.regraDesc}</small></td><td style="text-align:center; color:var(--secondary); font-weight:bold;">${ptsV}</td><td style="text-align:right;">${btnEstorno}</td></tr>`;
  });
  lucide.createIcons();
  
  document.querySelectorAll(".btn-estornar").forEach(btn => { btn.addEventListener("click", async (e) => { const histId = e.currentTarget.dataset.id, atlId = e.currentTarget.dataset.atleta, pts = parseInt(e.currentTarget.dataset.pontos); if(!confirm(`Estornar?`)) return; try { if (mapAtletas[atlId] && pts > 0) { await updateDoc(doc(db, "atletas", atlId), { pontuacaoTotal: increment(-pts) }); } await deleteDoc(doc(db, "historico_pontos", histId)); showToast("Estornado!", "success"); atualizarTelas(); } catch (err) { showToast("Erro.", "error"); } }); });
}

async function carregarHistorico() {
  const snap = await getDocs(collection(db, "historico_pontos")); historicoCompleto = []; snap.forEach(d => { historicoCompleto.push({ id: d.id, ...d.data() }); });
  historicoCompleto.sort((a, b) => new Date(b.dataTreino || "1970-01-01") - new Date(a.dataTreino || "1970-01-01")); filtrarHistorico();
}

["filtroMesHistorico", "filtroEquipeHistorico", "filtroNomeHistorico", "filtroStatusHistorico"].forEach(id => { document.getElementById(id).addEventListener("input", filtrarHistorico); });
document.getElementById("btnLimparFiltrosExtrato").addEventListener("click", () => { document.getElementById("filtroMesHistorico").value = ""; document.getElementById("filtroEquipeHistorico").value = ""; document.getElementById("filtroNomeHistorico").value = ""; document.getElementById("filtroStatusHistorico").value = "ativos"; filtrarHistorico(); });

function setupRelatorioConsolidado() {
  document.getElementById("filtroAnoRelatorio").value = new Date().getFullYear();
  document.querySelector('[data-target="sub-relatorio"]').addEventListener("click", gerarRelatorioConsolidado);
  document.getElementById("btnGerarRelatorio").addEventListener("click", gerarRelatorioConsolidado);
  document.getElementById("btnExportarExcel").addEventListener("click", () => {
    const tbody = document.getElementById("listaRelatorio"); if(tbody.innerText.includes("Clique em Filtrar") || tbody.innerText.includes("Nenhum atleta")) return showToast("Gere o relatório!", "error");
    const rows = document.getElementById("tabelaConsolidada").querySelectorAll("tr"); let csv = "\uFEFF"; 
    rows.forEach(row => { const cols = row.querySelectorAll("th, td"); const rowData = Array.from(cols).map(c => `"${c.innerText.replace(/"/g, '""')}"`); csv += rowData.join(";") + "\r\n"; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `Relatorio_Consolidado.csv`; a.click(); URL.revokeObjectURL(url);
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
    if (prompt("CUIDADO EXTREMO! Isso apagará TODOS os dados.\nDigite 'LIMPAR' para confirmar:") !== "LIMPAR") return;
    if (!prompt("Digite sua senha de administrador para autorizar:")) return;
    const btn = document.getElementById("btnLimparBase"); btn.innerHTML = "Apagando..."; btn.disabled = true;
    try {
      const col = ["historico_pontos", "regras_pontuacao", "despesas", "comentarios_atletas"];
      for (let c of col) { const snap = await getDocs(collection(db, c)); snap.forEach(async (d) => { await deleteDoc(doc(db, c, d.id)); }); }
      const snapA = await getDocs(collection(db, "atletas")); snapA.forEach(async (d) => { if (d.id !== auth.currentUser.uid) await deleteDoc(doc(db, "atletas", d.id)); });
      showToast("Base Limpa!", "success"); setTimeout(() => window.location.reload(), 2000); 
    } catch(err) { showToast("Erro.", "error"); btn.disabled = false; }
  });
}

async function setupAprovacoes() {
  const tbody = document.getElementById("listaAprovacoes"); if (!tbody) return;
  const snap = await getDocs(query(collection(db, "atletas"), where("status", "==", "Pendente"))); tbody.innerHTML = "";
  if (snap.empty) { tbody.innerHTML = "<tr><td colspan='4'>Nenhuma pendência.</td></tr>"; return; }
  snap.forEach(d => { const u = d.data(); tbody.innerHTML += `<tr><td><strong>${u.nome}</strong></td><td>${u.email}</td><td>Comitê</td><td><button class="btn-acao btn-aprovar" data-id="${d.id}" style="color:var(--secondary); border-color:var(--secondary); margin-right:5px;">Aprovar</button><button class="btn-acao btn-rejeitar" data-id="${d.id}" style="color:var(--danger); border-color:var(--danger);">Rejeitar</button></td></tr>`; });
  document.querySelectorAll(".btn-aprovar").forEach(btn => btn.addEventListener("click", async (e) => { if(confirm("Aprovar?")) { e.currentTarget.disabled = true; await updateDoc(doc(db, "atletas", e.currentTarget.dataset.id), { status: "Aprovado" }); atualizarTelas(); } }));
  document.querySelectorAll(".btn-rejeitar").forEach(btn => btn.addEventListener("click", async (e) => { if(confirm("Rejeitar?")) { e.currentTarget.disabled = true; await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); atualizarTelas(); } }));
}

function setupCadastrarPessoa() {
  document.getElementById("btnCadastrarPessoa").addEventListener("click", async (e) => {
    const nome = document.getElementById("novoNome").value.trim(), email = document.getElementById("novoEmail").value.trim(), papel = document.getElementById("novoPapel").value, btn = e.target;
    if (!nome) return showToast("Preencha o nome!", "error");
    try {
      btn.textContent = "Salvando..."; btn.disabled = true;
      await addDoc(collection(db, "atletas"), { nome: nome, email: email, role: "atleta", equipe: papel, status: "Aprovado", ativo: true, pontuacaoTotal: 0, recusas: 0, criadoEm: new Date().toISOString() });
      document.getElementById("novoNome").value = ""; document.getElementById("novoEmail").value = ""; showToast(`${nome} adicionado!`, "success"); 
      document.querySelector('[data-target="sub-equipes"]').click();
      if (papel.includes("Fila")) document.querySelector('[data-target="tab-fila"]').click(); else if (papel === "Bicicleta") document.querySelector('[data-target="tab-bike"]').click(); else if (papel === "Corrida") document.querySelector('[data-target="tab-corrida"]').click();
      btn.textContent = "Adicionar"; btn.disabled = false; atualizarTelas(); 
    } catch (error) { showToast("Erro.", "error"); btn.textContent = "Adicionar"; btn.disabled = false; }
  });
}

async function carregarRegras() {
  const tbody = document.getElementById("listaRegras"); const snap = await getDocs(collection(db, "regras_pontuacao")); tbody.innerHTML = "";
  if (snap.empty) { tbody.innerHTML = `<tr><td colspan='4'>Nenhuma regra.</td></tr>`; return; }
  const canEdit = userRole === "admin" || userPermissoes.includes("gestao");
  snap.forEach(d => { 
    const r = d.data(); const btnExcluir = canEdit ? `<button class="btn-acao btn-excluir-regra" data-id="${d.id}" style="color:var(--danger); border-color:var(--danger);"><i data-lucide="trash" style="width:16px;"></i></button>` : ''; 
    tbody.innerHTML += `<tr><td><strong>${r.descricao}</strong></td><td>${r.modalidade}</td><td><strong style="color:var(--primary);">+ ${r.pontos}</strong></td><td style="text-align:center;">${btnExcluir}</td></tr>`; 
  });
  lucide.createIcons();
  document.querySelectorAll(".btn-excluir-regra").forEach(btn => { btn.addEventListener("click", async (e) => { if(confirm("Apagar regra?")) { e.currentTarget.disabled = true; await deleteDoc(doc(db, "regras_pontuacao", e.currentTarget.dataset.id)); carregarRegras(); } }); });
}

function setupModalRegras() {
  const modal = document.getElementById("modalRegra");
  if(document.getElementById("abrirModalRegra")) document.getElementById("abrirModalRegra").addEventListener("click", () => modal.style.display = "flex");
  document.getElementById("fecharModalRegra").addEventListener("click", () => modal.style.display = "none");
  document.getElementById("salvarRegraBtn").addEventListener("click", async (e) => {
    if (userRole !== "admin" && !userPermissoes.includes("gestao")) return showToast("Sem permissão.", "error");
    const desc = document.getElementById("regraDescricao").value.trim(), mod = document.getElementById("regraModalidade").value, pts = document.getElementById("regraPontos").value.trim();
    if (!desc || !pts) return;
    
    e.target.textContent = "Salvando..."; e.target.disabled = true;
    await addDoc(collection(db, "regras_pontuacao"), { descricao: desc, modalidade: mod, pontos: Number(pts), criadoEm: new Date().toISOString() });
    modal.style.display = "none"; document.getElementById("regraDescricao").value = ""; document.getElementById("regraPontos").value = ""; showToast("Regra criada!", "success"); 
    e.target.textContent = "Salvar"; e.target.disabled = false;
    carregarRegras();
  });
}

function setupModalEditar() {
  const modal = document.getElementById("modalEditarAtleta");
  document.getElementById("fecharModalEdit").addEventListener("click", () => modal.style.display = "none");
  document.getElementById("salvarEditBtn").addEventListener("click", async (e) => {
    const id = document.getElementById("editId").value, nome = document.getElementById("editNome").value.trim(), email = document.getElementById("editEmail").value.trim(), papel = document.getElementById("editPapel").value;
    if (!nome) return; let role = "atleta"; let equipe = papel; if (papel === "Comitê") { role = "comite"; equipe = "Nenhuma"; }
    
    e.target.textContent = "Salvando..."; e.target.disabled = true;
    try { await updateDoc(doc(db, "atletas", id), { nome: nome, email: email, role: role, equipe: equipe }); showToast("Atualizado!", "success"); modal.style.display = "none"; atualizarTelas(); } catch (err) { showToast("Erro.", "error"); }
    e.target.textContent = "Atualizar"; e.target.disabled = false;
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
