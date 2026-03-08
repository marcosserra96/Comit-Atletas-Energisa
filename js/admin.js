import { 
  auth, db, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc,
  onAuthStateChanged, signOut, query, where, orderBy, writeBatch, increment,
  updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "./firebase.js";

let userRole = "atleta";
let historicoCompleto = []; 
let mapAtletas = {};        
let graficoLinhaInstancia = null; 
let graficoRoscaInstancia = null;

// =====================================================
// 🔔 NOTIFICAÇÕES (TOAST)
// =====================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  let icon = type === "success" ? "check-circle" : type === "error" ? "alert-circle" : "info";
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i data-lucide="${icon}"></i> ${message}`;
  container.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => toast.remove(), 4000);
}

// =====================================================
// 🔒 INICIALIZAÇÃO
// =====================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    if (docSnap.exists() && (docSnap.data().role === "admin" || docSnap.data().role === "comite")) {
      userRole = docSnap.data().role;
      definirTagUsuario(); 
      iniciarPainelAdmin();
    } else { window.location.href = "index.html"; }
  } else { window.location.href = "index.html"; }
});

function definirTagUsuario() {
  const badge = document.getElementById("userGroupBadge");
  badge.style.display = "inline-block";
  if (userRole === "admin") { badge.textContent = "Administrador"; badge.style.background = "var(--danger)"; } 
  else { badge.textContent = "Comitê"; badge.style.background = "var(--primary)"; }
}

function iniciarPainelAdmin() {
  Chart.defaults.color = document.body.getAttribute('data-theme') === 'dark' ? '#aaa' : '#666';
  setupConfiguracoes();
  setupNavigation(); setupSubTabs(); configurarLogout();
  setupCadastrarPessoa(); setupAprovacoes(); setupModalRegras();
  setupContabilizacao(); setupPesquisaEquipes(); setupRelatorioConsolidado();
  setupModalEditar(); setupLimparBase();
  setupFinanceiro(); setupAgenda();
  atualizarTelas();
}

// Navegação
function setupNavigation() {
  document.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".menu-item").forEach(btn => btn.classList.remove("active"));
      item.classList.add("active");
      const target = item.dataset.section;
      document.querySelectorAll("main section").forEach(sec => {
        sec.classList.remove("active-section");
        if (sec.id === target) sec.classList.add("active-section");
      });
      lucide.createIcons();
      if(target === "visao-geral") { if(graficoLinhaInstancia) graficoLinhaInstancia.update(); if(graficoRoscaInstancia) graficoRoscaInstancia.update(); }
    });
  });
}

function setupSubTabs() {
  if (userRole !== "admin") {
    document.querySelectorAll(".admin-only-tab, .admin-only-option").forEach(el => el.style.display = "none");
    document.querySelector('[data-target="sub-cadastrar"]').click();
  } else { document.querySelector('[data-target="sub-aprovacoes"]').click(); }
  document.querySelectorAll(".sub-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const parent = tab.closest('section');
      parent.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active"));
      parent.querySelectorAll(".sub-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active"); document.getElementById(tab.dataset.target).classList.add("active");
    });
  });
  document.querySelectorAll(".t-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const parent = tab.closest('.sub-content');
      parent.querySelectorAll(".t-tab").forEach(t => t.classList.remove("active"));
      parent.querySelectorAll(".t-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active"); document.getElementById(tab.dataset.target).classList.add("active");
    });
  });
}

function configurarLogout() {
  document.getElementById("logoutBtn").addEventListener("click", async () => { if(confirm("Deseja realmente sair?")) { await signOut(auth); localStorage.clear(); window.location.href = "index.html"; } });
}

// 🛡️ MESTRE DAS ATUALIZAÇÕES
async function atualizarTelas() {
  if (userRole === "admin") setupAprovacoes();
  await carregarHistorico(); 
  await carregarEquipesEDashboard(); 
  await carregarRegras();
  await carregarFinanceiro();
  await carregarAgenda();
  if (document.getElementById("sub-relatorio").classList.contains("active")) { gerarRelatorioConsolidado(); }
}

// =====================================================
// 🛑 APROVAÇÕES
// =====================================================
async function setupAprovacoes() {
  const tbody = document.getElementById("listaAprovacoes");
  if (!tbody) return;
  const q = query(collection(db, "atletas"), where("status", "==", "Pendente"));
  const snap = await getDocs(q);
  tbody.innerHTML = "";
  if (snap.empty) { tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Nenhuma solicitação pendente.</td></tr>"; return; }

  snap.forEach(d => {
    const u = d.data();
    tbody.innerHTML += `<tr><td><strong>${u.nome}</strong></td><td>${u.email}</td><td><span style="color:var(--primary); font-weight:bold;">Acesso ao Comitê</span></td>
      <td><button class="btn-acao btn-aprovar" data-id="${d.id}" style="color: var(--secondary); border-color: var(--secondary); margin-right: 5px;">Aprovar</button>
      <button class="btn-acao btn-rejeitar" data-id="${d.id}" style="color: var(--danger); border-color: var(--danger);">Rejeitar</button></td></tr>`;
  });

  document.querySelectorAll(".btn-aprovar").forEach(btn => btn.addEventListener("click", async (e) => {
    if(confirm("Aprovar este membro para o Comitê?")) { await updateDoc(doc(db, "atletas", e.currentTarget.dataset.id), { status: "Aprovado" }); showToast("Acesso Liberado!", "success"); atualizarTelas(); }
  }));
  document.querySelectorAll(".btn-rejeitar").forEach(btn => btn.addEventListener("click", async (e) => {
    if(confirm("Rejeitar e excluir esta solicitação?")) { await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); showToast("Solicitação excluída.", "info"); atualizarTelas(); }
  }));
}

// =====================================================
// 📊 DASHBOARD & EQUIPES (COM FILA INTELIGENTE E PDF)
// =====================================================
document.getElementById("btnExportarPDF").addEventListener("click", () => {
  const elemento = document.getElementById("areaRelatorioPDF");

  // 1. Aplica o modo Executivo (que tranca a largura em 1120px)
  elemento.classList.add("pdf-executivo");
  
  // 2. Injeta o cabeçalho
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const headerHTML = `
    <div id="cabecalhoPDF" style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid var(--primary); padding-bottom: 10px; margin-bottom: 20px;">
      <div>
        <h1 style="margin: 0; color: var(--primary); font-size: 1.8rem;">Relatório Estratégico</h1>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 1rem;">Programa Comitê Atletas Energisa</p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0; color: #999; font-size: 0.9rem;">Gerado em: <strong style="color: #333;">${dataHoje}</strong></p>
      </div>
    </div>
  `;
  elemento.insertAdjacentHTML('afterbegin', headerHTML);

  // 3. Força Tema Claro e re-renderiza os gráficos para o tamanho fixo
  const temaAtual = document.body.getAttribute("data-theme");
  document.body.removeAttribute("data-theme");
  Chart.defaults.color = '#666';
  
  // Congela as dimensões do Canvas para evitar que explodam de tamanho
  const canvasLinha = document.getElementById('graficoTendencia');
  const canvasRosca = document.getElementById('graficoEngajamento');
  if(canvasLinha) { canvasLinha.style.width = '100%'; canvasLinha.style.height = '200px'; }
  if(canvasRosca) { canvasRosca.style.width = '150px'; canvasRosca.style.height = '150px'; }
  
  if(graficoLinhaInstancia) graficoLinhaInstancia.resize();
  if(graficoRoscaInstancia) graficoRoscaInstancia.resize();

  // 4. Configuração focada num encaixe perfeito na folha A4 (Paisagem)
  const opt = {
    margin:       0.2, // Margens curtas
    filename:     `Report_Estrategico_${dataHoje.replace(/\//g, '-')}.pdf`,
    image:        { type: 'jpeg', quality: 1 },
    html2canvas:  { 
      scale: 2, 
      useCORS: true,
      windowWidth: 1200 // Diz à biblioteca para se comportar como um monitor largo
    },
    jsPDF:        { 
      unit: 'in', 
      format: 'a4', 
      orientation: 'landscape' // Folha deitada
    } 
  };

  showToast("A gerar Report Executivo, aguarde...", "info");

  // 5. Gera e restaura
  html2pdf().set(opt).from(elemento).save().then(() => {
    document.getElementById("cabecalhoPDF").remove();
    elemento.classList.remove("pdf-executivo");
    
    // Liberta as dimensões do Canvas
    if(canvasLinha) { canvasLinha.style.width = ''; canvasLinha.style.height = ''; }
    if(canvasRosca) { canvasRosca.style.width = ''; canvasRosca.style.height = ''; }

    // Devolve o Tema Escuro se estava ativo
    if (temaAtual === "dark") {
      document.body.setAttribute("data-theme", "dark");
      Chart.defaults.color = '#aaa';
    }
    
    // Devolve o gráfico ao normal responsivo
    if(graficoLinhaInstancia) graficoLinhaInstancia.resize();
    if(graficoRoscaInstancia) graficoRoscaInstancia.resize();
    
    showToast("Relatório baixado com sucesso!", "success");
  });
});

