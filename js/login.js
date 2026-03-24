import { auth, db, signInWithEmailAndPassword, getDoc, doc, signOut } from "./firebase.js";

// Função para exibir mensagens (Toasts) visuais na tela de Login
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = message;
  container.appendChild(t);
  
  // Renderiza ícones se o Lucide estiver disponível
  if(typeof lucide !== 'undefined') lucide.createIcons();
  
  setTimeout(() => t.remove(), 4000);
}

const fazerLogin = async () => {
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value.trim();
  const btn = document.getElementById("loginBtn");

  if (!email || !pass) {
    return showToast("Preencha e-mail e palavra-passe.", "error");
  }

  // Estado de carregamento no botão
  btn.textContent = "Verificando..."; 
  btn.classList.add("loading");
  btn.disabled = true;
  
  try {
    // 1. Tenta autenticar diretamente no Firebase Auth
    await signInWithEmailAndPassword(auth, email, pass);
    const user = auth.currentUser;
    
    // 2. Procura os dados do utilizador na base de dados
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // 3. Valida os níveis de acesso
      if (data.status === "Pendente") {
        showToast("A tua conta aguarda aprovação da Gestão.", "info");
        await signOut(auth); // Desloga imediatamente se estiver pendente
      } else if (data.role === "atleta") {
        showToast("Acesso restrito à equipa de Gestão.", "error");
        await signOut(auth); // Desloga se for um atleta comum
      } else {
        // Sucesso: É Admin ou Comitê Aprovado
        showToast("Acesso liberado! A redirecionar...", "success");
        setTimeout(() => {
            window.location.href = "admin.html";
        }, 1000);
        return; // Retorna para evitar que o botão volte ao estado inicial
      }
    } else {
      showToast("Perfil de acesso não encontrado na base de dados.", "error");
      await signOut(auth);
    }
  } catch (error) {
    console.error("Erro no login:", error);
    showToast("E-mail ou palavra-passe incorretos.", "error");
  }
  
  // Restaura o botão caso o login falhe
  btn.textContent = "Entrar no Sistema"; 
  btn.classList.remove("loading");
  btn.disabled = false;
};

// Event Listeners (Clique no botão e tecla "Enter")
document.getElementById("loginBtn")?.addEventListener("click", fazerLogin);

document.getElementById("password")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") fazerLogin();
});
