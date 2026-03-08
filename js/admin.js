import { 
  auth, db, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc,
  onAuthStateChanged, signOut, query, where
} from "./firebase.js";

let userRole = "atleta";
let historicoCompleto = []; 
let mapAtletas = {};        
let graficoInstancia = null; 

// =====================================================
// 🔔 SISTEMA DE NOTIFICAÇÕES
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
// 🌙 TEMA ESCURO
// =====================================================
function setupThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (localStorage.getItem("theme") === "dark") document.body.setAttribute("data-theme", "dark");
  btn.addEventListener("click", () => {
    if (document.body.getAttribute("data-theme") === "dark") {
      document.body.removeAttribute("data-theme"); localStorage.setItem("theme", "light");
    } else {
      document.body.setAttribute("data-theme", "dark"); localStorage.setItem("theme", "dark");
    }
    Chart.defaults.color = document.body.getAttribute('data-theme') === 'dark' ? '#aaa' : '#666';
    if(graficoInstancia) graficoInstancia.update();
  });
}

// =====================================================
// 🔒 INICIALIZAÇÃO
// =====================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    if (docSnap.exists() && (docSnap.data().role === "admin" || docSnap.data().role === "comite")) {
      userRole = docSnap.data().role;
      iniciarPainelAdmin();
    } else { window.location.href = "index.html"; }
  } else { window.location.href = "index.html"; }
});

function iniciarPainelAdmin() {
  Chart.defaults.color = document.body.getAttribute('data-theme') === 'dark' ? '#aaa' : '#666';
  setupThemeToggle(); setupNavigation(); setupSubTabs(); configurarLogout();
  setupCadastrarPessoa(); setupAprovacoes(); setupModalRegras();
  setupContabilizacao(); setupPesquisaEquipes(); setupRelatorioConsolidado();
  setupModalEditar(); setupLimparBase();
  atualizarTelas();
}

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
      if(target === "visao-geral" && graficoInstancia) graficoInstancia.update();
    });
  });
}

function setupSubTabs() {
  if (userRole !== "admin") {
    document.querySelectorAll(".admin-only-tab, .admin-only-option").forEach(el => el.style.display = "none");
    document.querySelector('[data-target="sub-cadastrar"]').click();
  } else {
    document.querySelector('[data-target="sub-aprovacoes"]').click();
  }
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
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if(confirm("Deseja realmente sair?")) { await signOut(auth); localStorage.clear(); window.location.href = "index.html"; }
  });
}

// 🛡️ A ORDEM CERTA DAS CHAMADAS DE DADOS
async function atualizarTelas() {
  if (userRole === "admin") setupAprovacoes();
  await carregarEquipesEDashboard(); 
  await carregarRegras();
  await carregarHistorico(); 
  
  // Atualiza também o Relatório caso o utilizador esteja lá
  if (document.getElementById("sub-relatorio").classList.contains("active")) {
    gerarRelatorioConsolidado();
  }
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
// 📊 DASHBOARD & EQUIPES & EDIÇÃO
// =====================================================
function setupPesquisaEquipes() {
  document.getElementById("buscaEquipes").addEventListener("keyup", (e) => {
    const termo = e.target.value.toLowerCase();
    document.querySelectorAll(".t-content.active tbody tr").forEach(tr => {
      const nome = tr.querySelector("strong")?.textContent.toLowerCase() || "";
      tr.style.display = nome.includes(termo) ? "" : "none";
    });
  });
}

function renderizarGrafico(ptsBike, ptsCorrida) {
  const ctx = document.getElementById('graficoEvolucao');
  if(!ctx) return;
  if(graficoInstancia) graficoInstancia.destroy();
  graficoInstancia = new Chart(ctx, {
    type: 'bar',
    data: { labels: ['Pontuação Geral das Equipes'], datasets: [ { label: 'Bicicleta 🚴', data: [ptsBike], backgroundColor: '#009bc1', borderRadius: 8 }, { label: 'Corrida 🏃', data: [ptsCorrida], backgroundColor: '#00b37e', borderRadius: 8 } ] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, grid: { color: document.body.getAttribute('data-theme') === 'dark' ? '#333' : '#eee' } } } }
  });
}

