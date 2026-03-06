import { 
  auth, db, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc,
  onAuthStateChanged, signOut, query, where, orderBy 
} from "./firebase.js";

let userRole = "atleta";
let historicoCompleto = []; 
let mapAtletas = {};        

// =====================================================
// 🔔 SISTEMA DE NOTIFICAÇÕES (Toasts)
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
      iniciarPainelAdmin();
    } else {
      window.location.href = "index.html";
    }
  } else {
    window.location.href = "index.html";
  }
});

function iniciarPainelAdmin() {
  setupNavigation();
  setupSubTabs();
  configurarLogout();
  setupCadastrarPessoa();
  setupModalRegras();
  setupContabilizacao();
  setupPesquisaEquipes();
  setupRelatorioConsolidado();
  atualizarTelas();
  lucide.createIcons();
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
    });
  });
}

function setupSubTabs() {
  if (userRole !== "admin") {
    document.querySelectorAll(".admin-only-option").forEach(el => el.style.display = "none");
    const containerComite = document.getElementById("containerComite");
    if (containerComite) containerComite.style.display = "none";
  }

  document.querySelectorAll(".sub-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const parent = tab.closest('section');
      parent.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active"));
      parent.querySelectorAll(".sub-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.target).classList.add("active");
    });
  });
}

function configurarLogout() {
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if(confirm("Deseja realmente sair?")) {
      await signOut(auth);
      localStorage.clear();
      window.location.href = "index.html";
    }
  });
}

function atualizarTelas() {
  carregarEquipesEDashboard();
  carregarRegras();
  carregarHistorico();
}

// =====================================================
// 📊 DASHBOARD & EQUIPES
// =====================================================
function setupPesquisaEquipes() {
  document.getElementById("buscaEquipes").addEventListener("keyup", (e) => {
    const termo = e.target.value.toLowerCase();
    document.querySelectorAll("#sub-equipes tbody tr").forEach(tr => {
      const nome = tr.querySelector("strong")?.textContent.toLowerCase() || "";
      if (nome.includes(termo)) tr.style.display = "";
      else tr.style.display = "none";
    });
  });
}