function setupPesquisaEquipes() {
  document.getElementById("buscaEquipes").addEventListener("keyup", (e) => {
    const termo = e.target.value.toLowerCase();
    document.querySelectorAll(".t-content.active tbody tr").forEach(tr => {
      const nome = tr.querySelector("strong")?.textContent.toLowerCase() || "";
      tr.style.display = nome.includes(termo) ? "" : "none";
    });
  });
}

function renderizarGraficosDashboard(ptsBike, ptsCorrida, totalAtivos, atletasBike, atletasCorrida) {
  const metaGeral = 10000;
  const totalPontos = ptsBike + ptsCorrida;
  const percMeta = Math.min((totalPontos / metaGeral) * 100, 100).toFixed(1);
  document.getElementById("barraMetaGeral").style.width = `${percMeta}%`;
  document.getElementById("textoMetaGeral").textContent = `${totalPontos} / ${metaGeral} pts (${percMeta}%)`;

  const mediaB = atletasBike > 0 ? Math.round(ptsBike / atletasBike) : 0;
  const mediaC = atletasCorrida > 0 ? Math.round(ptsCorrida / atletasCorrida) : 0;
  document.getElementById("mediaBike").textContent = `${mediaB} pts/atleta`;
  document.getElementById("mediaCorrida").textContent = `${mediaC} pts/atleta`;

  // Gráfico de Tendência (Linha)
  const ctxLinha = document.getElementById('graficoTendencia');
  if(ctxLinha) {
    if(graficoLinhaInstancia) graficoLinhaInstancia.destroy();
    const anoAtual = new Date().getFullYear().toString();
    let ptsPorMes = [0,0,0,0,0,0,0,0,0,0,0,0];
    historicoCompleto.forEach(h => {
      if(h.dataTreino && h.dataTreino.startsWith(anoAtual)) {
        const mesInt = parseInt(h.dataTreino.split("-")[1], 10);
        if(!isNaN(mesInt) && mesInt >= 1 && mesInt <= 12) { ptsPorMes[mesInt - 1] += (Number(h.pontos) || 0); }
      }
    });
    graficoLinhaInstancia = new Chart(ctxLinha, { type: 'line', data: { labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'], datasets: [{ label: 'Pontos Distribuídos', data: ptsPorMes, borderColor: '#009bc1', backgroundColor: 'rgba(0, 155, 193, 0.2)', fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
  }

  // Gráfico de Engajamento (Rosca)
  const ctxRosca = document.getElementById('graficoEngajamento');
  if(ctxRosca) {
    if(graficoRoscaInstancia) graficoRoscaInstancia.destroy();
    const atletasBase = Object.values(mapAtletas).filter(a => a.role === "atleta" && !a.equipe.startsWith("Fila"));
    const totalBase = atletasBase.length;
    let ativosNoAno = 0;
    const anoAtual = new Date().getFullYear().toString();
    const idsQuePontuaram = new Set();
    historicoCompleto.forEach(h => { if(h.dataTreino && h.dataTreino.startsWith(anoAtual) && h.pontos > 0) idsQuePontuaram.add(h.atletaId); });
    atletasBase.forEach(a => { if(idsQuePontuaram.has(a.id)) ativosNoAno++; });
    const inativos = totalBase - ativosNoAno;
    const porcentagem = totalBase === 0 ? 0 : Math.round((ativosNoAno / totalBase) * 100);
    document.getElementById('txtAtivos').textContent = `${porcentagem}%`;
    graficoRoscaInstancia = new Chart(ctxRosca, { type: 'doughnut', data: { labels: ['Ativos', 'Inativos'], datasets: [{ data: [ativosNoAno, inativos], backgroundColor: ['#00b37e', '#e3e6eb'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } } });
  }
}

async function carregarEquipesEDashboard() {
  const tbFila = document.getElementById("listaFila"), tbBike = document.getElementById("listaBicicleta"), tbCorrida = document.getElementById("listaCorrida"), tbComite = document.getElementById("listaComite");
  const snap = await getDocs(query(collection(db, "atletas"), where("status", "==", "Aprovado")));
  
  let htmlFila = "", htmlBike = "", htmlCorrida = "", htmlComite = "";
  let contFila = 0, contBike = 0, contCorrida = 0, contComite = 0, ptsBike = 0, ptsCorrida = 0;
  let todosAtletas = []; mapAtletas = {}; 

  let listaOrdenada = [];
  snap.forEach(d => { mapAtletas[d.id] = { id: d.id, ...d.data() }; listaOrdenada.push(mapAtletas[d.id]); });
  
  // FILA CRONOLÓGICA E TITULARES ALFABÉTICOS
  const filaEspera = listaOrdenada.filter(u => u.equipe && u.equipe.startsWith("Fila"));
  const titulares = listaOrdenada.filter(u => !u.equipe || !u.equipe.startsWith("Fila"));
  filaEspera.sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0));
  titulares.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));

  filaEspera.forEach((u, index) => {
    let badgeFila = u.equipe === "Fila - Bicicleta" ? `<span style="font-size: 0.75rem; background: rgba(0, 155, 193, 0.1); color: var(--primary); padding: 3px 6px; border-radius: 4px; margin-left: 8px;">🚴 Bike</span>` : `<span style="font-size: 0.75rem; background: rgba(0, 179, 126, 0.1); color: var(--secondary); padding: 3px 6px; border-radius: 4px; margin-left: 8px;">🏃 Corrida</span>`;
    
    const strikes = u.recusas || 0;
    const badgeStrike = strikes > 0 ? `<span class="strike-badge" title="Recusou vaga">⚠️ ${strikes}/3</span>` : '';
    const pos = index + 1;

    const btnAprovar = `<button class="btn-acao btn-aprovar-fila" data-id="${u.id}" data-eq="${u.equipe.includes('Bike') ? 'Bicicleta' : 'Corrida'}" style="color:var(--secondary); border-color:var(--secondary); padding:4px;" title="Aprovar Atleta"><i data-lucide="check" style="width:16px;"></i></button>`;
    const btnPular = `<button class="btn-acao btn-pular-fila" data-id="${u.id}" data-strikes="${strikes}" title="Atleta não praticando. Pular a vez." style="color:#f39c12; border-color:#f39c12; padding:4px;"><i data-lucide="skip-forward" style="width:16px;"></i></button>`;
    const btnEditar = `<button class="btn-acao btn-editar-membro" data-id="${u.id}" data-nome="${u.nome}" data-email="${u.email}" data-eq="${u.equipe}" style="color: var(--warning); border-color: var(--warning); padding: 4px; margin-left: 10px;" title="Editar"><i data-lucide="edit-2" style="width: 16px;"></i></button>`;
    
    htmlFila += `<tr><td style="padding: 10px;"><strong>${pos}º - ${u.nome}</strong> ${badgeFila} ${badgeStrike}</td><td style="text-align: right; display: flex; justify-content: flex-end; gap: 8px;">${btnAprovar} ${btnPular} <span style="border-left: 1px solid var(--border); margin: 0 5px;"></span> ${btnEditar}</td></tr>`;
    contFila++;
  });

  titulares.forEach(u => {
    const isDono = auth.currentUser.uid === u.id;
    const pts = Number(u.pontuacaoTotal) || 0; 
    const ativo = u.ativo !== false; 
    const classeInativo = !ativo ? 'inativo-txt' : '';
    
    const switchAtivo = (u.role === 'atleta' && userRole === 'admin') ? `<label class="switch" title="Ativar/Desativar"><input type="checkbox" class="toggle-ativo" data-id="${u.id}" ${ativo ? 'checked' : ''}><span class="slider"></span></label>` : '';
    const btnEditar = `<button class="btn-acao btn-editar-membro" data-id="${u.id}" data-nome="${u.nome}" data-email="${u.email}" data-eq="${u.equipe}" style="color: var(--warning); border-color: var(--warning); padding: 4px; margin-left: 10px;" title="Editar"><i data-lucide="edit-2" style="width: 16px; height: 16px;"></i></button>`;
    const btnExcluir = (!isDono && userRole === "admin") ? `<button class="btn-acao btn-excluir-membro" data-id="${u.id}" style="color: red; border: 0; padding: 4px; margin-left: 5px;" title="Remover Definitivo"><i data-lucide="x-circle" style="width: 18px; height: 18px;"></i></button>` : '';

    const linha = `<tr><td style="padding: 10px;" class="${classeInativo}"><strong>${u.nome}</strong> ${isDono ? `<span style="font-size: 0.75rem; color: #999;">(Você)</span>` : ''}${u.role === 'atleta' ? `<br><small style="color: var(--primary); font-weight: 600;">🏆 ${pts} pts</small>` : ''}</td><td style="text-align: right; padding: 10px; display: flex; justify-content: flex-end; align-items: center;">${switchAtivo} ${btnEditar} ${btnExcluir}</td></tr>`;
    
    if (u.role === "admin" || u.role === "comite") { htmlComite += linha; contComite++; }
    else if (u.equipe === "Corrida") { htmlCorrida += linha; contCorrida++; ptsCorrida += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe}); }
    else if (u.equipe === "Bicicleta") { htmlBike += linha; contBike++; ptsBike += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe}); }
  });

  if(tbFila) tbFila.innerHTML = htmlFila || `<tr><td colspan='2'><div class="empty-state"><i data-lucide="check-circle"></i><p>Fila limpa!</p></div></td></tr>`;
  if(tbComite) tbComite.innerHTML = htmlComite || `<tr><td colspan='2'><div class="empty-state"><i data-lucide="users"></i><p>Nenhum membro.</p></div></td></tr>`;
  if(tbBike) tbBike.innerHTML = htmlBike || `<tr><td colspan='2'><div class="empty-state"><i data-lucide="bike"></i><p>Equipe vazia.</p></div></td></tr>`;
  if(tbCorrida) tbCorrida.innerHTML = htmlCorrida || `<tr><td colspan='2'><div class="empty-state"><i data-lucide="footprints"></i><p>Equipe vazia.</p></div></td></tr>`;
  
  if(document.getElementById("totalFila")) document.getElementById("totalFila").textContent = contFila;
  if(document.getElementById("totalComite")) document.getElementById("totalComite").textContent = contComite;
  if(document.getElementById("totalBike")) document.getElementById("totalBike").textContent = contBike;
  if(document.getElementById("totalCorrida")) document.getElementById("totalCorrida").textContent = contCorrida;

  renderizarGraficosDashboard(ptsBike, ptsCorrida, 0, contBike, contCorrida);

  todosAtletas.sort((a, b) => b.pts - a.pts);
  const podio = todosAtletas.slice(0, 5);
  const listaPodio = document.getElementById("listaPodio");
  if(listaPodio) {
    listaPodio.innerHTML = "";
    if (podio.length === 0) { listaPodio.innerHTML = "<div class='empty-state' style='padding: 10px;'><i data-lucide='medal'></i><p style='font-size: 0.9rem;'>Nenhum atleta pontuou ainda.</p></div>"; } 
    else {
      podio.forEach((atleta, index) => {
        let medalha = "🏅"; if(index===0) medalha = "🥇"; if(index===1) medalha = "🥈"; if(index===2) medalha = "🥉";
        let corEq = atleta.eq === "Bicicleta" ? "var(--primary)" : "var(--secondary)";
        listaPodio.innerHTML += `<li style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);"><span>${medalha} <strong style="margin-left:5px;">${atleta.nome}</strong> <small style="color:${corEq}; font-weight:600; margin-left:5px;">${atleta.eq}</small></span><strong style="color: var(--text-light);">${atleta.pts} pts</strong></li>`;
      });
    }
  }
  lucide.createIcons();

  // AÇÕES DA FILA
  document.querySelectorAll(".btn-aprovar-fila").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id; const eqDestino = e.currentTarget.dataset.eq;
      if(confirm(`Promover atleta para a equipe titular de ${eqDestino}?`)) { 
        await updateDoc(doc(db, "atletas", id), { equipe: eqDestino, recusas: 0 }); showToast(`Aprovado para ${eqDestino}!`, "success"); atualizarTelas(); 
      }
    });
  });

  document.querySelectorAll(".btn-pular-fila").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id; let strikesAtuais = parseInt(e.currentTarget.dataset.strikes);
      if(confirm(`O atleta não comprovou atividade. Deseja registrar uma recusa e passar a vez?`)) {
        strikesAtuais++;
        if(strikesAtuais >= 3) {
          alert("Este atleta atingiu 3 recusas. Ele será movido para o final da fila de espera.");
          await updateDoc(doc(db, "atletas", id), { recusas: 0, criadoEm: new Date().toISOString() });
        } else { await updateDoc(doc(db, "atletas", id), { recusas: strikesAtuais }); }
        showToast("Fila atualizada.", "info"); atualizarTelas();
      }
    });
  });

  document.querySelectorAll(".btn-excluir-membro").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if(confirm("ALERTA: Deseja apagar definitivamente?")) { await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); showToast("Membro excluído.", "info"); atualizarTelas(); }
    });
  });

  document.querySelectorAll(".toggle-ativo").forEach(chk => {
    chk.addEventListener("change", async (e) => {
      const isAtivo = e.target.checked; await updateDoc(doc(db, "atletas", e.target.dataset.id), { ativo: isAtivo });
      const td = e.target.closest('tr').querySelector('td');
      if(isAtivo) td.classList.remove('inativo-txt'); else td.classList.add('inativo-txt');
      showToast(isAtivo ? "Atleta Ativado!" : "Atleta Inativado.", "info");
    });
  });

  document.querySelectorAll(".btn-editar-membro").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const b = e.currentTarget; document.getElementById("editId").value = b.dataset.id; document.getElementById("editNome").value = b.dataset.nome;
      document.getElementById("editEmail").value = b.dataset.email !== "undefined" ? b.dataset.email : "";
      document.getElementById("editPapel").value = b.dataset.eq; document.getElementById("modalEditarAtleta").style.display = "flex";
    });
  });
}