async function carregarEquipesEDashboard() {
  const tbFila = document.getElementById("listaFila"), tbBike = document.getElementById("listaBicicleta"), tbCorrida = document.getElementById("listaCorrida"), tbComite = document.getElementById("listaComite");
  const q = query(collection(db, "atletas"), where("status", "==", "Aprovado"));
  const snap = await getDocs(q);
  
  let htmlFila = "", htmlBike = "", htmlCorrida = "", htmlComite = "";
  let contFila = 0, contBike = 0, contCorrida = 0, contComite = 0, ptsBike = 0, ptsCorrida = 0;
  let todosAtletas = []; mapAtletas = {}; 

  const emptyState = (msg, icone) => `<tr><td colspan='2'><div class="empty-state"><i data-lucide="${icone}"></i><p>${msg}</p></div></td></tr>`;

  let listaOrdenada = [];
  snap.forEach(d => { mapAtletas[d.id] = { id: d.id, ...d.data() }; listaOrdenada.push(mapAtletas[d.id]); });
  listaOrdenada.sort((a, b) => a.nome.localeCompare(b.nome));

  listaOrdenada.forEach(u => {
    const isDono = auth.currentUser.uid === u.id;
    const pts = Number(u.pontuacaoTotal) || 0; 
    const ativo = u.ativo !== false; 
    const classeInativo = !ativo ? 'inativo-txt' : '';
    
    const switchAtivo = (u.role === 'atleta' && userRole === 'admin') ? `<label class="switch" title="Ativar/Desativar Atleta"><input type="checkbox" class="toggle-ativo" data-id="${u.id}" ${ativo ? 'checked' : ''}><span class="slider"></span></label>` : '';
    const btnEditar = `<button class="btn-acao btn-editar-membro" data-id="${u.id}" data-nome="${u.nome}" data-email="${u.email}" data-eq="${u.equipe}" style="color: var(--warning); border-color: var(--warning); padding: 4px; margin-left: 10px;" title="Editar"><i data-lucide="edit-2" style="width: 16px; height: 16px;"></i></button>`;
    const btnExcluir = (!isDono && userRole === "admin") ? `<button class="btn-acao btn-excluir-membro" data-id="${u.id}" style="color: red; border: 0; padding: 4px; margin-left: 5px;" title="Remover Definitivo"><i data-lucide="x-circle" style="width: 18px; height: 18px;"></i></button>` : '';

    if (u.equipe === "Fila de Espera") {
      const btnMoverBike = `<button class="btn-acao btn-mover" data-id="${u.id}" data-eq="Bicicleta" title="Mover para Bicicleta" style="padding: 4px 8px; font-size: 1.1rem; border-color: var(--primary);">🚴</button>`;
      const btnMoverCorrida = `<button class="btn-acao btn-mover" data-id="${u.id}" data-eq="Corrida" title="Mover para Corrida" style="padding: 4px 8px; font-size: 1.1rem; border-color: var(--secondary);">🏃</button>`;
      htmlFila += `<tr><td style="padding: 10px;"><strong>${u.nome}</strong></td><td style="text-align: right; padding: 10px; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">${btnMoverBike} ${btnMoverCorrida} <span style="border-left: 1px solid var(--border); height: 20px; margin: 0 5px;"></span> ${btnEditar} ${btnExcluir}</td></tr>`;
      contFila++;
    } else {
      const linha = `<tr><td style="padding: 10px;" class="${classeInativo}"><strong>${u.nome}</strong> ${isDono ? `<span style="font-size: 0.75rem; color: #999;">(Você)</span>` : ''}${u.role === 'atleta' ? `<br><small style="color: var(--primary); font-weight: 600;">🏆 ${pts} pts</small>` : ''}</td><td style="text-align: right; padding: 10px; display: flex; justify-content: flex-end; align-items: center;">${switchAtivo} ${btnEditar} ${btnExcluir}</td></tr>`;
      if (u.role === "admin" || u.role === "comite") { htmlComite += linha; contComite++; }
      else if (u.equipe === "Corrida") { htmlCorrida += linha; contCorrida++; ptsCorrida += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe}); }
      else if (u.equipe === "Bicicleta") { htmlBike += linha; contBike++; ptsBike += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe}); }
    }
  });

  if(tbFila) tbFila.innerHTML = htmlFila || emptyState("Fila limpa! Ninguém aguardando.", "check-circle");
  if(tbComite) tbComite.innerHTML = htmlComite || emptyState("Nenhum membro.", "users");
  if(tbBike) tbBike.innerHTML = htmlBike || emptyState("A equipe de Bicicleta está vazia.", "bike");
  if(tbCorrida) tbCorrida.innerHTML = htmlCorrida || emptyState("A equipe de Corrida está vazia.", "footprints");
  if(document.getElementById("totalFila")) document.getElementById("totalFila").textContent = contFila;
  if(document.getElementById("totalComite")) document.getElementById("totalComite").textContent = contComite;
  if(document.getElementById("totalBike")) document.getElementById("totalBike").textContent = contBike;
  if(document.getElementById("totalCorrida")) document.getElementById("totalCorrida").textContent = contCorrida;

  renderizarGrafico(ptsBike, ptsCorrida);
  let coroaBike = "", coroaCorrida = "";
  if (ptsBike > ptsCorrida && ptsBike > 0) coroaBike = "👑 ";
  if (ptsCorrida > ptsBike && ptsCorrida > 0) coroaCorrida = "👑 ";
  document.getElementById("ptsBikeTxt").parentElement.innerHTML = `${coroaBike}🚴 Bike (<span id="ptsBikeTxt">${ptsBike}</span> pts)`;
  document.getElementById("ptsCorridaTxt").parentElement.innerHTML = `${coroaCorrida}🏃 Corrida (<span id="ptsCorridaTxt">${ptsCorrida}</span> pts)`;
  document.getElementById("barBike").style.width = `${(ptsBike + ptsCorrida === 0) ? 50 : (ptsBike / (ptsBike + ptsCorrida)) * 100}%`;
  document.getElementById("barCorrida").style.width = `${(ptsBike + ptsCorrida === 0) ? 50 : (ptsCorrida / (ptsBike + ptsCorrida)) * 100}%`;

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

  document.querySelectorAll(".btn-mover").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id; const eq = e.currentTarget.dataset.eq;
      if(confirm(`Mover pessoa para a equipe de ${eq}?`)) { await updateDoc(doc(db, "atletas", id), { equipe: eq }); showToast(`Movido para ${eq}!`, "success"); atualizarTelas(); }
    });
  });

  document.querySelectorAll(".btn-excluir-membro").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if(confirm("ALERTA: Deseja apagar definitivamente? O histórico será perdido. (Para preservar, use o botão Inativar).")) {
        await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id)); showToast("Membro excluído.", "info"); atualizarTelas();
      }
    });
  });

  document.querySelectorAll(".toggle-ativo").forEach(chk => {
    chk.addEventListener("change", async (e) => {
      const isAtivo = e.target.checked;
      await updateDoc(doc(db, "atletas", e.target.dataset.id), { ativo: isAtivo });
      const td = e.target.closest('tr').querySelector('td');
      if(isAtivo) td.classList.remove('inativo-txt'); else td.classList.add('inativo-txt');
      showToast(isAtivo ? "Atleta Ativado!" : "Atleta Inativado.", "info");
    });
  });

  document.querySelectorAll(".btn-editar-membro").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const b = e.currentTarget; document.getElementById("editId").value = b.dataset.id; document.getElementById("editNome").value = b.dataset.nome;
      document.getElementById("editEmail").value = b.dataset.email !== "undefined" ? b.dataset.email : "";
      let papelVal = b.dataset.eq; if(b.dataset.eq === "Nenhuma") papelVal = "Comitê"; 
      document.getElementById("editPapel").value = papelVal; document.getElementById("modalEditarAtleta").style.display = "flex";
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
      await addDoc(collection(db, "atletas"), { nome: nome, email: email, role: role, equipe: equipe, status: "Aprovado", ativo: true, pontuacaoTotal: 0, criadoEm: new Date().toISOString() });
      showToast(`${nome} adicionado!`, "success");
      document.getElementById("novoNome").value = ""; document.getElementById("novoEmail").value = "";
      btn.textContent = "Adicionar ao Sistema"; btn.disabled = false; atualizarTelas(); 
      if(equipe === "Fila de Espera") document.querySelector('[data-target="tab-fila"]').click(); else if(equipe === "Bicicleta") document.querySelector('[data-target="tab-bike"]').click(); else if(equipe === "Corrida") document.querySelector('[data-target="tab-corrida"]').click();
      document.querySelector('[data-target="sub-equipes"]').click();
    } catch (error) { showToast("Erro ao cadastrar.", "error"); btn.textContent = "Adicionar ao Sistema"; btn.disabled = false; }
  });
}