async function carregarEquipesEDashboard() {
  const tbFila = document.getElementById("listaFila"), tbBike = document.getElementById("listaBicicleta"), tbCorrida = document.getElementById("listaCorrida"), tbComite = document.getElementById("listaComite");
  const q = query(collection(db, "atletas"), where("status", "==", "Aprovado"));
  const snap = await getDocs(q);
  
  let htmlFila = "", htmlBike = "", htmlCorrida = "", htmlComite = "";
  let contFila = 0, contBike = 0, contCorrida = 0, contComite = 0, ptsBike = 0, ptsCorrida = 0;
  let todosAtletas = [];
  mapAtletas = {}; 

  snap.forEach(d => {
    const u = d.data();
    mapAtletas[d.id] = u; 
    const isDono = auth.currentUser.uid === d.id;
    const pts = u.pontuacaoTotal || 0; 
    const btnExcluir = (!isDono && userRole === "admin") ? `<button class="btn-acao btn-excluir-membro" data-id="${d.id}" style="color: red; border: 0; padding: 2px;" title="Remover"><i data-lucide="x-circle"></i></button>` : '';
    const tagVoce = isDono ? `<span style="font-size: 0.75rem; color: #999; margin-left: 5px;">(Você)</span>` : "";

    if (u.equipe === "Fila de Espera") {
      const btnMoverBike = `<button class="btn-acao btn-mover" data-id="${d.id}" data-eq="Bicicleta" title="Adicionar à Bicicleta" style="padding: 4px 8px; font-size: 1.1rem; border-color: var(--primary);">🚴</button>`;
      const btnMoverCorrida = `<button class="btn-acao btn-mover" data-id="${d.id}" data-eq="Corrida" title="Adicionar à Corrida" style="padding: 4px 8px; font-size: 1.1rem; border-color: var(--secondary);">🏃</button>`;
      htmlFila += `<tr><td style="padding: 10px;"><strong>${u.nome}</strong></td><td style="text-align: right; padding: 10px; display: flex; justify-content: flex-end; gap: 8px;">${btnMoverBike} ${btnMoverCorrida} ${btnExcluir}</td></tr>`;
      contFila++;
    } else {
      const linha = `<tr>
        <td style="padding: 10px;"><strong>${u.nome}</strong> ${tagVoce}${u.role === 'atleta' ? `<br><small style="color: var(--primary); font-weight: 600;">🏆 ${pts} pts</small>` : ''}</td>
        <td style="text-align: right; padding: 10px; display: flex; justify-content: flex-end; gap: 8px;">${btnExcluir}</td>
      </tr>`;
      if (u.role === "admin" || u.role === "comite") { htmlComite += linha; contComite++; }
      else if (u.equipe === "Corrida") { htmlCorrida += linha; contCorrida++; ptsCorrida += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe}); }
      else if (u.equipe === "Bicicleta") { htmlBike += linha; contBike++; ptsBike += pts; todosAtletas.push({nome: u.nome, pts: pts, eq: u.equipe}); }
    }
  });

  if(tbFila) tbFila.innerHTML = htmlFila || "<tr><td colspan='2' style='text-align:center;'>Fila vazia.</td></tr>";
  if(tbComite) tbComite.innerHTML = htmlComite || "<tr><td colspan='2' style='text-align:center;'>Nenhum membro no comitê.</td></tr>";
  if(tbBike) tbBike.innerHTML = htmlBike || "<tr><td colspan='2' style='text-align:center;'>Nenhuma pessoa cadastrada.</td></tr>";
  if(tbCorrida) tbCorrida.innerHTML = htmlCorrida || "<tr><td colspan='2' style='text-align:center;'>Nenhuma pessoa cadastrada.</td></tr>";
  
  if(document.getElementById("totalFila")) document.getElementById("totalFila").textContent = contFila;
  if(document.getElementById("totalComite")) document.getElementById("totalComite").textContent = contComite;
  document.getElementById("totalBike").textContent = contBike;
  document.getElementById("totalCorrida").textContent = contCorrida;

  const totalPts = ptsBike + ptsCorrida;
  const pctBike = totalPts === 0 ? 50 : (ptsBike / totalPts) * 100;
  const pctCorrida = totalPts === 0 ? 50 : (ptsCorrida / totalPts) * 100;
  document.getElementById("ptsBikeTxt").textContent = ptsBike;
  document.getElementById("ptsCorridaTxt").textContent = ptsCorrida;
  document.getElementById("barBike").style.width = `${pctBike}%`;
  document.getElementById("barCorrida").style.width = `${pctCorrida}%`;

  todosAtletas.sort((a, b) => b.pts - a.pts);
  const podio = todosAtletas.slice(0, 5);
  const listaPodio = document.getElementById("listaPodio");
  listaPodio.innerHTML = "";
  if (podio.length === 0) { listaPodio.innerHTML = "<li style='text-align:center; color:#999; padding-top: 10px;'>Nenhum atleta pontuou ainda.</li>"; } 
  else {
    podio.forEach((atleta, index) => {
      let medalha = "🏅"; if(index===0) medalha = "🥇"; if(index===1) medalha = "🥈"; if(index===2) medalha = "🥉";
      let corEq = atleta.eq === "Bicicleta" ? "var(--primary)" : "var(--secondary)";
      listaPodio.innerHTML += `<li style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);"><span>${medalha} <strong style="margin-left:5px;">${atleta.nome}</strong> <small style="color:${corEq}; font-weight:600; margin-left:5px;">${atleta.eq}</small></span><strong style="color: var(--text-light);">${atleta.pts} pts</strong></li>`;
    });
  }
  lucide.createIcons();

  document.querySelectorAll(".btn-mover").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id; const eq = e.currentTarget.dataset.eq;
      if(confirm(`Mover pessoa para a equipe de ${eq}?`)) {
        await updateDoc(doc(db, "atletas", id), { equipe: eq });
        showToast(`Movido para ${eq}!`, "success");
        atualizarTelas();
      }
    });
  });

  document.querySelectorAll(".btn-excluir-membro").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if(confirm("Remover esta pessoa? O histórico será perdido.")) {
        await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id));
        showToast("Membro excluído.", "info");
        atualizarTelas();
      }
    });
  });
}