function setupModalEditar() {
  const modal = document.getElementById("modalEditarAtleta");
  document.getElementById("fecharModalEdit").addEventListener("click", () => modal.style.display = "none");
  document.getElementById("salvarEditBtn").addEventListener("click", async () => {
    const id = document.getElementById("editId").value, nome = document.getElementById("editNome").value.trim(), email = document.getElementById("editEmail").value.trim(), papel = document.getElementById("editPapel").value;
    if (!nome) return showToast("O nome não pode ficar vazio!", "error");
    let role = "atleta"; let equipe = papel; if (papel === "Comitê") { role = "comite"; equipe = "Nenhuma"; }
    try { await updateDoc(doc(db, "atletas", id), { nome: nome, email: email, role: role, equipe: equipe }); showToast("Cadastro atualizado!", "success"); modal.style.display = "none"; atualizarTelas(); } catch (err) { showToast("Erro ao atualizar.", "error"); }
  });
}

// =====================================================
// ✅ CADASTRAR PESSOA MANUALMENTE
// =====================================================
function setupCadastrarPessoa() {
  document.getElementById("btnCadastrarPessoa").addEventListener("click", async (e) => {
    const nome = document.getElementById("novoNome").value.trim(), email = document.getElementById("novoEmail").value.trim(), papel = document.getElementById("novoPapel").value, btn = e.target;
    if (!nome) return showToast("Por favor, preencha o nome!", "error");
    let role = "atleta"; let equipe = papel; if (papel === "Comitê") { role = "comite"; equipe = "Nenhuma"; }
    try {
      btn.textContent = "Salvando..."; btn.disabled = true;
      await addDoc(collection(db, "atletas"), { nome: nome, email: email, role: role, equipe: equipe, status: "Aprovado", ativo: true, pontuacaoTotal: 0, recusas: 0, criadoEm: new Date().toISOString() });
      showToast(`${nome} adicionado!`, "success");
      document.getElementById("novoNome").value = ""; document.getElementById("novoEmail").value = "";
      btn.textContent = "Adicionar ao Sistema"; btn.disabled = false; atualizarTelas(); 
      if(equipe.startsWith("Fila")) document.querySelector('[data-target="tab-fila"]').click(); else if(equipe === "Bicicleta") document.querySelector('[data-target="tab-bike"]').click(); else if(equipe === "Corrida") document.querySelector('[data-target="tab-corrida"]').click();
      document.querySelector('[data-target="sub-equipes"]').click();
    } catch (error) { showToast("Erro ao cadastrar.", "error"); btn.textContent = "Adicionar ao Sistema"; btn.disabled = false; }
  });
}

