import { 
  auth, db, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, 
  onAuthStateChanged, signOut, query, where, orderBy 
} from "./firebase.js";

// =====================================================
// 🔒 VERIFICAÇÃO DE SEGURANÇA E INICIALIZAÇÃO
// =====================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Verifica se o usuário logado é realmente um Administrador
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    
    if (docSnap.exists() && docSnap.data().role === "admin") {
      // Tudo certo! Inicia a interface do Admin
      iniciarPainelAdmin();
    } else {
      // É um intruso (atleta tentando acessar painel de admin)
      alert("Acesso Negado! Área restrita ao Comitê.");
      window.location.href = "index.html";
    }
  } else {
    // Não está logado
    window.location.href = "index.html";
  }
});

function iniciarPainelAdmin() {
  setupNavigation();
  configurarLogout();
  carregarDashboard();
  carregarAprovacoes();
  carregarMembrosAtivos();
  lucide.createIcons();
}

// =====================================================
// 🧭 NAVEGAÇÃO DO MENU
// =====================================================
function setupNavigation() {
  document.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", () => {
      // Remove classe ativa de todos os botões do menu
      document.querySelectorAll(".menu-item").forEach(btn => btn.classList.remove("active"));
      item.classList.add("active");
      
      // Esconde todas as seções
      const target = item.dataset.section;
      document.querySelectorAll("main section").forEach(sec => {
        sec.classList.remove("active-section");
        if (sec.id === target) sec.classList.add("active-section");
      });
      
      lucide.createIcons();
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

// =====================================================
// 📊 DASHBOARD (Resumo Numérico)
// =====================================================
async function carregarDashboard() {
  try {
    // Conta total de Atletas Aprovados (Admin e Atletas comuns)
    const qAtivos = query(collection(db, "atletas"), where("status", "==", "Aprovado"));
    const snapAtivos = await getDocs(qAtivos);
    document.getElementById("totalAtletas").textContent = snapAtivos.size;

    // Conta total de Solicitações Pendentes
    const qPendentes = query(collection(db, "atletas"), where("status", "==", "Pendente"));
    const snapPendentes = await getDocs(qPendentes);
    document.getElementById("totalPendentes").textContent = snapPendentes.size;

  } catch (error) {
    console.error("Erro ao carregar Dashboard:", error);
  }
}

// =====================================================
// ✅ APROVAÇÕES DE ACESSO (O Coração da Gestão)
// =====================================================
async function carregarAprovacoes() {
  const tbody = document.getElementById("listaAprovacoes");
  if (!tbody) return;

  const carregar = async () => {
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Buscando...</td></tr>";
    
    const q = query(collection(db, "atletas"), where("status", "==", "Pendente"), orderBy("criadoEm", "desc"));
    const snap = await getDocs(q);
    
    tbody.innerHTML = "";
    
    if (snap.empty) {
      tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 20px;'>Nenhuma solicitação pendente no momento. 🎉</td></tr>";
      return;
    }

    snap.forEach(d => {
      const u = d.data();
      const dataF = u.criadoEm ? new Date(u.criadoEm).toLocaleDateString('pt-BR') : 'N/A';
      
      tbody.innerHTML += `
        <tr>
          <td><strong>${u.nome}</strong></td>
          <td>${u.email}</td>
          <td><span style="background: rgba(0,155,193,0.1); color: var(--primary); padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; text-transform: uppercase;">${u.grupo || 'Sem grupo'}</span></td>
          <td>${dataF}</td>
          <td style="display: flex; gap: 8px;">
            <button class="btn-acao btn-aprovar-atleta" data-id="${d.id}" style="color: var(--secondary); border-color: var(--secondary);" title="Aprovar como Atleta">
              Aprovar Atleta
            </button>
            <button class="btn-acao btn-aprovar-admin" data-id="${d.id}" style="color: #6a0dad; border-color: #6a0dad;" title="Dar Acesso Total de Comitê">
              Admin
            </button>
            <button class="btn-acao btn-reprovar" data-id="${d.id}" style="color: var(--danger); border-color: var(--danger);" title="Rejeitar Solicitação">
              <i data-lucide="x"></i>
            </button>
          </td>
        </tr>`;
    });
    
    lucide.createIcons();

    // Evento: Aprovar como Atleta Normal
    document.querySelectorAll(".btn-aprovar-atleta").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        if(confirm("Deseja aprovar este cadastro como Atleta?")) {
          await updateDoc(doc(db, "atletas", id), { status: "Aprovado", role: "atleta" });
          atualizarTelas();
        }
      });
    });

    // Evento: Aprovar e Dar Poder de Admin
    document.querySelectorAll(".btn-aprovar-admin").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        if(confirm("ATENÇÃO: Deseja dar acesso total de Administrador do Comitê a esta pessoa?")) {
          await updateDoc(doc(db, "atletas", id), { status: "Aprovado", role: "admin" });
          atualizarTelas();
        }
      });
    });

    // Evento: Rejeitar/Excluir cadastro
    document.querySelectorAll(".btn-reprovar").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        if(confirm("Deseja reprovar e excluir permanentemente esta solicitação?")) {
          await deleteDoc(doc(db, "atletas", id));
          atualizarTelas();
        }
      });
    });
  };

  carregar();
}

// =====================================================
// 👥 MEMBROS ATIVOS (Listagem da Equipe)
// =====================================================
async function carregarMembrosAtivos() {
  const tbody = document.getElementById("listaMembrosAtivos");
  if (!tbody) return;

  const carregar = async () => {
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Buscando...</td></tr>";
    
    const q = query(collection(db, "atletas"), where("status", "==", "Aprovado"));
    const snap = await getDocs(q);
    
    tbody.innerHTML = "";
    
    if (snap.empty) {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Nenhum membro ativo.</td></tr>";
      return;
    }

    snap.forEach(d => {
      const u = d.data();
      const isDono = auth.currentUser.uid === d.id; // Verifica se é o próprio usuário logado
      
      let badgeRole = u.role === "admin" 
        ? `<span style="background: #e63946; color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem;">Admin</span>`
        : `<span style="background: var(--secondary); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem;">Atleta</span>`;

      tbody.innerHTML += `
        <tr>
          <td><strong>${u.nome}</strong> ${isDono ? '(Você)' : ''}</td>
          <td>${u.email}</td>
          <td>${badgeRole}</td>
          <td>
            ${!isDono ? `<button class="btn-acao btn-excluir-membro" data-id="${d.id}" style="color: var(--danger); border: 0;" title="Remover da equipe"><i data-lucide="trash-2"></i></button>` : `<span style="font-size: 0.8rem; color: #999;">Protegido</span>`}
          </td>
        </tr>`;
    });
    
    lucide.createIcons();

    // Evento: Excluir Membro Aprovado
    document.querySelectorAll(".btn-excluir-membro").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.dataset.id;
        if(confirm("Tem certeza que deseja remover este membro da equipe definitivamente?")) {
          await deleteDoc(doc(db, "atletas", id));
          atualizarTelas();
        }
      });
    });
  };

  carregar();
}

// Função auxiliar para recarregar tudo após uma alteração
function atualizarTelas() {
  carregarAprovacoes();
  carregarMembrosAtivos();
  carregarDashboard();
}