// =====================================================
// ✅ CADASTRAR PESSOA
// =====================================================
function setupCadastrarPessoa() {
  document.getElementById("btnCadastrarPessoa").addEventListener("click", async (e) => {
    const nome = document.getElementById("novoNome").value.trim();
    const email = document.getElementById("novoEmail").value.trim();
    const papel = document.getElementById("novoPapel").value;
    const btn = e.target;
    if (!nome) return showToast("Por favor, preencha o nome!", "error");

    let role = "atleta"; let equipe = papel;
    if (papel === "Comitê") { role = "comite"; equipe = "Nenhuma"; }

    try {
      btn.textContent = "Salvando..."; btn.disabled = true;
      await addDoc(collection(db, "atletas"), { nome: nome, email: email, role: role, equipe: equipe, status: "Aprovado", pontuacaoTotal: 0, criadoEm: new Date().toISOString() });
      showToast(`${nome} adicionado!`, "success");
      document.getElementById("novoNome").value = ""; document.getElementById("novoEmail").value = "";
      btn.textContent = "Adicionar ao Sistema"; btn.disabled = false;
      atualizarTelas();
      document.querySelector('[data-target="sub-equipes"]').click();
    } catch (error) {
      console.error(error); showToast("Erro ao cadastrar.", "error");
      btn.textContent = "Adicionar ao Sistema"; btn.disabled = false;
    }
  });
}

// =====================================================
// 💯 LANÇAR PONTUAÇÃO E FALTAS JUSTIFICADAS
// =====================================================
function setupContabilizacao() {
  document.getElementById("dataTreino").valueAsDate = new Date();

  document.getElementById("modTreino").addEventListener("change", async (e) => {
    const mod = e.target.value;
    const areaRegras = document.getElementById("areaSelecaoRegras"), listaRegras = document.getElementById("listaRegrasTreino"), btnGerar = document.getElementById("btnGerarLista");
    document.getElementById("areaTabelaPontuacao").style.display = "none"; 
    if (!mod) { areaRegras.style.display = "none"; btnGerar.style.display = "none"; return; }

    listaRegras.innerHTML = "<span style='font-size: 0.85rem; color: #999;'>Buscando regras...</span>";
    areaRegras.style.display = "block";

    const qRegras = query(collection(db, "regras_pontuacao"), where("modalidade", "in", ["Ambas", mod]));
    const snapRegras = await getDocs(qRegras);
    if (snapRegras.empty) {
      listaRegras.innerHTML = "<span style='font-size: 0.85rem; color: var(--danger);'>Nenhuma regra cadastrada.</span>";
      btnGerar.style.display = "none"; return;
    }

    listaRegras.innerHTML = "";
    snapRegras.forEach(d => {
      const r = d.data();
      const chip = document.createElement("label");
      chip.className = "regra-chip";
      chip.innerHTML = `<input type="checkbox" value="${d.id}" data-desc="${r.descricao}" data-pontos="${r.pontos}"> ${r.descricao} <strong style="color:var(--secondary);">+${r.pontos}</strong>`;
      chip.querySelector("input").addEventListener("change", (ev) => {
        if(ev.target.checked) chip.classList.add("selected"); else chip.classList.remove("selected");
      });
      listaRegras.appendChild(chip);
    });
    btnGerar.style.display = "inline-flex";
  });

  document.getElementById("btnGerarLista").addEventListener("click", async () => {
    const desc = document.getElementById("descTreino").value.trim(), data = document.getElementById("dataTreino").value, mod = document.getElementById("modTreino").value;
    const regrasSelecionadas = [];
    document.querySelectorAll("#listaRegrasTreino input:checked").forEach(chk => {
      regrasSelecionadas.push({ id: chk.value, descricao: chk.dataset.desc, pontos: parseInt(chk.dataset.pontos) });
    });

    if (!desc || !data || !mod) return showToast("Preencha descrição, data e equipe!", "error");
    if (regrasSelecionadas.length === 0) return showToast("Selecione pelo menos uma regra para pontuar!", "error");

    const btn = document.getElementById("btnGerarLista");
    btn.textContent = "Gerando..."; btn.disabled = true;
    await gerarTabelaContabilizacao(mod, regrasSelecionadas);
    btn.textContent = "Gerar Tabela de Lançamento"; btn.disabled = false;
    document.getElementById("areaTabelaPontuacao").style.display = "block";
  });

  document.getElementById("btnSalvarPontuacao").addEventListener("click", salvarPontuacoes);
}

