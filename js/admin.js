import { 
  auth, db, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc,
  onAuthStateChanged, signOut, query, where, orderBy 
} from "./firebase.js";

let userRole = "atleta";

// =====================================================
// 🔒 INICIALIZAÇÃO E SEGURANÇA
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
    const cardComite = document.getElementById("cardComite");
    if (containerComite) containerComite.style.display = "none";
    if (cardComite) cardComite.style.display = "none";
  }

  document.querySelectorAll(".sub-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".sub-content").forEach(c => c.classList.remove("active"));
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
  carregarEquipes();
  carregarRegras();
}

// =====================================================
// 💯 MÓDULO DE CONTABILIZAÇÃO (Filtros e Tabela Inteligente)
// =====================================================
function setupContabilizacao() {
  document.getElementById("dataTreino").valueAsDate = new Date();

  // MÁGICA 1: Carrega as Regras dinamicamente ao escolher a Modalidade
  document.getElementById("modTreino").addEventListener("change", async (e) => {
    const mod = e.target.value;
    const areaRegras = document.getElementById("areaSelecaoRegras");
    const listaRegras = document.getElementById("listaRegrasTreino");
    const btnGerar = document.getElementById("btnGerarLista");
    
    document.getElementById("areaTabelaPontuacao").style.display = "none"; // Esconde tabela anterior

    if (!mod) {
      areaRegras.style.display = "none";
      btnGerar.style.display = "none";
      return;
    }

    listaRegras.innerHTML = "<span style='font-size: 0.85rem; color: #999;'>Buscando regras...</span>";
    areaRegras.style.display = "block";

    const qRegras = query(collection(db, "regras_pontuacao"), where("modalidade", "in", ["Ambas", mod]));
    const snapRegras = await getDocs(qRegras);
    
    if (snapRegras.empty) {
      listaRegras.innerHTML = "<span style='font-size: 0.85rem; color: var(--danger);'>Nenhuma regra cadastrada para esta equipe.</span>";
      btnGerar.style.display = "none";
      return;
    }

    listaRegras.innerHTML = ""; // Limpa para injetar as Chips
    
    snapRegras.forEach(d => {
      const r = d.data();
      const chip = document.createElement("label");
      chip.className = "regra-chip";
      chip.innerHTML = `
        <input type="checkbox" value="${d.id}" data-desc="${r.descricao}" data-pontos="${r.pontos}">
        ${r.descricao} <strong style="color:var(--secondary);">+${r.pontos}</strong>
      `;
      
      // Efeito visual ao clicar no Chip
      chip.querySelector("input").addEventListener("change", (ev) => {
        if(ev.target.checked) chip.classList.add("selected");
        else chip.classList.remove("selected");
      });
      
      listaRegras.appendChild(chip);
    });

    btnGerar.style.display = "inline-flex";
  });

  // MÁGICA 2: Gera a tabela apenas com as regras (colunas) escolhidas
  document.getElementById("btnGerarLista").addEventListener("click", async () => {
    const desc = document.getElementById("descTreino").value.trim();
    const data = document.getElementById("dataTreino").value;
    const mod = document.getElementById("modTreino").value;
    
    // Pega os itens que foram selecionados nos Chips
    const regrasSelecionadas = [];
    document.querySelectorAll("#listaRegrasTreino input:checked").forEach(chk => {
      regrasSelecionadas.push({
        id: chk.value,
        descricao: chk.dataset.desc,
        pontos: parseInt(chk.dataset.pontos)
      });
    });

    if (!desc || !data || !mod) return alert("Preencha a descrição, data e modalidade do treino!");
    if (regrasSelecionadas.length === 0) return alert("Selecione pelo menos um item (regra) que irá pontuar neste evento!");

    const btn = document.getElementById("btnGerarLista");
    btn.textContent = "Gerando...";
    btn.disabled = true;

    await gerarTabelaContabilizacao(mod, regrasSelecionadas);

    btn.textContent = "Gerar Tabela de Lançamento";
    btn.disabled = false;
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
    tabela.innerHTML = `<tr><td style='text-align:center; padding: 20px;'>Ainda não existem atletas cadastrados na equipe de ${modalidade}.</td></tr>`;
    return;
  }

  // Cabeçalho adaptável baseado apenas nas regras selecionadas
  let thead = `<thead><tr>
                <th style="min-width: 200px; max-width: 300px;">Nome do Atleta</th>`;
  
  regras.forEach(r => {
    thead += `<th style="text-align: center; min-width: 100px;" title="${r.descricao}">
                <div style="font-size: 0.8rem; line-height: 1.2; margin-bottom: 5px; font-weight: 500;">${r.descricao}</div>
                <strong style="color: var(--secondary); font-size: 1rem;">+${r.pontos} pts</strong>
              </th>`;
  });
  thead += "</tr></thead>";

  // Corpo da Tabela
  let tbody = "<tbody>";
  atletas.forEach(a => {
    const ptsAtuais = a.pontuacaoTotal || 0;
    tbody += `<tr>
                <td><strong>${a.nome}</strong> <br><small style="color: #999;">Atual: ${ptsAtuais} pts</small></td>`;
    
    regras.forEach(r => {
      tbody += `<td style="text-align: center; vertical-align: middle;">
                  <input type="checkbox" class="check-ponto" data-atleta-id="${a.id}" data-regra-id="${r.id}" data-pontos="${r.pontos}">
                </td>`;
    });
    tbody += `</tr>`;
  });
  tbody += "</tbody>";

  tabela.innerHTML = thead + tbody;
}

async function salvarPontuacoes() {
  const desc = document.getElementById("descTreino").value.trim();
  const data = document.getElementById("dataTreino").value;
  const checks = document.querySelectorAll(".check-ponto:checked");

  if (checks.length === 0) return alert("Você não marcou nenhuma caixinha de pontuação!");
  if (!confirm(`Confirmar e salvar a pontuação de ${checks.length} marcações de atletas?`)) return;

  const btn = document.getElementById("btnSalvarPontuacao");
  btn.innerHTML = "Registrando na Base de Dados...";
  btn.disabled = true;

  try {
    let pontosPorAtleta = {};

    for (let check of checks) {
      const aId = check.dataset.atletaId;
      const pts = parseInt(check.dataset.pontos);
      
      await addDoc(collection(db, "historico_pontos"), {
        atletaId: aId, regraId: check.dataset.regraId, pontos: pts, descTreino: desc, dataTreino: data, criadoEm: new Date().toISOString()
      });

      if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0;
      pontosPorAtleta[aId] += pts;
    }

    for (let aId in pontosPorAtleta) {
      const atletaRef = doc(db, "atletas", aId);
      const atletaSnap = await getDoc(atletaRef);
      if (atletaSnap.exists()) {
        const totalAtual = atletaSnap.data().pontuacaoTotal || 0;
        await updateDoc(atletaRef, { pontuacaoTotal: totalAtual + pontosPorAtleta[aId] });
      }
    }

    alert("🏆 Pontuações distribuídas com sucesso!");
    
    document.getElementById("areaTabelaPontuacao").style.display = "none";
    document.getElementById("areaSelecaoRegras").style.display = "none";
    document.getElementById("btnGerarLista").style.display = "none";
    document.getElementById("descTreino").value = "";
    document.getElementById("modTreino").value = "";
    
    atualizarTelas(); // Atualiza painel Gestão para mostrar pontos novos
    
  } catch (error) {
    console.error(error);
    alert("Erro ao salvar pontuações. Verifique o console.");
  } finally {
    btn.innerHTML = `<i data-lucide="check-circle"></i> Salvar Pontuações nas Contas`;
    btn.disabled = false;
    lucide.createIcons();
  }
}

// =====================================================
// ✅ 1. CADASTRAR PESSOA E GESTÃO BASE
// =====================================================
function setupCadastrarPessoa() {
  document.getElementById("btnCadastrarPessoa").addEventListener("click", async (e) => {
    const nome = document.getElementById("novoNome").value.trim();
    const email = document.getElementById("novoEmail").value.trim();
    const papel = document.getElementById("novoPapel").value;
    const btn = e.target;

    if (!nome) return alert("Por favor, preencha pelo menos o nome da pessoa!");

    let role = "atleta"; let equipe = papel;
    if (papel === "Comitê") { role = "comite"; equipe = "Nenhuma"; }

    try {
      btn.textContent = "Salvando..."; btn.disabled = true;
      await addDoc(collection(db, "atletas"), {
        nome: nome, email: email, role: role, equipe: equipe, status: "Aprovado", pontuacaoTotal: 0, criadoEm: new Date().toISOString()
      });
      alert(`${nome} adicionado com sucesso!`);
      document.getElementById("novoNome").value = ""; document.getElementById("novoEmail").value = "";
      btn.textContent = "Adicionar ao Sistema"; btn.disabled = false;
      atualizarTelas();
      document.querySelector('[data-target="sub-equipes"]').click();
    } catch (error) {
      console.error(error); alert("Erro ao cadastrar.");
      btn.textContent = "Adicionar ao Sistema"; btn.disabled = false;
    }
  });
}

// =====================================================
// 👥 2. EQUIPES ATIVAS
// =====================================================
async function carregarEquipes() {
  const tbBike = document.getElementById("listaBicicleta");
  const tbCorrida = document.getElementById("listaCorrida");
  const tbComite = document.getElementById("listaComite");
  
  const q = query(collection(db, "atletas"), where("status", "==", "Aprovado"));
  const snap = await getDocs(q);
  
  let htmlBike = "", htmlCorrida = "", htmlComite = "";
  let contBike = 0, contCorrida = 0, contComite = 0;

  snap.forEach(d => {
    const u = d.data();
    const isDono = auth.currentUser.uid === d.id;
    const pts = u.pontuacaoTotal || 0; 
    
    const btnExcluir = (!isDono && userRole === "admin") ? `<button class="btn-acao btn-excluir-membro" data-id="${d.id}" style="color: red; border: 0; padding: 2px;" title="Remover"><i data-lucide="x-circle"></i></button>` : '';
    const tagVoce = isDono ? `<span style="font-size: 0.75rem; color: #999; margin-left: 5px;">(Você)</span>` : "";

    const linha = `
      <tr>
        <td style="padding: 10px;">
          <strong>${u.nome}</strong> ${tagVoce}
          ${u.role === 'atleta' ? `<br><small style="color: var(--primary); font-weight: 600;">🏆 ${pts} pts</small>` : ''}
        </td>
        <td style="text-align: right; padding: 10px;">${btnExcluir}</td>
      </tr>`;

    if (u.role === "admin" || u.role === "comite") { htmlComite += linha; contComite++; }
    else if (u.equipe === "Corrida") { htmlCorrida += linha; contCorrida++; }
    else if (u.equipe === "Bicicleta") { htmlBike += linha; contBike++; }
  });

  if(tbComite) tbComite.innerHTML = htmlComite || "<tr><td colspan='2' style='text-align:center;'>Nenhum membro no comitê.</td></tr>";
  if(tbBike) tbBike.innerHTML = htmlBike || "<tr><td colspan='2' style='text-align:center;'>Nenhuma pessoa cadastrada.</td></tr>";
  if(tbCorrida) tbCorrida.innerHTML = htmlCorrida || "<tr><td colspan='2' style='text-align:center;'>Nenhuma pessoa cadastrada.</td></tr>";
  
  if(document.getElementById("totalComite")) document.getElementById("totalComite").textContent = contComite;
  document.getElementById("totalBike").textContent = contBike;
  document.getElementById("totalCorrida").textContent = contCorrida;
  document.getElementById("totalAtletas").textContent = contBike + contCorrida;

  lucide.createIcons();

  document.querySelectorAll(".btn-excluir-membro").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if(confirm("Deseja remover esta pessoa do sistema? O histórico será perdido.")) {
        await deleteDoc(doc(db, "atletas", e.currentTarget.dataset.id));
        atualizarTelas();
      }
    });
  });
}