// =====================================================
// 💯 LANÇAR PONTUAÇÃO (LOTE)
// =====================================================
function setupContabilizacao() {
  document.getElementById("dataTreino").valueAsDate = new Date();
  document.getElementById("modTreino").addEventListener("change", async (e) => {
    const mod = e.target.value; const areaRegras = document.getElementById("areaSelecaoRegras"), listaRegras = document.getElementById("listaRegrasTreino"), btnGerar = document.getElementById("btnGerarLista");
    document.getElementById("areaTabelaPontuacao").style.display = "none"; 
    if (!mod) { areaRegras.style.display = "none"; btnGerar.style.display = "none"; return; }
    listaRegras.innerHTML = "<span style='font-size: 0.85rem; color: #999;'>Buscando regras...</span>"; areaRegras.style.display = "block";
    const snapRegras = await getDocs(query(collection(db, "regras_pontuacao"), where("modalidade", "in", ["Ambas", mod])));
    if (snapRegras.empty) { listaRegras.innerHTML = "<span style='font-size: 0.85rem; color: var(--danger);'>Nenhuma regra cadastrada.</span>"; btnGerar.style.display = "none"; return; }

    listaRegras.innerHTML = "";
    snapRegras.forEach(d => {
      const r = d.data(); const chip = document.createElement("label"); chip.className = "regra-chip";
      chip.innerHTML = `<input type="checkbox" value="${d.id}" data-desc="${r.descricao}" data-pontos="${r.pontos}"> ${r.descricao} <strong style="color:var(--secondary);">+${r.pontos}</strong>`;
      chip.querySelector("input").addEventListener("change", (ev) => { if(ev.target.checked) chip.classList.add("selected"); else chip.classList.remove("selected"); });
      listaRegras.appendChild(chip);
    });
    btnGerar.style.display = "inline-flex";
  });

  document.getElementById("btnGerarLista").addEventListener("click", async () => {
    const desc = document.getElementById("descTreino").value.trim(), data = document.getElementById("dataTreino").value, mod = document.getElementById("modTreino").value;
    const regrasSelecionadas = [];
    document.querySelectorAll("#listaRegrasTreino input:checked").forEach(chk => { regrasSelecionadas.push({ id: chk.value, descricao: chk.dataset.desc, pontos: parseInt(chk.dataset.pontos) }); });
    if (!desc || !data || !mod) return showToast("Preencha descrição, data e equipe!", "error");
    if (regrasSelecionadas.length === 0) return showToast("Selecione pelo menos uma regra para pontuar!", "error");
    const btn = document.getElementById("btnGerarLista"); btn.textContent = "Gerando..."; btn.disabled = true;
    await gerarTabelaContabilizacao(mod, regrasSelecionadas);
    btn.textContent = "Gerar Tabela de Lançamento"; btn.disabled = false; document.getElementById("areaTabelaPontuacao").style.display = "block";
  });
  document.getElementById("btnSalvarPontuacao").addEventListener("click", salvarPontuacoesEmLote);
}

