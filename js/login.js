import { 
  auth, db, doc, setDoc, getDoc, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "./firebase.js"; // Certifique-se de ter o firebase.js na mesma pasta

// Função auxiliar para os avisos visuais
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// --- LÓGICA DE LOGIN COM ROTEAMENTO INTELIGENTE ---
document.getElementById("loginBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value.trim();
  const btn = e.target;

  if (!email || !pass) return showToast("Preencha e-mail e senha", "error");

  btn.textContent = "Verificando...";
  btn.classList.add("loading");
  
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    // Busca o perfil do usuário no banco de dados
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    
    if (docSnap.exists()) {
      const data = docSnap.data();

      // 1. Barreira de Aprovação
      if (data.status === "Pendente") {
        showToast("Seu acesso ainda está em análise pelo comitê.", "error");
        await signOut(auth); // Desloga imediatamente
        btn.textContent = "Entrar";
        btn.classList.remove("loading");
        return;
      }

      // Salva dados básicos no navegador para uso rápido
      localStorage.setItem("userName", data.nome);
      localStorage.setItem("userRole", data.role);

      showToast("Acesso liberado! Redirecionando...", "success");

      // 2. Roteamento (Admin vs Atleta)
      setTimeout(() => {
        if (data.role === "admin") {
          window.location.href = "admin.html";
        } else {
          window.location.href = "portal.html"; // O portal antigo (ou novo portal do atleta)
        }
      }, 1500);

    } else {
      showToast("Perfil não encontrado no sistema.", "error");
      await signOut(auth);
      btn.textContent = "Entrar";
      btn.classList.remove("loading");
    }

  } catch (error) {
    showToast("E-mail ou senha incorretos.", "error");
    btn.textContent = "Entrar";
    btn.classList.remove("loading");
  }
});

// --- LÓGICA DE SOLICITAÇÃO DE ACESSO (CADASTRO) ---
document.getElementById("registerBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nameRegister").value.trim();
  const email = document.getElementById("emailRegister").value.trim();
  const pass = document.getElementById("passwordRegister").value.trim();
  const grupo = document.getElementById("teamRegister").value;
  const btn = e.target;

  if (!nome || !email || !pass || !grupo) {
    return showToast("Preencha todos os campos e escolha uma modalidade!", "error");
  }

  btn.textContent = "Enviando...";
  btn.disabled = true;

  try {
    // Cria a conta no Firebase Auth
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    
    // Salva no Banco de Dados com status PENDENTE e role ATLETA
    await setDoc(doc(db, "atletas", cred.user.uid), {
      nome: nome,
      email: email,
      grupo: grupo,
      status: "Pendente", // <-- A mágica acontece aqui
      role: "atleta",     // Ninguém nasce admin
      criadoEm: new Date().toISOString()
    });

    // Desloga o usuário recém-criado, pois ele precisa de aprovação
    await signOut(auth);

    showToast("Solicitação enviada com sucesso! Aguarde a liberação.", "success");
    
    setTimeout(() => {
      document.getElementById("registerModal").style.display = "none";
      btn.textContent = "Enviar Solicitação";
      btn.disabled = false;
      // Limpa os campos
      document.getElementById("nameRegister").value = "";
      document.getElementById("emailRegister").value = "";
      document.getElementById("passwordRegister").value = "";
    }, 2000);

  } catch (err) {
    let msg = "Erro ao solicitar acesso.";
    if (err.code === 'auth/email-already-in-use') msg = "Este e-mail já está em uso.";
    if (err.code === 'auth/weak-password') msg = "A senha deve ter pelo menos 6 caracteres.";
    
    showToast(msg, "error");
    btn.textContent = "Enviar Solicitação";
    btn.disabled = false;
  }
});