async function gerarTabelaContabilizacao(modalidade, regras) {
  const tabela = document.getElementById("tabelaPontuacao");
  const qAtletas = query(collection(db, "atletas"), where("status", "==", "Aprovado"), where("equipe", "==", modalidade));
  const snapAtletas = await getDocs(qAtletas);
  let atletas = [];
  snapAtletas.forEach(d => atletas.push({id: d.id, ...d.data()}));

  if (atletas.length === 0) {
    tabela.innerHTML = `<tr><td style='text-align:center; padding: 20px;'>Ainda não existem atletas na equipe de ${modalidade}.</td></tr>`; return;
  }

  // CABEÇALHO: Inclui a coluna Falta Justificada nativa
  let thead = `<thead><tr><th style="min-width: 200px; max-width: 300px;">Nome do Atleta</th>`;
  thead += `<th style="text-align: center; width: 90px; color: var(--accent); border-right: 2px solid var(--border);" title="Selecione se o atleta faltou, mas justificou.">Falta<br>Justificada</th>`;
  regras.forEach(r => {
    thead += `<th style="text-align: center; min-width: 100px;" title="${r.descricao}"><div style="font-size: 0.8rem; line-height: 1.2; margin-bottom: 5px; font-weight: 500;">${r.descricao}</div><strong style="color: var(--secondary); font-size: 1rem;">+${r.pontos} pts</strong></th>`;
  });
  thead += "</tr></thead>";

  let tbody = "<tbody>";
  atletas.forEach(a => {
    const ptsAtuais = a.pontuacaoTotal || 0;
    tbody += `<tr><td><strong>${a.nome}</strong> <br><small style="color: #999;">Atual: ${ptsAtuais} pts</small></td>`;
    // Coluna Falta Justificada
    tbody += `<td style="text-align: center; vertical-align: middle; border-right: 2px solid var(--border); background: rgba(243, 112, 33, 0.05);">
                <input type="checkbox" class="check-falta" data-atleta-id="${a.id}">
              </td>`;
    // Regras
    regras.forEach(r => {
      tbody += `<td style="text-align: center; vertical-align: middle;">
                  <input type="checkbox" class="check-ponto" data-atleta-id="${a.id}" data-regra-id="${r.id}" data-regra-desc="${r.descricao}" data-pontos="${r.pontos}">
                </td>`;
    });
    tbody += `</tr>`;
  });
  tbody += "</tbody>";

  tabela.innerHTML = thead + tbody;

  // Lógica: Se marcar Falta Justificada, desmarca e bloqueia os pontos
  document.querySelectorAll(".check-falta").forEach(chk => {
    chk.addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      const pontosChks = tr.querySelectorAll(".check-ponto");
      pontosChks.forEach(p => {
        p.disabled = e.target.checked;
        if(e.target.checked) p.checked = false;
      });
    });
  });
}