async function gerarTabelaContabilizacao(modalidade, regras) {
  const tabela = document.getElementById("tabelaPontuacao");
  const snapAtletas = await getDocs(query(collection(db, "atletas"), where("status", "==", "Aprovado"), where("equipe", "==", modalidade)));
  let atletas = []; snapAtletas.forEach(d => { if(d.data().ativo !== false) atletas.push({id: d.id, ...d.data()}); });
  atletas.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));

  if (atletas.length === 0) { tabela.innerHTML = `<tr><td style='text-align:center; padding: 20px;'><div class="empty-state"><i data-lucide="ghost"></i><p>Nenhum atleta ativo na equipe de ${modalidade}.</p></div></td></tr>`; lucide.createIcons(); return; }

  let thead = `<thead><tr><th style="min-width: 200px; vertical-align: bottom;">Nome do Atleta</th><th style="text-align: center; width: 90px; color: var(--accent); border-right: 2px solid var(--border);">Falta<br>Justificada<div style="margin-top: 10px; font-size: 0.75rem;"><input type="checkbox" id="checkMasterFalta" style="margin:0; width:14px; height:14px; accent-color:var(--accent);"> Todos</div></th>`;
  regras.forEach(r => { thead += `<th style="text-align: center; min-width: 100px;"><div style="font-size: 0.8rem; line-height: 1.2; margin-bottom: 5px;">${r.descricao}</div><strong style="color: var(--secondary); font-size: 1rem;">+${r.pontos} pts</strong><div style="margin-top: 10px; font-size: 0.75rem;"><input type="checkbox" class="checkMasterRegra" data-regra-id="${r.id}" style="margin:0; width:14px; height:14px; accent-color:var(--primary);"> Todos</div></th>`; });
  thead += "</tr></thead>";

  let tbody = "<tbody>";
  atletas.forEach(a => {
    const ptsAtuais = Number(a.pontuacaoTotal) || 0;
    tbody += `<tr><td><strong>${a.nome}</strong> <br><small style="color: #999;">Atual: ${ptsAtuais} pts</small></td><td style="text-align: center; vertical-align: middle; border-right: 2px solid var(--border); background: rgba(243, 112, 33, 0.05);"><input type="checkbox" class="check-falta" data-atleta-id="${a.id}"></td>`;
    regras.forEach(r => { tbody += `<td style="text-align: center; vertical-align: middle;"><input type="checkbox" class="check-ponto" data-atleta-id="${a.id}" data-regra-id="${r.id}" data-regra-desc="${r.descricao}" data-pontos="${r.pontos}"></td>`; });
    tbody += `</tr>`;
  });
  tbody += "</tbody>";
  tabela.innerHTML = thead + tbody;

  document.querySelectorAll(".checkMasterRegra").forEach(master => { master.addEventListener("change", (e) => { document.querySelectorAll(`.check-ponto[data-regra-id="${e.target.dataset.regraId}"]`).forEach(chk => { if(!chk.disabled) chk.checked = e.target.checked; }); }); });
  document.getElementById("checkMasterFalta").addEventListener("change", (e) => { document.querySelectorAll(".check-falta").forEach(chk => { chk.checked = e.target.checked; chk.dispatchEvent(new Event('change')); }); });
  document.querySelectorAll(".check-falta").forEach(chk => { chk.addEventListener("change", (e) => { e.target.closest("tr").querySelectorAll(".check-ponto").forEach(p => { p.disabled = e.target.checked; if(e.target.checked) p.checked = false; }); }); });
}

async function salvarPontuacoesEmLote() {
  const desc = document.getElementById("descTreino").value.trim(), data = document.getElementById("dataTreino").value;
  const checksPontos = document.querySelectorAll(".check-ponto:checked"), checksFaltas = document.querySelectorAll(".check-falta:checked");
  if (checksPontos.length === 0 && checksFaltas.length === 0) return showToast("Nenhum lançamento selecionado!", "error");
  if (!confirm(`Confirmar lançamento no sistema?`)) return;

  const btn = document.getElementById("btnSalvarPontuacao"); btn.innerHTML = "Registrando Lote..."; btn.disabled = true;

  try {
    const batch = writeBatch(db);
    let pontosPorAtleta = {};

    for (let f of checksFaltas) { batch.set(doc(collection(db, "historico_pontos")), { atletaId: f.dataset.atletaId, regraId: "falta_just", regraDesc: "Falta Justificada", pontos: 0, descTreino: desc, dataTreino: data, criadoEm: new Date().toISOString() }); }
    for (let check of checksPontos) {
      const aId = check.dataset.atletaId; const pts = Number(check.dataset.pontos) || 0;
      batch.set(doc(collection(db, "historico_pontos")), { atletaId: aId, regraId: check.dataset.regraId, regraDesc: check.dataset.regraDesc, pontos: pts, descTreino: desc, dataTreino: data, criadoEm: new Date().toISOString() });
      if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0; pontosPorAtleta[aId] += pts;
    }
    for (let aId in pontosPorAtleta) { batch.update(doc(db, "atletas", aId), { pontuacaoTotal: increment(pontosPorAtleta[aId]) }); }
    await batch.commit();

    showToast("Lançamentos efetuados com sucesso!", "success");
    document.getElementById("areaTabelaPontuacao").style.display = "none"; document.getElementById("areaSelecaoRegras").style.display = "none";
    document.getElementById("btnGerarLista").style.display = "none"; document.getElementById("descTreino").value = ""; document.getElementById("modTreino").value = "";
    atualizarTelas(); 
  } catch (error) { showToast("Erro ao salvar lote.", "error"); } 
  finally { btn.innerHTML = `<i data-lucide="check-circle"></i> Salvar Lançamentos Lote`; btn.disabled = false; lucide.createIcons(); }
}

