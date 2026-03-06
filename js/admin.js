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
      alert("Acesso Negado! Área restrita ao Comitê.");
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
  setupModalRegras();
  atualizarTelas();
  lucide.createIcons();
}

// =====================================================
// 🧭 NAVEGAÇÃO PRINCIPAL E SECUNDÁRIA
// =====================================================
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
  const tabAprovacoes = document.querySelector(".admin-only-tab");
  if (userRole !== "admin" && tabAprovacoes) {
    tabAprovacoes.style.display = "none";
    document.querySelector('[data-target="sub-equipes"]').click();
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
  if (userRole === "admin") carregarAprovacoes();
  carregarEquipes();
  carregarRegras();
}

// =====================================================
// ✅ 1. APROVAÇÕES (Definição de Modalidade)
// =====================================================
async function carregarAprovacoes() {
  const tbody = document.getElementById("listaAprovacoes");
  if (!tbody) return;

  tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Buscando...</td></tr>";
  const q = query(collection(db, "atletas"), where("status", "==", "Pendente"), orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);
  tbody.innerHTML = "";
  
  if (snap.empty) {
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding: 20px;'>Nenhuma solicitação pendente. 🎉</td></tr>";
    return;
  }

  snap.forEach(d => {
    const u = d.data();
    tbody.innerHTML += `
      <tr>
        <td><strong>${u.nome}</strong></td>
        <td>${u.email}</td>
        <td>
          <select class="select-modalidade" id="mod-${d.id}" style="margin: 0; padding: 6px; width: 100%;">
            <option value="">Selecione a Equipe...</option>
            <option value="Bicicleta">Bicicleta</option>
            <option value="Corrida">Corrida</option>
          </select>
        </td>
        <td style="display: flex; gap: 8px;">
          <button class="btn-acao btn-aprovar-atleta" data-id="${d.id}" style="color: var(--secondary); border-color: var(--secondary);" title="Aprovar Atleta">
            Aprovar
          </button>
          <button class="btn-acao btn-reprovar" data-id="${d.id}" style="color: var(--danger); border-color: var(--danger);" title="Excluir">
            <i data-lucide="trash"></i>
          </button>
        </td>
      </tr>`;
  });
  
  lucide.createIcons();

  document.querySelectorAll(".btn-aprovar-atleta").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      const selectEquipe = document.getElementById(`mod-${id}`);
      
      if (selectEquipe.value === "") {
        alert("Selecione se o atleta será da equipe de Bicicleta ou Corrida.");
        selectEquipe.focus();
        return;
      }

      if(confirm(`Deseja aprovar este atleta para a equipe de ${selectEquipe.value}?`)) {
        await updateDoc(doc(db, "atletas", id), { 
          status: "Aprovado", 
          role: "atleta",
          equipe: selectEquipe.value 
        });
        atualizarTelas();
      }
    });
  });

  document.querySelectorAll(".btn-reprovar").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      if(confirm("Excluir esta solicitação?")) {
        await deleteDoc(doc(db, "atletas", id));
        atualizarTelas();
      }
    });
  });
}

// =====================================================
// 👥 2. EQUIPES ATIVAS E COMITÊ (Nova Separação)
// =====================================================
async function carregarEquipes() {
  const tbBike = document.getElementById("listaBicicleta");
  const tbCorrida = document.getElementById("listaCorrida");
  const tbComite = document.getElementById("listaComite");
  
  const q = query(collection(db, "atletas"), where("status", "==", "Aprovado"));
  const snap = await getDocs(q);
  
  let htmlBike = "";
  let htmlCorrida = "";
  let htmlComite = "";
  let contBike = 0, contCorrida = 0, contComite = 0;

  snap.forEach(d => {
    const u = d.data();
    const isDono = auth.currentUser.uid === d.id;
    const btnExcluir = (!isDono && userRole === "admin") ? `<button class="btn-acao btn-excluir-membro" data-id="${d.id}" style="color: red; border: 0; padding: 2px;" title="Remover"><i data-lucide="x-circle"></i></button>` : '';
    
    // Tag visual para identificar você mesmo
    const tagVoce = isDono ? `<span style="font-size: 0.75rem; color: #999; margin-left: 5px;">(Você)</span>` : "";

    const linha = `
      <tr>
        <td style="padding: 10px;">
          <strong>${u.nome}</strong> ${tagVoce}
        </td>
        <td style="text-align: right; padding: 10px;">${btnExcluir}</td>
      </tr>`;

    // A MÁGICA DA SEPARAÇÃO ACONTECE AQUI
    if (u.role === "admin" || u.role === "comite") {
      htmlComite += linha;
      contComite++;
    } else if (u.equipe === "Corrida") {
      htmlCorrida += linha;
      contCorrida++;
    } else if (u.equipe === "Bicicleta") {
      htmlBike += linha;
      contBike++;
    }
  });

  tbComite.innerHTML = htmlComite || "<tr><td colspan='2' style='text-align:center;'>Nenhum membro no comitê.</td></tr>";
  tbBike.innerHTML = htmlBike || "<tr><td colspan='2' style='text-align:center;'>Nenhum membro na bicicleta.</td></tr>";
  tbCorrida.innerHTML = htmlCorrida || "<tr><td colspan='2' style='text-align:center;'>Nenhum membro na corrida.</td></tr>";
  
  // Atualiza as métricas da Visão Geral
  document.getElementById("totalComite").textContent = contComite;
  document.getElementById("totalBike").textContent = contBike;
  document.getElementById("totalCorrida").textContent = contCorrida;
  document.getElementById("totalAtletas").textContent = contBike + contCorrida + contComite;

  lucide.createIcons();

  document.querySelectorAll(".btn-excluir-membro").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      if(confirm("Remover este membro da equipe definitivamente?")) {
        await deleteDoc(doc(db, "atletas", id));
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
        <td><strong>${r.descricao}</strong></td>
        <td>${r.modalidade}</td>
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

    await addDoc(collection(db, "regras_pontuacao"), {
      descricao: desc,
      modalidade: mod,
      pontos: parseInt(pts),
      criadoEm: new Date().toISOString()
    });

    modal.style.display = "none";
    document.getElementById("regraDescricao").value = "";
    document.getElementById("regraPontos").value = "";
    carregarRegras();
  });
}