async function salvarPontuacoes() {
  const desc = document.getElementById("descTreino").value.trim(), data = document.getElementById("dataTreino").value;
  const checksPontos = document.querySelectorAll(".check-ponto:checked");
  const checksFaltas = document.querySelectorAll(".check-falta:checked");

  if (checksPontos.length === 0 && checksFaltas.length === 0) return showToast("Nenhum lançamento selecionado!", "error");
  if (!confirm(`Salvar ${checksPontos.length} pontuações e ${checksFaltas.length} faltas justificadas?`)) return;

  const btn = document.getElementById("btnSalvarPontuacao");
  btn.innerHTML = "Registrando..."; btn.disabled = true;

  try {
    let pontosPorAtleta = {};

    // 1. Grava as Faltas Justificadas (0 Pontos)
    for (let f of checksFaltas) {
      const aId = f.dataset.atletaId;
      await addDoc(collection(db, "historico_pontos"), {
        atletaId: aId, regraId: "falta_just", regraDesc: "Falta Justificada", pontos: 0, descTreino: desc, dataTreino: data, criadoEm: new Date().toISOString()
      });
    }

    // 2. Grava as Pontuações normais
    for (let check of checksPontos) {
      const aId = check.dataset.atletaId;
      const pts = parseInt(check.dataset.pontos);
      await addDoc(collection(db, "historico_pontos"), {
        atletaId: aId, regraId: check.dataset.regraId, regraDesc: check.dataset.regraDesc, pontos: pts, descTreino: desc, dataTreino: data, criadoEm: new Date().toISOString()
      });
      if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0;
      pontosPorAtleta[aId] += pts;
    }

    // 3. Atualiza Ficha dos Atletas
    for (let aId in pontosPorAtleta) {
      const atletaRef = doc(db, "atletas", aId);
      const atletaSnap = await getDoc(atletaRef);
      if (atletaSnap.exists()) {
        const totalAtual = atletaSnap.data().pontuacaoTotal || 0;
        await updateDoc(atletaRef, { pontuacaoTotal: totalAtual + pontosPorAtleta[aId] });
      }
    }

    showToast("Lançamentos efetuados com sucesso!", "success");
    document.getElementById("areaTabelaPontuacao").style.display = "none";
    document.getElementById("areaSelecaoRegras").style.display = "none";
    document.getElementById("btnGerarLista").style.display = "none";
    document.getElementById("descTreino").value = ""; document.getElementById("modTreino").value = "";
    
    atualizarTelas(); 
  } catch (error) { console.error(error); showToast("Erro ao salvar.", "error"); } 
  finally { btn.innerHTML = `<i data-lucide="check-circle"></i> Salvar Lançamentos e Faltas`; btn.disabled = false; lucide.createIcons(); }
}

// =====================================================
// 📜 EXTRATO DE LANÇAMENTOS (HISTÓRICO)
// =====================================================
async function carregarHistorico() {
  const q = query(collection(db, "historico_pontos"), orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);
  historicoCompleto = [];
  snap.forEach(d => { historicoCompleto.push({ id: d.id, ...d.data() }); });
  renderHistorico(historicoCompleto);
}