// =====================================================
// 💯 LANÇAR PONTUAÇÃO E FALTAS 
// =====================================================
function setupContabilizacao() {
  document.getElementById("dataTreino").valueAsDate = new Date();

  document.getElementById("modTreino").addEventListener("change", async (e) => {
    const mod = e.target.value; const areaRegras = document.getElementById("areaSelecaoRegras"), listaRegras = document.getElementById("listaRegrasTreino"), btnGerar = document.getElementById("btnGerarLista");
    document.getElementById("areaTabelaPontuacao").style.display = "none"; 
    if (!mod) { areaRegras.style.display = "none"; btnGerar.style.display = "none"; return; }
    listaRegras.innerHTML = "<span style='font-size: 0.85rem; color: #999;'>Buscando regras...</span>"; areaRegras.style.display = "block";
    const qRegras = query(collection(db, "regras_pontuacao"), where("modalidade", "in", ["Ambas", mod]));
    const snapRegras = await getDocs(qRegras);
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

  document.getElementById("btnSalvarPontuacao").addEventListener("click", salvarPontuacoes);
}

async function gerarTabelaContabilizacao(modalidade, regras) {
  const tabela = document.getElementById("tabelaPontuacao");
  const qAtletas = query(collection(db, "atletas"), where("status", "==", "Aprovado"), where("equipe", "==", modalidade));
  const snapAtletas = await getDocs(qAtletas);
  let atletas = [];
  snapAtletas.forEach(d => { if(d.data().ativo !== false) atletas.push({id: d.id, ...d.data()}); });
  atletas.sort((a, b) => a.nome.localeCompare(b.nome));

  if (atletas.length === 0) { tabela.innerHTML = `<tr><td style='text-align:center; padding: 20px;'><div class="empty-state"><i data-lucide="ghost"></i><p>Nenhum atleta ativo na equipe de ${modalidade}.</p></div></td></tr>`; lucide.createIcons(); return; }

  let thead = `<thead><tr><th style="min-width: 200px; max-width: 300px; vertical-align: bottom;">Nome do Atleta</th><th style="text-align: center; width: 90px; color: var(--accent); border-right: 2px solid var(--border);">Falta<br>Justificada<div style="margin-top: 10px; font-size: 0.75rem; color: #999; display: flex; align-items: center; justify-content: center; gap: 4px;"><input type="checkbox" id="checkMasterFalta" style="margin:0; width:14px; height:14px; accent-color:var(--accent);"> Todos</div></th>`;
  regras.forEach(r => { thead += `<th style="text-align: center; min-width: 100px;" title="${r.descricao}"><div style="font-size: 0.8rem; line-height: 1.2; margin-bottom: 5px; font-weight: 500;">${r.descricao}</div><strong style="color: var(--secondary); font-size: 1rem;">+${r.pontos} pts</strong><div style="margin-top: 10px; font-size: 0.75rem; color: #999; display: flex; align-items: center; justify-content: center; gap: 4px;"><input type="checkbox" class="checkMasterRegra" data-regra-id="${r.id}" style="margin:0; width:14px; height:14px; accent-color:var(--primary);"> Todos</div></th>`; });
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

  document.querySelectorAll(".checkMasterRegra").forEach(master => {
    master.addEventListener("change", (e) => {
      document.querySelectorAll(`.check-ponto[data-regra-id="${e.target.dataset.regraId}"]`).forEach(chk => { if(!chk.disabled) chk.checked = e.target.checked; });
    });
  });
  document.getElementById("checkMasterFalta").addEventListener("change", (e) => {
    document.querySelectorAll(".check-falta").forEach(chk => { chk.checked = e.target.checked; chk.dispatchEvent(new Event('change')); });
  });
  document.querySelectorAll(".check-falta").forEach(chk => {
    chk.addEventListener("change", (e) => {
      e.target.closest("tr").querySelectorAll(".check-ponto").forEach(p => { p.disabled = e.target.checked; if(e.target.checked) p.checked = false; });
    });
  });
}

async function salvarPontuacoes() {
  const desc = document.getElementById("descTreino").value.trim(), data = document.getElementById("dataTreino").value;
  const checksPontos = document.querySelectorAll(".check-ponto:checked"), checksFaltas = document.querySelectorAll(".check-falta:checked");

  if (checksPontos.length === 0 && checksFaltas.length === 0) return showToast("Nenhum lançamento selecionado!", "error");
  if (!confirm(`RESUMO:\n- ${checksPontos.length} Itens de pontuação marcados.\n- ${checksFaltas.length} Faltas Justificadas.\n\nConfirmar lançamento no sistema?`)) return;

  const btn = document.getElementById("btnSalvarPontuacao"); btn.innerHTML = "Registrando na Base..."; btn.disabled = true;

  try {
    let pontosPorAtleta = {};
    for (let f of checksFaltas) { await addDoc(collection(db, "historico_pontos"), { atletaId: f.dataset.atletaId, regraId: "falta_just", regraDesc: "Falta Justificada", pontos: 0, descTreino: desc, dataTreino: data, criadoEm: new Date().toISOString() }); }
    for (let check of checksPontos) {
      const aId = check.dataset.atletaId, pts = Number(check.dataset.pontos) || 0;
      await addDoc(collection(db, "historico_pontos"), { atletaId: aId, regraId: check.dataset.regraId, regraDesc: check.dataset.regraDesc, pontos: pts, descTreino: desc, dataTreino: data, criadoEm: new Date().toISOString() });
      if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0; pontosPorAtleta[aId] += pts;
    }

    for (let aId in pontosPorAtleta) {
      const atletaRef = doc(db, "atletas", aId); const atletaSnap = await getDoc(atletaRef);
      if (atletaSnap.exists()) {
        const totalAtual = Number(atletaSnap.data().pontuacaoTotal) || 0;
        await updateDoc(atletaRef, { pontuacaoTotal: totalAtual + pontosPorAtleta[aId] });
      }
    }

    showToast("Lançamentos efetuados com sucesso!", "success");
    document.getElementById("areaTabelaPontuacao").style.display = "none"; document.getElementById("areaSelecaoRegras").style.display = "none";
    document.getElementById("btnGerarLista").style.display = "none"; document.getElementById("descTreino").value = ""; document.getElementById("modTreino").value = "";
    atualizarTelas(); 
  } catch (error) { console.error(error); showToast("Erro ao salvar.", "error"); } 
  finally { btn.innerHTML = `<i data-lucide="check-circle"></i> Salvar Lançamentos e Faltas`; btn.disabled = false; lucide.createIcons(); }
}

// =====================================================
// 📜 EXTRATO E LIMPAR FILTROS (BLINDADO CONTRA ERROS DO FIREBASE)
// =====================================================
async function carregarHistorico() {
  try {
    // Busca Pura - Sem OrderBy para evitar erro de Missing Index no Firebase
    const snap = await getDocs(collection(db, "historico_pontos"));
    historicoCompleto = [];
    snap.forEach(d => { historicoCompleto.push({ id: d.id, ...d.data() }); });
    
    // Ordena do mais recente para o mais antigo via Javascript
    historicoCompleto.sort((a, b) => {
      const dataA = a.criadoEm || "";
      const dataB = b.criadoEm || "";
      return dataB.localeCompare(dataA);
    });
    
    const inputMes = document.getElementById("filtroMesHistorico");
    if(!inputMes.value) {
      const hoje = new Date();
      inputMes.value = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    filtrarHistorico();
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    document.getElementById("listaHistorico").innerHTML = `<tr><td colspan='6'><div class="empty-state"><i data-lucide="alert-triangle"></i><p>Erro de conexão ao buscar histórico.</p></div></td></tr>`;
    lucide.createIcons();
  }
}

function filtrarHistorico() {
  const mes = document.getElementById("filtroMesHistorico").value;
  const eq = document.getElementById("filtroEquipeHistorico").value;
  const nome = document.getElementById("filtroNomeHistorico").value.toLowerCase();

  const dadosFiltrados = historicoCompleto.filter(h => {
    const atleta = mapAtletas[h.atletaId] || { nome: "", equipe: "" };
    const dataValida = h.dataTreino || "";
    return (!mes || dataValida.startsWith(mes)) && (!eq || atleta.equipe === eq) && (!nome || (atleta.nome && atleta.nome.toLowerCase().includes(nome)));
  });
  renderHistorico(dadosFiltrados);
}

function renderHistorico(dados) {
  const tbody = document.getElementById("listaHistorico");
  tbody.innerHTML = "";
  if (dados.length === 0) { tbody.innerHTML = `<tr><td colspan='6'><div class="empty-state"><i data-lucide="file-search"></i><p>Nenhum lançamento no extrato para este filtro.</p></div></td></tr>`; lucide.createIcons(); return; }

  dados.forEach(h => {
    const atleta = mapAtletas[h.atletaId];
    const nomeAtleta = atleta ? atleta.nome : "Atleta Excluído/Inativo";
    const equipeAtleta = atleta ? atleta.equipe : "-";
    let dataFormatada = "-";
    if(h.dataTreino) { const d = new Date(h.dataTreino + "T00:00:00"); dataFormatada = d.toLocaleDateString('pt-BR'); }
    
    let pontosVisual = h.pontos === 0 ? `<span style="color:var(--accent);">Justificada</span>` : `+${h.pontos}`;
    const btnEstorno = (userRole === "admin") ? `<button class="btn-acao btn-estornar" data-id="${h.id}" data-atleta="${h.atletaId}" data-pontos="${h.pontos}" style="color: var(--danger); border-color: var(--danger);" title="Desfazer"><i data-lucide="undo-2" style="width: 16px; height: 16px;"></i></button>` : '';

    tbody.innerHTML += `<tr><td>${dataFormatada}</td><td><strong>${nomeAtleta}</strong></td><td>${equipeAtleta}</td><td>${h.descTreino}<br><small style="color: var(--primary);">${h.regraDesc}</small></td><td style="text-align: center; color: var(--secondary); font-weight: bold;">${pontosVisual}</td><td style="text-align: right;">${btnEstorno}</td></tr>`;
  });
  lucide.createIcons();

  document.querySelectorAll(".btn-estornar").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const histId = e.currentTarget.dataset.id, atlId = e.currentTarget.dataset.atleta, ptsARemover = parseInt(e.currentTarget.dataset.pontos);
      if(!confirm(`Atenção: Deseja realmente ESTORNAR este lançamento?`)) return;

      try {
        if (mapAtletas[atlId] && ptsARemover > 0) {
          const atletaRef = doc(db, "atletas", atlId); const atletaSnap = await getDoc(atletaRef);
          if (atletaSnap.exists()) {
            const novoTotal = Math.max(0, (Number(atletaSnap.data().pontuacaoTotal) || 0) - ptsARemover); 
            await updateDoc(atletaRef, { pontuacaoTotal: novoTotal });
          }
        }
        await deleteDoc(doc(db, "historico_pontos", histId));
        showToast("Estorno realizado com sucesso!", "success"); atualizarTelas(); 
      } catch (err) { showToast("Erro no estorno.", "error"); }
    });
  });
}

