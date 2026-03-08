import { 
  auth, db, doc, setDoc, getDoc, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "./firebase.js";

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Alternar Telas
document.getElementById("linkSolicitar").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("boxLogin").style.display = "none";
  document.getElementById("boxSolicitar").style.display = "block";
});
document.getElementById("linkLogin").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("boxSolicitar").style.display = "none";
  document.getElementById("boxLogin").style.display = "block";
});

// A Função Principal de Login
const fazerLogin = async () => {
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value.trim();
  const btn = document.getElementById("loginBtn");

  if (!email || !pass) return showToast("Preencha e-mail e senha", "error");

  btn.textContent = "Verificando..."; btn.classList.add("loading");
  
  try {
    if (email === "admin@comite.com") {
      try { await signInWithEmailAndPassword(auth, email, pass); } 
      catch (err) {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "atletas", cred.user.uid), { nome: "Administrador Geral", email: email, status: "Aprovado", role: "admin", ativo: true, criadoEm: new Date().toISOString() });
        showToast("Conta Admin criada!", "success");
      }
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }

    const user = auth.currentUser;
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.status === "Pendente") {
        showToast("A sua conta aguarda aprovação do Admin.", "info");
        await signOut(auth);
      } else if (data.role === "atleta") {
        showToast("Acesso restrito ao comitê.", "error");
        await signOut(auth);
      } else {
        showToast("Acesso liberado!", "success");
        setTimeout(() => window.location.href = "admin.html", 1500);
        return; 
      }
    } else {
      showToast("Perfil não encontrado.", "error");
      await signOut(auth);
    }
  } catch (error) {
    showToast("E-mail ou senha incorretos.", "error");
  }
  btn.textContent = "Entrar no Sistema"; btn.classList.remove("loading");
};

// Evento de Clique no Botão
document.getElementById("loginBtn").addEventListener("click", (e) => { e.preventDefault(); fazerLogin(); });

// Evento GLOBAL da Tecla ENTER (À Prova de Falhas)
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    // Se a tela de Login normal estiver visível, faz login.
    if (document.getElementById("boxLogin").style.display !== "none") {
      e.preventDefault();
      fazerLogin();
    } 
    // Se a tela de Cadastro estiver visível, submete a solicitação.
    else if (document.getElementById("boxSolicitar").style.display !== "none") {
      e.preventDefault();
      document.getElementById("registerBtn").click();
    }
  }
});

// Solicitar Acesso
document.getElementById("registerBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("regNome").value.trim(), email = document.getElementById("regEmail").value.trim(), pass = document.getElementById("regPassword").value.trim();
  const btn = e.target;

  if (!nome || !email || !pass) return showToast("Preencha todos os campos!", "error");
  btn.textContent = "Enviando..."; btn.classList.add("loading");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, "atletas", cred.user.uid), {
      nome: nome, email: email, status: "Pendente", role: "comite", equipe: "Nenhuma", ativo: true, pontuacaoTotal: 0, criadoEm: new Date().toISOString()
    });
    await signOut(auth);
    showToast("Solicitação enviada com sucesso! Aguarde aprovação.", "success");
    document.getElementById("linkLogin").click();
  } catch (error) {
    showToast("Erro ao solicitar acesso (E-mail pode já existir).", "error");
  }
  btn.textContent = "Enviar Solicitação"; btn.classList.remove("loading");
});
