import { db, collection, getDocs, doc, updateDoc, query, where } from "./firebase.js";

async function carregarAprovacoes() {
  const tbody = document.getElementById("listaAprovacoes");
  
  // Busca apenas quem está com status "Pendente"
  const q = query(collection(db, "atletas"), where("status", "==", "Pendente"));
  const snap = await getDocs(q);
  
  tbody.innerHTML = "";
  
  snap.forEach(d => {
    const u = d.data();
    tbody.innerHTML += `
      <tr>
        <td>${u.nome}</td>
        <td>${u.email}</td>
        <td>
          <button class="btn-aprovar-atleta" data-id="${d.id}">Aprovar Atleta</button>
          <button class="btn-aprovar-admin" data-id="${d.id}" style="background: var(--vermelho);">Aprovar como Admin</button>
        </td>
      </tr>`;
  });

  // Evento para Aprovar como Atleta Normal
  document.querySelectorAll(".btn-aprovar-atleta").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      await updateDoc(doc(db, "atletas", id), { 
        status: "Aprovado",
        role: "atleta" 
      });
      alert("Aprovado como Atleta!");
      carregarAprovacoes(); // Atualiza a lista
    });
  });

  // Evento para Aprovar e dar privilégios de Administrador
  document.querySelectorAll(".btn-aprovar-admin").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      if(confirm("Tem a certeza que deseja dar acesso total de Administrador a esta pessoa?")) {
        await updateDoc(doc(db, "atletas", id), { 
          status: "Aprovado",
          role: "admin" 
        });
        alert("Aprovado e promovido a Administrador!");
        carregarAprovacoes();
      }
    });
  });
}