["filtroMesHistorico", "filtroEquipeHistorico", "filtroNomeHistorico"].forEach(id => { document.getElementById(id).addEventListener("input", filtrarHistorico); });
document.getElementById("btnLimparFiltrosExtrato").addEventListener("click", () => {
  const hoje = new Date(); document.getElementById("filtroMesHistorico").value = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}`;
  document.getElementById("filtroEquipeHistorico").value = ""; document.getElementById("filtroNomeHistorico").value = ""; filtrarHistorico(); showToast("Filtros limpos!", "info");
});

// =====================================================
// 📈 RELATÓRIO CONSOLIDADO SEGURO
// =====================================================
function setupRelatorioConsolidado() {
  document.getElementById("filtroAnoRelatorio").value = new Date().getFullYear();
  document.querySelector('[data-target="sub-relatorio"]').addEventListener("click", gerarRelatorioConsolidado);
  document.getElementById("btnGerarRelatorio").addEventListener("click", gerarRelatorioConsolidado);

  document.getElementById("btnExportarExcel").addEventListener("click", () => {
    const tabela = document.getElementById("tabelaConsolidada");
    const rows = tabela.querySelectorAll("tr");
    if(rows.length <= 2) return showToast("Gere o relatório primeiro!", "error");
    let csv = "\uFEFF"; 
    rows.forEach(row => { const cols = row.querySelectorAll("th, td"); const rowData = Array.from(cols).map(c => `"${c.innerText.replace(/"/g, '""')}"`); csv += rowData.join(";") + "\r\n"; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `Relatorio_Atletas_${document.getElementById("filtroAnoRelatorio").value}.csv`; a.click(); URL.revokeObjectURL(url); showToast("Download iniciado!", "success");
  });
}