// =====================================================
// 📜 EXTRATO 
// =====================================================
async function carregarHistorico() {
  try {
    const snap = await getDocs(collection(db, "historico_pontos"));
    historicoCompleto = []; snap.forEach(d => { historicoCompleto.push({ id: d.id, ...d.data() }); });
    historicoCompleto.sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
    filtrarHistorico();
  } catch (error) { document.getElementById("listaHistorico").innerHTML = `<tr><td colspan='6'>Erro ao buscar histórico.</td></tr>`; }
}

function filtrarHistorico() {
  const mes = document.getElementById("filtroMesHistorico").value; const eq = document.getElementById("filtroEquipeHistorico").value; const nome = document.getElementById("filtroNomeHistorico").value.toLowerCase();
  const dadosFiltrados = historicoCompleto.filter(h => { const atleta = mapAtletas[h.atletaId] || { nome: "", equipe: "" }; return (!mes || (h.dataTreino||"").startsWith(mes)) && (!eq || atleta.equipe === eq) && (!nome || (atleta.nome && atleta.nome.toLowerCase().includes(nome))); });
  const tbody = document.getElementById("listaHistorico"); tbody.innerHTML = "";
  if (dadosFiltrados.length === 0) { tbody.innerHTML = `<tr><td colspan='6'><div class="empty-state"><i data-lucide="file-search"></i><p>Nenhum lançamento no extrato.</p></div></td></tr>`; lucide.createIcons(); return; }

  dadosFiltrados.forEach(h => {
    const atleta = mapAtletas[h.atletaId];
    let pontosVisual = h.pontos === 0 ? `<span style="color:var(--accent);">Justificada</span>` : `+${h.pontos}`;
    const btnEstorno = (userRole === "admin") ? `<button class="btn-acao btn-estornar" data-id="${h.id}" data-atleta="${h.atletaId}" data-pontos="${h.pontos}" style="color: var(--danger); border-color: var(--danger);" title="Desfazer"><i data-lucide="undo-2" style="width: 16px; height: 16px;"></i></button>` : '';
    tbody.innerHTML += `<tr><td>${(h.dataTreino?new Date(h.dataTreino + "T00:00:00").toLocaleDateString('pt-BR'):"-")}</td><td><strong>${atleta?atleta.nome:"Inativo"}</strong></td><td>${atleta?atleta.equipe:"-"}</td><td>${h.descTreino}<br><small style="color: var(--primary);">${h.regraDesc}</small></td><td style="text-align: center; color: var(--secondary); font-weight: bold;">${pontosVisual}</td><td style="text-align: right;">${btnEstorno}</td></tr>`;
  });
  lucide.createIcons();

  document.querySelectorAll(".btn-estornar").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const histId = e.currentTarget.dataset.id, atlId = e.currentTarget.dataset.atleta, ptsARemover = parseInt(e.currentTarget.dataset.pontos);
      if(!confirm(`Deseja realmente ESTORNAR este lançamento?`)) return;
      try { if (mapAtletas[atlId] && ptsARemover > 0) { await updateDoc(doc(db, "atletas", atlId), { pontuacaoTotal: increment(-ptsARemover) }); }
        await deleteDoc(doc(db, "historico_pontos", histId)); showToast("Estorno realizado!", "success"); atualizarTelas(); } catch (err) { showToast("Erro.", "error"); }
    });
  });
}

["filtroMesHistorico", "filtroEquipeHistorico", "filtroNomeHistorico"].forEach(id => { document.getElementById(id).addEventListener("input", filtrarHistorico); });
document.getElementById("btnLimparFiltrosExtrato").addEventListener("click", () => { document.getElementById("filtroMesHistorico").value = ""; document.getElementById("filtroEquipeHistorico").value = ""; document.getElementById("filtroNomeHistorico").value = ""; filtrarHistorico(); });

