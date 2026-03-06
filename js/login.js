import { 
  auth, db, doc, setDoc, getDoc, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "./firebase.js";

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

document.getElementById("loginBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value.trim();
  const btn = e.target;

  if (!email || !pass) return showToast("Preencha e-mail e senha", "error");

  btn.textContent = "Verificando...";
  btn.classList.add("loading");
  
  try {
    // GATILHO DE PRIMEIRO ACESSO (Criação automática do Admin)
    if (email === "admin@comite.com") {
      try {
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (err) {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "atletas", cred.user.uid), {
          nome: "Administrador Geral",
          email: email,
          status: "Aprovado",
          role: "admin",
          criadoEm: new Date().toISOString()
        });
        showToast("Conta de administrador criada!", "success");
      }
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }

    const user = auth.currentUser;
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    
    if (docSnap.exists()) {
      const data = docSnap.data();

      // Bloqueia quem tentar entrar e não for do comitê/admin
      if (data.role === "atleta") {
        showToast("Acesso restrito ao comitê.", "error");
        await signOut(auth);
        btn.textContent = "Entrar no Sistema";
        btn.classList.remove("loading");
        return;
      }

      localStorage.setItem("userName", data.nome);
      localStorage.setItem("userRole", data.role);
      showToast("Acesso liberado!", "success");

      setTimeout(() => window.location.href = "admin.html", 1500);

    } else {
      showToast("Perfil não encontrado.", "error");
      await signOut(auth);
      btn.textContent = "Entrar no Sistema";
      btn.classList.remove("loading");
    }
  } catch (error) {
    showToast("E-mail ou senha incorretos.", "error");
    btn.textContent = "Entrar no Sistema";
    btn.classList.remove("loading");
  }
});