// =====================================================
// 📝 3. REGRAS DE PONTUAÇÃO
// =====================================================
async function carregarRegras() {
  const tbody = document.getElementById("listaRegras");
  const snap = await getDocs(collection(db, "regras_pontuacao"));
  tbody.innerHTML = "";
  
  if (snap.empty) {
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Nenhuma regra configurada.</td></tr>";
    return;
  }

  snap.forEach(d => {
    const r = d.data();
    const btnExcluir = (userRole === "admin") ? `<button class="btn-acao btn-excluir-regra" data-id="${d.id}" style="color: var(--danger); border-color: var(--danger);">Excluir</button>` : '';
    tbody.innerHTML += `
      <tr>
        <td><strong>${r.descricao}</strong></td><td>${r.modalidade}</td>
        <td><strong style="color: var(--primary); font-size: 1.1rem;">+ ${r.pontos}</strong></td>
        <td>${btnExcluir}</td>
      </tr>`;
  });

  document.querySelectorAll(".btn-excluir-regra").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if(confirm("Deseja apagar esta regra de pontuação?")) {
        await deleteDoc(doc(db, "regras_pontuacao", e.currentTarget.dataset.id));
        carregarRegras();
      }
    });
  });
}

function setupModalRegras() {
  const modal = document.getElementById("modalRegra");
  document.getElementById("abrirModalRegra").addEventListener("click", () => modal.style.display = "flex");
  document.getElementById("fecharModalRegra").addEventListener("click", () => modal.style.display = "none");
  
  document.getElementById("salvarRegraBtn").addEventListener("click", async () => {
    if (userRole !== "admin") return alert("Apenas administradores podem criar regras.");
    const desc = document.getElementById("regraDescricao").value.trim();
    const mod = document.getElementById("regraModalidade").value;
    const pts = document.getElementById("regraPontos").value.trim();

    if (!desc || !pts) return alert("Preencha a descrição e os pontos!");

    await addDoc(collection(db, "regras_pontuacao"), { descricao: desc, modalidade: mod, pontos: parseInt(pts), criadoEm: new Date().toISOString() });
    modal.style.display = "none";
    document.getElementById("regraDescricao").value = "";
    document.getElementById("regraPontos").value = "";
    carregarRegras();
  });
}