function gerarRelatorioConsolidado() {
  const anoInput = document.getElementById("filtroAnoRelatorio").value;
  if (!anoInput) return;
  const ano = String(anoInput).trim(); 
  
  const eqFiltro = document.getElementById("filtroEquipeRelatorio").value;
  const tbody = document.getElementById("listaRelatorio");
  
  const histAno = historicoCompleto.filter(h => h.dataTreino && h.dataTreino.startsWith(ano));
  let atletasRelatorio = Object.values(mapAtletas).filter(a => a.role === "atleta" && a.equipe !== "Fila de Espera" && a.equipe !== "Nenhuma");
  if (eqFiltro) atletasRelatorio = atletasRelatorio.filter(a => a.equipe === eqFiltro);

  if(atletasRelatorio.length === 0) {
    tbody.innerHTML = `<tr><td colspan='15'><div class="empty-state"><i data-lucide="frown"></i><p>Nenhum atleta validado neste filtro.</p></div></td></tr>`; lucide.createIcons(); return;
  }

  let html = "";
  atletasRelatorio.forEach(atleta => {
    atleta.totalAnoTemp = 0; atleta.ptsMesTemp = [0,0,0,0,0,0,0,0,0,0,0,0];
    histAno.filter(h => h.atletaId === atleta.id).forEach(lancamento => {
      // BLINDAGEM NO CÁLCULO
      if(lancamento.dataTreino && lancamento.dataTreino.includes("-")) {
        const mesInt = parseInt(lancamento.dataTreino.split("-")[1], 10); 
        if(!isNaN(mesInt) && mesInt >= 1 && mesInt <= 12) {
          const ptsLcto = Number(lancamento.pontos) || 0;
          atleta.ptsMesTemp[mesInt - 1] += ptsLcto; atleta.totalAnoTemp += ptsLcto;
        }
      }
    });
  });

  atletasRelatorio.sort((a, b) => b.totalAnoTemp - a.totalAnoTemp);
  atletasRelatorio.forEach(atleta => {
    let colunasMeses = "";
    atleta.ptsMesTemp.forEach(p => { colunasMeses += `<td style="text-align: center; color: ${p > 0 ? 'var(--secondary)' : '#ccc'}; font-weight: ${p > 0 ? '600' : '400'};">${p}</td>`; });
    const nomeVisual = atleta.ativo !== false ? `<strong>${atleta.nome}</strong>` : `<strong class="inativo-txt" title="Atleta Inativo">${atleta.nome}</strong>`;
    html += `<tr><td>${nomeVisual}</td><td><small style="color: ${atleta.equipe === 'Bicicleta' ? 'var(--primary)' : 'var(--secondary)'}">${atleta.equipe}</small></td>${colunasMeses}<td style="text-align: center; background: var(--table-header); font-weight: bold; color: var(--primary);">${atleta.totalAnoTemp}</td></tr>`;
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
  if (snap.empty) { tbody.innerHTML = `<tr><td colspan='4'><div class="empty-state"><i data-lucide="book-x"></i><p>Cadastre as regras de pontos para começar.</p></div></td></tr>`; lucide.createIcons(); return; }

  snap.forEach(d => {
    const r = d.data();
    const btnExcluir = (userRole === "admin") ? `<button class="btn-acao btn-excluir-regra" data-id="${d.id}" style="color: var(--danger); border-color: var(--danger);"><i data-lucide="trash" style="width: 16px; height:16px;"></i></button>` : '';
    tbody.innerHTML += `<tr><td><strong>${r.descricao}</strong></td><td>${r.modalidade}</td><td><strong style="color: var(--primary); font-size: 1.1rem;">+ ${r.pontos}</strong></td><td style="text-align:center;">${btnExcluir}</td></tr>`;
  });

  lucide.createIcons();
  document.querySelectorAll(".btn-excluir-regra").forEach(btn => {
    btn.addEventListener("click", async (e) => { if(confirm("Deseja apagar esta regra?")) { await deleteDoc(doc(db, "regras_pontuacao", e.currentTarget.dataset.id)); carregarRegras(); } });
  });
}

function setupModalRegras() {
  const modal = document.getElementById("modalRegra");
  document.getElementById("abrirModalRegra").addEventListener("click", () => modal.style.display = "flex");
  document.getElementById("fecharModalRegra").addEventListener("click", () => modal.style.display = "none");
  document.getElementById("salvarRegraBtn").addEventListener("click", async () => {
    if (userRole !== "admin") return showToast("Apenas administradores podem criar regras.", "error");
    const desc = document.getElementById("regraDescricao").value.trim(), mod = document.getElementById("regraModalidade").value, pts = document.getElementById("regraPontos").value.trim();
    if (!desc || !pts) return showToast("Preencha a descrição e os pontos!", "error");
    await addDoc(collection(db, "regras_pontuacao"), { descricao: desc, modalidade: mod, pontos: Number(pts), criadoEm: new Date().toISOString() });
    modal.style.display = "none"; document.getElementById("regraDescricao").value = ""; document.getElementById("regraPontos").value = "";
    showToast("Regra criada!", "success"); carregarRegras();
  });
}

// =====================================================
// 💣 LIMPAR BASE DE DADOS (ZONA DE PERIGO)
// =====================================================
function setupLimparBase() {
  const btnL = document.getElementById("btnLimparBase");
  if(!btnL) return;
  btnL.addEventListener("click", async () => {
    if (userRole !== "admin") return;
    const confirm1 = prompt("CUIDADO! Isso apagará TODOS os atletas, regras e pontuações do sistema permanentemente.\n\nDigite 'LIMPAR' para confirmar:");
    if (confirm1 !== "LIMPAR") { showToast("Ação cancelada.", "info"); return; }
    
    const confirm2 = prompt("Tem a certeza absoluta? O seu usuário Admin será o único mantido.\n\nDigite a sua senha de login para autorizar:");
    if (!confirm2) { showToast("Ação cancelada.", "info"); return; }

    const btn = document.getElementById("btnLimparBase"); btn.innerHTML = "Apagando a base..."; btn.disabled = true;
    try {
      const snapH = await getDocs(collection(db, "historico_pontos")); snapH.forEach(async (d) => { await deleteDoc(doc(db, "historico_pontos", d.id)); });
      const snapR = await getDocs(collection(db, "regras_pontuacao")); snapR.forEach(async (d) => { await deleteDoc(doc(db, "regras_pontuacao", d.id)); });
      const snapA = await getDocs(collection(db, "atletas")); snapA.forEach(async (d) => { if (d.id !== auth.currentUser.uid) await deleteDoc(doc(db, "atletas", d.id)); });
      showToast("Base de Dados Limpa com Sucesso!", "success"); setTimeout(() => window.location.reload(), 2000); 
    } catch(err) { showToast("Erro ao tentar apagar os dados.", "error"); } 
    finally { btn.innerHTML = `<i data-lucide="trash-2"></i> Limpar Toda a Base de Dados`; btn.disabled = false; lucide.createIcons(); }
  });
}
