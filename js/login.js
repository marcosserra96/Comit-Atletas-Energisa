import { 
  auth, db, doc, setDoc, getDoc, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "./firebase.js";

// --- FUNÇÃO AUXILIAR PARA AVISOS NA TELA (TOAST) ---
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// --- LÓGICA DE LOGIN COM ROTEAMENTO E CRIAÇÃO AUTOMÁTICA DO ADMIN ---
document.getElementById("loginBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value.trim();
  const btn = e.target;

  if (!email || !pass) return showToast("Preencha e-mail e senha", "error");

  btn.textContent = "Verificando...";
  btn.classList.add("loading");
  
  try {
    // 1. GATILHO DE PRIMEIRO ACESSO (Criação automática do Admin)
    if (email === "admin@comite.com") {
      try {
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (err) {
        // Se der erro (a conta não existe), nós criamos ela na hora!
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "atletas", cred.user.uid), {
          nome: "Administrador Geral",
          email: email,
          status: "Aprovado",
          role: "admin",
          criadoEm: new Date().toISOString()
        });
        showToast("Conta de administrador criada automaticamente!", "success");
      }
    } else {
      // Login normal para os outros usuários
      await signInWithEmailAndPassword(auth, email, pass);
    }

    // 2. Busca o perfil do usuário recém-logado no banco de dados
    const user = auth.currentUser;
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    
    if (docSnap.exists()) {
      const data = docSnap.data();

      // Barreira de Segurança: Verifica se o status é "Pendente"
      if (data.status === "Pendente") {
        showToast("Seu acesso ainda está em análise pelo comitê.", "error");
        await signOut(auth); // Desloga o usuário para ele não entrar no sistema
        btn.textContent = "Entrar";
        btn.classList.remove("loading");
        return;
      }

      // Salva dados básicos no navegador para uso nas outras páginas
      localStorage.setItem("userName", data.nome);
      localStorage.setItem("userRole", data.role);

      showToast("Acesso liberado! Redirecionando...", "success");

      // 3. Roteamento: Envia para a página certa
      setTimeout(() => {
        if (data.role === "admin") {
          window.location.href = "admin.html"; // Vai para a gestão
        } else {
          window.location.href = "portal.html"; // Vai para os treinos
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
  const btn = e.target;

  // Removida a validação de modalidade/grupo
  if (!nome || !email || !pass) {
    return showToast("Preencha todos os campos!", "error");
  }

  btn.textContent = "Enviando...";
  btn.disabled = true;

  try {
    // Cria a conta no Firebase
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    
    // Salva no Banco de Dados com status PENDENTE e role ATLETA
    await setDoc(doc(db, "atletas", cred.user.uid), {
      nome: nome,
      email: email,
      status: "Pendente", // Bloqueia a entrada até aprovação
      role: "atleta",     // Nível padrão de acesso
      criadoEm: new Date().toISOString()
    });

    // Desloga imediatamente após o cadastro
    await signOut(auth);

    showToast("Solicitação enviada! Aguarde a liberação do comitê.", "success");
    
    setTimeout(() => {
      document.getElementById("registerModal").style.display = "none";
      btn.textContent = "Enviar Solicitação";
      btn.disabled = false;
      document.getElementById("nameRegister").value = "";
      document.getElementById("emailRegister").value = "";
      document.getElementById("passwordRegister").value = "";
    }, 2500);

  } catch (err) {
    let msg = "Erro ao solicitar acesso.";
    if (err.code === 'auth/email-already-in-use') msg = "Este e-mail já está em uso.";
    if (err.code === 'auth/weak-password') msg = "A senha deve ter pelo menos 6 caracteres.";
    
    showToast(msg, "error");
    btn.textContent = "Enviar Solicitação";
    btn.disabled = false;
  }
});
