import { auth, db, doc, getDoc, signInWithEmailAndPassword } from "./firebase.js";

document.getElementById("loginBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value.trim();

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    // Busca o documento do usuário no Firestore
    const docSnap = await getDoc(doc(db, "atletas", user.uid));
    
    if (docSnap.exists()) {
      const data = docSnap.data();

      // 1. Verifica se está aprovado
      if (data.status === "Pendente") {
        alert("O seu acesso ainda aguarda aprovação do comitê.");
        // Desloga a pessoa para segurança
        await auth.signOut();
        return;
      }

      // 2. Redireciona com base no nível de acesso
      if (data.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "portal.html"; // O portal normal dos atletas
      }

    } else {
      alert("Registo não encontrado na base de dados.");
    }

  } catch (error) {
    alert("Erro ao entrar: E-mail ou senha incorretos.");
  }
});