// =====================================================
// 📈 RELATÓRIO CONSOLIDADO SEGURO
// =====================================================
function setupRelatorioConsolidado() {
  document.getElementById("filtroAnoRelatorio").value = new Date().getFullYear();
  document.querySelector('[data-target="sub-relatorio"]').addEventListener("click", gerarRelatorioConsolidado);
  document.getElementById("btnGerarRelatorio").addEventListener("click", gerarRelatorioConsolidado);

  document.getElementById("btnExportarExcel").addEventListener("click", () => {
    const rows = document.getElementById("tabelaConsolidada").querySelectorAll("tr");
    if(rows.length <= 2) return showToast("Gere o relatório primeiro!", "error");
    let csv = "\uFEFF"; 
    rows.forEach(row => { const cols = row.querySelectorAll("th, td"); const rowData = Array.from(cols).map(c => `"${c.innerText.replace(/"/g, '""')}"`); csv += rowData.join(";") + "\r\n"; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `Relatorio_Atletas.csv`; a.click(); URL.revokeObjectURL(url); showToast("Download iniciado!", "success");
  });
}

function gerarRelatorioConsolidado() {
  const ano = String(document.getElementById("filtroAnoRelatorio").value).trim(); 
  const eqFiltro = document.getElementById("filtroEquipeRelatorio").value;
  const tbody = document.getElementById("listaRelatorio");
  const histAno = historicoCompleto.filter(h => h.dataTreino && h.dataTreino.startsWith(ano));
  let atletasRelatorio = Object.values(mapAtletas).filter(a => a.role === "atleta" && !a.equipe.startsWith("Fila") && a.equipe !== "Nenhuma");
  if (eqFiltro) atletasRelatorio = atletasRelatorio.filter(a => a.equipe === eqFiltro);

  if(atletasRelatorio.length === 0) { tbody.innerHTML = `<tr><td colspan='15'><div class="empty-state"><i data-lucide="frown"></i><p>Nenhum atleta.</p></div></td></tr>`; lucide.createIcons(); return; }

  let html = "";
  atletasRelatorio.forEach(atleta => {
    atleta.totalAnoTemp = 0; atleta.ptsMesTemp = [0,0,0,0,0,0,0,0,0,0,0,0];
    histAno.filter(h => h.atletaId === atleta.id).forEach(l => { if(l.dataTreino && l.dataTreino.includes("-")) { const mesInt = parseInt(l.dataTreino.split("-")[1], 10); if(!isNaN(mesInt) && mesInt >= 1 && mesInt <= 12) { const pts = Number(l.pontos) || 0; atleta.ptsMesTemp[mesInt - 1] += pts; atleta.totalAnoTemp += pts; } } });
  });

  atletasRelatorio.sort((a, b) => b.totalAnoTemp - a.totalAnoTemp);
  atletasRelatorio.forEach(atleta => {
    let colunasMeses = ""; atleta.ptsMesTemp.forEach(p => { colunasMeses += `<td style="text-align: center; color: ${p > 0 ? 'var(--secondary)' : '#ccc'}; font-weight: ${p > 0 ? '600' : '400'};">${p}</td>`; });
    const nomeVisual = atleta.ativo !== false ? `<strong>${atleta.nome}</strong>` : `<strong class="inativo-txt">${atleta.nome}</strong>`;
    html += `<tr><td>${nomeVisual}</td><td><small>${atleta.equipe}</small></td>${colunasMeses}<td style="text-align: center; background: var(--table-header); font-weight: bold; color: var(--primary);">${atleta.totalAnoTemp}</td></tr>`;
  });
  tbody.innerHTML = html;
}

// =====================================================
// 📝 REGRAS DE PONTUAÇÃO
// =====================================================
async function carregarRegras() {
  const tbody = document.getElementById("listaRegras");
  const snap = await getDocs(collection(db, "regras_pontuacao"));
  tbody.innerHTML = "";
  if (snap.empty) { tbody.innerHTML = `<tr><td colspan='4'><div class="empty-state"><i data-lucide="book-x"></i><p>Nenhuma regra.</p></div></td></tr>`; lucide.createIcons(); return; }
  snap.forEach(d => {
    const r = d.data(); const btnExcluir = (userRole === "admin") ? `<button class="btn-acao btn-excluir-regra" data-id="${d.id}" style="color: var(--danger); border-color: var(--danger);"><i data-lucide="trash" style="width: 16px;"></i></button>` : '';
    tbody.innerHTML += `<tr><td><strong>${r.descricao}</strong></td><td>${r.modalidade}</td><td><strong style="color: var(--primary);">+ ${r.pontos}</strong></td><td style="text-align:center;">${btnExcluir}</td></tr>`;
  });
  lucide.createIcons();
  document.querySelectorAll(".btn-excluir-regra").forEach(btn => { btn.addEventListener("click", async (e) => { if(confirm("Apagar regra?")) { await deleteDoc(doc(db, "regras_pontuacao", e.currentTarget.dataset.id)); carregarRegras(); } }); });
}

function setupModalRegras() {
  const modal = document.getElementById("modalRegra");
  document.getElementById("abrirModalRegra").addEventListener("click", () => modal.style.display = "flex");
  document.getElementById("fecharModalRegra").addEventListener("click", () => modal.style.display = "none");
  document.getElementById("salvarRegraBtn").addEventListener("click", async () => {
    if (userRole !== "admin") return showToast("Apenas admins.", "error");
    const desc = document.getElementById("regraDescricao").value.trim(), mod = document.getElementById("regraModalidade").value, pts = document.getElementById("regraPontos").value.trim();
    if (!desc || !pts) return;
    await addDoc(collection(db, "regras_pontuacao"), { descricao: desc, modalidade: mod, pontos: Number(pts), criadoEm: new Date().toISOString() });
    modal.style.display = "none"; document.getElementById("regraDescricao").value = ""; document.getElementById("regraPontos").value = ""; showToast("Regra criada!", "success"); carregarRegras();
  });
}

// =====================================================
// 📅 AGENDA DE EVENTOS
// =====================================================
function setupAgenda() {
  const modal = document.getElementById("modalEvento");
  if(document.getElementById("abrirModalEvento")) document.getElementById("abrirModalEvento").addEventListener("click", () => modal.style.display = "flex");
  if(document.getElementById("fecharModalEvento")) document.getElementById("fecharModalEvento").addEventListener("click", () => modal.style.display = "none");
  if(document.getElementById("salvarEventoBtn")) document.getElementById("salvarEventoBtn").addEventListener("click", async () => {
    const titulo = document.getElementById("eventoTitulo").value.trim(), local = document.getElementById("eventoLocal").value.trim();
    const mod = document.getElementById("eventoModalidade").value, data = document.getElementById("eventoData").value;
    if (!titulo || !data) return showToast("Título e Data são obrigatórios!", "error");
    
    await addDoc(collection(db, "agenda_eventos"), { titulo: titulo, local: local, modalidade: mod, data: data, criadoEm: new Date().toISOString() });
    modal.style.display = "none"; document.getElementById("eventoTitulo").value = ""; document.getElementById("eventoLocal").value = "";
    showToast("Evento agendado!", "success"); carregarAgenda();
  });
}

async function carregarAgenda() {
  const snap = await getDocs(query(collection(db, "agenda_eventos")));
  let eventos = []; snap.forEach(d => eventos.push({id: d.id, ...d.data()}));
  eventos.sort((a,b) => new Date(a.data) - new Date(b.data)); // Ordem cronológica
  
  const hoje = new Date().toISOString().split('T')[0];
  const futuros = eventos.filter(e => e.data >= hoje).slice(0, 4); // Mostra os 4 próximos eventos
  
  let html = "";
  futuros.forEach(e => {
    const d = new Date(e.data + "T00:00:00"); const mes = d.toLocaleString('pt-BR', {month: 'short'}).replace('.',''); const dia = d.getDate().toString().padStart(2, '0');
    let icon = e.modalidade === "Bicicleta" ? "🚴 Bicicleta" : e.modalidade === "Corrida" ? "🏃 Corrida" : "🤝 Ambas";
    const btnExcluir = (userRole === "admin") ? `<button class="btn-excluir-evento" data-id="${e.id}" style="background:transparent; border:none; color:var(--danger); cursor:pointer; float:right;" title="Excluir"><i data-lucide="x" style="width:18px;"></i></button>` : '';
    html += `<div class="agenda-item"><div class="agenda-data"><span>${mes}</span><strong>${dia}</strong></div><div class="agenda-info" style="flex:1;">${btnExcluir}<h4>${e.titulo}</h4><p>${icon} - ${e.local}</p></div></div>`;
  });
  
  document.getElementById("listaEventosAgenda").innerHTML = html || `<div class="empty-state" style="padding:10px;"><i data-lucide="calendar-x"></i><p style="font-size:0.85rem;">Nenhum evento futuro agendado.</p></div>`;
  lucide.createIcons();

  document.querySelectorAll(".btn-excluir-evento").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if(confirm("Cancelar este evento?")) { await deleteDoc(doc(db, "agenda_eventos", e.currentTarget.dataset.id)); showToast("Evento cancelado.", "info"); carregarAgenda(); }
    });
  });
}

