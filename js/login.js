// =====================================================
// js/login.js - AUTENTICAÇÃO SEGURA
// =====================================================
import { auth, db, signInWithEmailAndPassword, getDoc, doc, signOut } from "./firebase.js";

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = message;
  container.appendChild(t);
  
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

  btn.textContent = "Verificando..."; 
  btn.classList.add("loading");
  btn.disabled = true;
  
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    const user = auth.currentUser;
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      if (data.status === "Pendente") {
        showToast("A tua conta aguarda aprovação da Gestão.", "info");
        await signOut(auth);
      } else if (data.role === "atleta") {
        showToast("Acesso restrito à equipa de Gestão.", "error");
        await signOut(auth);
      } else {
        showToast("Acesso liberado! A redirecionar...", "success");
        setTimeout(() => window.location.href = "admin.html", 1000);
        return; 
      }
    } else {
      showToast("Perfil de acesso não encontrado na base de dados.", "error");
      await signOut(auth);
    }
  } catch (error) {
    console.error("Erro no login:", error);
    showToast("E-mail ou palavra-passe incorretos.", "error");
  }
  
  btn.textContent = "Entrar no Sistema"; 
  btn.classList.remove("loading");
  btn.disabled = false;
};

document.getElementById("loginBtn")?.addEventListener("click", fazerLogin);
document.getElementById("password")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") fazerLogin();
});