function renderHistorico(dados) {
  const tbody = document.getElementById("listaHistorico");
  tbody.innerHTML = "";
  if (dados.length === 0) { tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Nenhum registro encontrado.</td></tr>"; return; }

  dados.forEach(h => {
    const atleta = mapAtletas[h.atletaId];
    const nomeAtleta = atleta ? atleta.nome : "Atleta Excluído";
    const equipeAtleta = atleta ? atleta.equipe : "-";
    const d = new Date(h.dataTreino + "T00:00:00");
    const dataFormatada = d.toLocaleDateString('pt-BR');
    
    let pontosVisual = h.pontos === 0 ? `<span style="color:var(--accent);">Justificada</span>` : `+${h.pontos}`;
    const btnEstorno = (userRole === "admin") ? `<button class="btn-acao btn-estornar" data-id="${h.id}" data-atleta="${h.atletaId}" data-pontos="${h.pontos}" style="color: var(--danger); border-color: var(--danger);" title="Desfazer"><i data-lucide="undo-2"></i> Estornar</button>` : '';

    tbody.innerHTML += `<tr><td>${dataFormatada}</td><td><strong>${nomeAtleta}</strong></td><td>${equipeAtleta}</td><td>${h.descTreino}<br><small style="color: var(--primary);">${h.regraDesc}</small></td><td style="text-align: center; color: var(--secondary); font-weight: bold;">${pontosVisual}</td><td style="text-align: right;">${btnEstorno}</td></tr>`;
  });
  lucide.createIcons();

  document.querySelectorAll(".btn-estornar").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const histId = e.currentTarget.dataset.id, atlId = e.currentTarget.dataset.atleta, ptsARemover = parseInt(e.currentTarget.dataset.pontos);
      if(!confirm(`Atenção: Deseja realmente ESTORNAR este lançamento?`)) return;

      try {
        if (mapAtletas[atlId] && ptsARemover > 0) {
          const atletaRef = doc(db, "atletas", atlId);
          const atletaSnap = await getDoc(atletaRef);
          if (atletaSnap.exists()) {
            const novoTotal = Math.max(0, (atletaSnap.data().pontuacaoTotal || 0) - ptsARemover); 
            await updateDoc(atletaRef, { pontuacaoTotal: novoTotal });
          }
        }
        await deleteDoc(doc(db, "historico_pontos", histId));
        showToast("Estorno realizado com sucesso!", "success");
        atualizarTelas(); 
      } catch (err) { console.error(err); showToast("Erro no estorno.", "error"); }
    });
  });
}

["filtroMesHistorico", "filtroEquipeHistorico", "filtroNomeHistorico"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    const mes = document.getElementById("filtroMesHistorico").value;
    const eq = document.getElementById("filtroEquipeHistorico").value;
    const nome = document.getElementById("filtroNomeHistorico").value.toLowerCase();

    const dadosFiltrados = historicoCompleto.filter(h => {
      const atleta = mapAtletas[h.atletaId] || { nome: "", equipe: "" };
      return (!mes || h.dataTreino.startsWith(mes)) && (!eq || atleta.equipe === eq) && (!nome || atleta.nome.toLowerCase().includes(nome));
    });
    renderHistorico(dadosFiltrados);
  });
});