// =====================================================
// 💰 FINANCEIRO (GASTOS DO PROGRAMA)
// =====================================================
function setupFinanceiro() {
  const btnSalvar = document.getElementById("btnSalvarDespesa");
  if(!btnSalvar) return;
  btnSalvar.addEventListener("click", async () => {
    if (userRole !== "admin") return showToast("Apenas admins podem registrar despesas.", "error");
    const desc = document.getElementById("descDespesa").value.trim(), cat = document.getElementById("catDespesa").value, val = document.getElementById("valorDespesa").value, data = document.getElementById("dataDespesa").value;
    if (!desc || !val || !data) return showToast("Preencha todos os campos financeiros!", "error");
    
    btnSalvar.textContent = "Salvando..."; btnSalvar.disabled = true;
    try {
      await addDoc(collection(db, "despesas"), { descricao: desc, categoria: cat, valor: parseFloat(val), data: data, criadoEm: new Date().toISOString() });
      document.getElementById("descDespesa").value = ""; document.getElementById("valorDespesa").value = ""; document.getElementById("dataDespesa").value = "";
      showToast("Despesa registrada!", "success"); carregarFinanceiro();
    } catch(err) { showToast("Erro ao registrar gasto.", "error"); }
    finally { btnSalvar.textContent = "Registrar Gasto"; btnSalvar.disabled = false; }
  });
}

async function carregarFinanceiro() {
  const snap = await getDocs(query(collection(db, "despesas"), orderBy("data", "desc")));
  let html = ""; let total = 0;
  
  snap.forEach(d => {
    const desp = d.data(); total += desp.valor;
    const btnExcluir = (userRole === "admin") ? `<button class="btn-acao btn-excluir-despesa" data-id="${d.id}" style="color:var(--danger); border-color:var(--danger); padding:4px;"><i data-lucide="trash" style="width:16px;"></i></button>` : '';
    const dataFormatada = new Date(desp.data + "T00:00:00").toLocaleDateString('pt-BR');
    html += `<tr><td>${dataFormatada}</td><td><strong>${desp.descricao}</strong></td><td>${desp.categoria}</td><td style="color:var(--danger); font-weight:bold;">${desp.valor.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td><td style="text-align:right;">${btnExcluir}</td></tr>`;
  });
  
  const tbody = document.getElementById("listaDespesas");
  if(tbody) tbody.innerHTML = html || `<tr><td colspan='5' style='text-align:center;'>Nenhuma despesa registrada.</td></tr>`;
  
  const totalFormatado = total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  if(document.getElementById("totalInvestimento")) document.getElementById("totalInvestimento").textContent = totalFormatado;
  lucide.createIcons();

  document.querySelectorAll(".btn-excluir-despesa").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if(confirm("Excluir este registro financeiro permanentemente?")) { await deleteDoc(doc(db, "despesas", e.currentTarget.dataset.id)); showToast("Despesa excluída.", "info"); carregarFinanceiro(); }
    });
  });
}

// =====================================================
// ⚙️ CONFIGURAÇÕES (Aparência e Conta)
// =====================================================
function setupConfiguracoes() {
  document.querySelectorAll(".btn-zoom").forEach(btn => { btn.addEventListener("click", (e) => { document.querySelectorAll(".btn-zoom").forEach(b => { b.style.background = "transparent"; b.style.color = "var(--text)"; }); e.target.style.background = "var(--primary)"; e.target.style.color = "white"; document.documentElement.style.fontSize = e.target.dataset.size; }); });

  const aplicarTema = (tema) => { if(tema === "dark") { document.body.setAttribute("data-theme", "dark"); localStorage.setItem("theme", "dark"); } else { document.body.removeAttribute("data-theme"); localStorage.setItem("theme", "light"); } Chart.defaults.color = tema === 'dark' ? '#aaa' : '#666'; if(graficoLinhaInstancia) graficoLinhaInstancia.update(); if(graficoRoscaInstancia) graficoRoscaInstancia.update(); };
  if (localStorage.getItem("theme") === "dark") aplicarTema("dark");
  document.getElementById("btnTemaClaro").addEventListener("click", () => aplicarTema("light")); document.getElementById("btnTemaEscuro").addEventListener("click", () => aplicarTema("dark"));

  document.getElementById("btnSalvarConta").addEventListener("click", async () => {
    const senhaAtual = document.getElementById("confSenhaAtual").value, novoEmail = document.getElementById("confNovoEmail").value.trim(), novaSenha = document.getElementById("confNovaSenha").value.trim(), btn = document.getElementById("btnSalvarConta");
    if(!senhaAtual) return showToast("A senha atual é obrigatória.", "error"); if(!novoEmail && !novaSenha) return;
    btn.textContent = "Autenticando..."; btn.disabled = true;
    try {
      const user = auth.currentUser; const credential = EmailAuthProvider.credential(user.email, senhaAtual); await reauthenticateWithCredential(user, credential);
      btn.textContent = "Salvando..."; if(novoEmail) { await updateEmail(user, novoEmail); } if(novaSenha) { await updatePassword(user, novaSenha); }
      showToast("Conta atualizada com sucesso!", "success"); document.getElementById("confSenhaAtual").value = ""; document.getElementById("confNovoEmail").value = ""; document.getElementById("confNovaSenha").value = "";
    } catch(err) { if(err.code === "auth/wrong-password") showToast("Senha incorreta.", "error"); else showToast("Erro.", "error"); }
    btn.innerHTML = `<i data-lucide="save"></i> Salvar Alterações`; btn.disabled = false; lucide.createIcons();
  });
}

function setupLimparBase() {
  const btnL = document.getElementById("btnLimparBase"); if(!btnL) return;
  btnL.addEventListener("click", async () => {
    if (userRole !== "admin") return;
    if (prompt("CUIDADO! Isso apagará TODOS os atletas, regras e pontuações do sistema.\n\nDigite 'LIMPAR' para confirmar:") !== "LIMPAR") return;
    if (!prompt("A sua senha de login para autorizar:")) return;
    const btn = document.getElementById("btnLimparBase"); btn.innerHTML = "Apagando a base..."; btn.disabled = true;
    try {
      const snapH = await getDocs(collection(db, "historico_pontos")); snapH.forEach(async (d) => { await deleteDoc(doc(db, "historico_pontos", d.id)); });
      const snapR = await getDocs(collection(db, "regras_pontuacao")); snapR.forEach(async (d) => { await deleteDoc(doc(db, "regras_pontuacao", d.id)); });
      const snapA = await getDocs(collection(db, "atletas")); snapA.forEach(async (d) => { if (d.id !== auth.currentUser.uid) await deleteDoc(doc(db, "atletas", d.id)); });
      showToast("Base Limpa!", "success"); setTimeout(() => window.location.reload(), 2000); 
    } catch(err) { showToast("Erro ao apagar.", "error"); } finally { btn.innerHTML = `<i data-lucide="trash-2"></i> Limpar Toda a Base de Dados`; btn.disabled = false; lucide.createIcons(); }
  });
}
