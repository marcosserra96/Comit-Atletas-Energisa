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
    // Esconde opções e tabelas do comitê para quem não é Admin Geral
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
// ✅ 1. CADASTRAR PESSOA (Adição Direta)
// =====================================================
function setupCadastrarPessoa() {
  document.getElementById("btnCadastrarPessoa").addEventListener("click", async (e) => {
    const nome = document.getElementById("novoNome").value.trim();
    const email = document.getElementById("novoEmail").value.trim();
    const papel = document.getElementById("novoPapel").value;
    const btn = e.target;

    if (!nome) return alert("Por favor, preencha pelo menos o nome da pessoa!");

    let role = "atleta";
    let equipe = papel;

    if (papel === "Comitê") {
      role = "comite";
      equipe = "Nenhuma";
    }

    try {
      btn.textContent = "Salvando...";
      btn.disabled = true;

      await addDoc(collection(db, "atletas"), {
        nome: nome,
        email: email,
        role: role,
        equipe: equipe,
        status: "Aprovado", // Já entra direto e ativo
        criadoEm: new Date().toISOString()
      });

      alert(`${nome} adicionado com sucesso!`);
      
      // Limpa os campos
      document.getElementById("novoNome").value = "";
      document.getElementById("novoEmail").value = "";
      btn.textContent = "Adicionar ao Sistema";
      btn.disabled = false;
      
      atualizarTelas();
      
      // Muda a aba automaticamente para mostrar as equipes atualizadas
      document.querySelector('[data-target="sub-equipes"]').click();

    } catch (error) {
      console.error(error);
      alert("Erro ao cadastrar. Tente novamente.");
      btn.textContent = "Adicionar ao Sistema";
      btn.disabled = false;
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
    const btnExcluir = (!isDono && userRole === "admin") ? `<button class="btn-acao btn-excluir-membro" data-id="${d.id}" style="color: red; border: 0; padding: 2px;" title="Remover"><i data-lucide="x-circle"></i></button>` : '';
    const tagVoce = isDono ? `<span style="font-size: 0.75rem; color: #999; margin-left: 5px;">(Você)</span>` : "";

    const linha = `
      <tr>
        <td style="padding: 10px;"><strong>${u.nome}</strong> ${tagVoce}</td>
        <td style="text-align: right; padding: 10px;">${btnExcluir}</td>
      </tr>`;

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

  if(tbComite) tbComite.innerHTML = htmlComite || "<tr><td colspan='2' style='text-align:center;'>Nenhum membro no comitê.</td></tr>";
  if(tbBike) tbBike.innerHTML = htmlBike || "<tr><td colspan='2' style='text-align:center;'>Nenhuma pessoa cadastrada.</td></tr>";
  if(tbCorrida) tbCorrida.innerHTML = htmlCorrida || "<tr><td colspan='2' style='text-align:center;'>Nenhuma pessoa cadastrada.</td></tr>";
  
  if(document.getElementById("totalComite")) document.getElementById("totalComite").textContent = contComite;
  document.getElementById("totalBike").textContent = contBike;
  document.getElementById("totalCorrida").textContent = contCorrida;
  document.getElementById("totalAtletas").textContent = contBike + contCorrida; // Exclui comitê do total de atletas

  lucide.createIcons();

  document.querySelectorAll(".btn-excluir-membro").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if(confirm("Deseja realmente remover esta pessoa do sistema?")) {
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