// =====================================================
// 📈 RELATÓRIO CONSOLIDADO E EXCEL
// =====================================================
function setupRelatorioConsolidado() {
  document.getElementById("filtroAnoRelatorio").value = new Date().getFullYear();
  
  document.getElementById("btnGerarRelatorio").addEventListener("click", () => {
    const ano = document.getElementById("filtroAnoRelatorio").value;
    const eqFiltro = document.getElementById("filtroEquipeRelatorio").value;
    const tbody = document.getElementById("listaRelatorio");
    
    // Filtra histórico pelo ano
    const histAno = historicoCompleto.filter(h => h.dataTreino.startsWith(ano));
    
    // Filtra os atletas que devem aparecer no relatório
    let atletasRelatorio = Object.values(mapAtletas).filter(a => a.role === "atleta" && a.equipe !== "Fila de Espera" && a.equipe !== "Nenhuma");
    if (eqFiltro) atletasRelatorio = atletasRelatorio.filter(a => a.equipe === eqFiltro);

    if(atletasRelatorio.length === 0) {
      tbody.innerHTML = "<tr><td colspan='15' style='text-align:center;'>Nenhum atleta encontrado.</td></tr>"; return;
    }

    let html = "";
    atletasRelatorio.forEach(atleta => {
      // Array de 12 posições para os meses (Janeiro = index 0)
      let ptsMes = [0,0,0,0,0,0,0,0,0,0,0,0];
      let totalGeral = 0;

      // Soma os pontos do atleta em cada mês
      histAno.filter(h => h.atletaId === atleta.id).forEach(lancamento => {
        const mesInt = parseInt(lancamento.dataTreino.split("-")[1], 10); // "2024-03-15" -> 3
        if(!isNaN(mesInt) && mesInt >= 1 && mesInt <= 12) {
          ptsMes[mesInt - 1] += lancamento.pontos;
          totalGeral += lancamento.pontos;
        }
      });

      let colunasMeses = "";
      ptsMes.forEach(p => {
        colunasMeses += `<td style="text-align: center; color: ${p > 0 ? 'var(--secondary)' : '#ccc'}; font-weight: ${p > 0 ? '600' : '400'};">${p}</td>`;
      });

      html += `<tr>
        <td><strong>${atleta.nome}</strong></td>
        <td><small style="color: ${atleta.equipe === 'Bicicleta' ? 'var(--primary)' : 'var(--secondary)'}">${atleta.equipe}</small></td>
        ${colunasMeses}
        <td style="text-align: center; background: #e0f2f1; font-weight: bold; color: var(--primary);">${totalGeral}</td>
      </tr>`;
    });

    tbody.innerHTML = html;
  });

  // BOTÃO EXPORTAR PARA EXCEL
  document.getElementById("btnExportarExcel").addEventListener("click", () => {
    const tabela = document.getElementById("tabelaConsolidada");
    const rows = tabela.querySelectorAll("tr");
    if(rows.length <= 2 && rows[1]?.innerText.includes("Clique")) return showToast("Gere o relatório primeiro!", "error");

    let csv = "\uFEFF"; // Garante compatibilidade de acentos no Excel
    rows.forEach(row => {
      const cols = row.querySelectorAll("th, td");
      const rowData = Array.from(cols).map(c => `"${c.innerText.replace(/"/g, '""')}"`);
      csv += rowData.join(";") + "\r\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relatorio_Atletas_${document.getElementById("filtroAnoRelatorio").value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Download iniciado!", "success");
  });
}

// =====================================================
// 📝 REGRAS DE PONTUAÇÃO
// =====================================================
async function carregarRegras() {
  const tbody = document.getElementById("listaRegras");
  const snap = await getDocs(collection(db, "regras_pontuacao"));
  tbody.innerHTML = "";
  if (snap.empty) { tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Nenhuma regra configurada.</td></tr>"; return; }

  snap.forEach(d => {
    const r = d.data();
    const btnExcluir = (userRole === "admin") ? `<button class="btn-acao btn-excluir-regra" data-id="${d.id}" style="color: var(--danger); border-color: var(--danger);">Excluir</button>` : '';
    tbody.innerHTML += `<tr><td><strong>${r.descricao}</strong></td><td>${r.modalidade}</td><td><strong style="color: var(--primary); font-size: 1.1rem;">+ ${r.pontos}</strong></td><td>${btnExcluir}</td></tr>`;
  });

  document.querySelectorAll(".btn-excluir-regra").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if(confirm("Deseja apagar esta regra?")) { await deleteDoc(doc(db, "regras_pontuacao", e.currentTarget.dataset.id)); carregarRegras(); }
    });
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

    await addDoc(collection(db, "regras_pontuacao"), { descricao: desc, modalidade: mod, pontos: parseInt(pts), criadoEm: new Date().toISOString() });
    modal.style.display = "none"; document.getElementById("regraDescricao").value = ""; document.getElementById("regraPontos").value = "";
    showToast("Regra criada!", "success");
    carregarRegras();
  });
}
