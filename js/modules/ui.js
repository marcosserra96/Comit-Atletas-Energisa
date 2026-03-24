// js/modules/ui.js
import { auth, signOut } from '../firebase.js';

export function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer"); 
  if (!container) return;
  const t = document.createElement("div"); 
  t.className = `toast ${type}`; 
  t.innerHTML = message;
  container.appendChild(t); 
  if(typeof lucide !== 'undefined') lucide.createIcons(); 
  setTimeout(() => t.remove(), 4000);
}

export function setupSubTabs() {
  document.querySelectorAll(".sub-tab").forEach(tab => { 
    tab.addEventListener("click", () => { 
      const p = tab.closest('section'); 
      p.querySelectorAll(".sub-tab").forEach(t => t.classList.remove("active")); 
      p.querySelectorAll(".sub-content").forEach(c => c.classList.remove("active")); 
      tab.classList.add("active"); 
      document.getElementById(tab.dataset.target).classList.add("active"); 
    }); 
  });
  
  document.querySelectorAll(".t-tab").forEach(tab => { 
    tab.addEventListener("click", () => { 
      const p = tab.closest('.sub-content'); 
      p.querySelectorAll(".t-tab").forEach(t => t.classList.remove("active")); 
      p.querySelectorAll(".t-content").forEach(c => c.classList.remove("active")); 
      tab.classList.add("active"); 
      document.getElementById(tab.dataset.target).classList.add("active"); 
    }); 
  });
}

export function setupConfiguracoesGerais() {
  // Zoom
  document.querySelectorAll(".btn-zoom").forEach(btn => { 
    btn.addEventListener("click", (e) => { 
      document.documentElement.style.fontSize = e.target.dataset.size; 
    }); 
  }); 
  
  // Tema Dark/Light
  const aplicarTema = (tema) => { 
    if(tema === "dark") { 
      document.body.setAttribute("data-theme", "dark"); 
      localStorage.setItem("theme", "dark"); 
    } else { 
      document.body.removeAttribute("data-theme"); 
      localStorage.setItem("theme", "light"); 
    } 
    // O Chart.js precisará ser atualizado pelo módulo do dashboard posteriormente
  }; 
  
  if (localStorage.getItem("theme") === "dark") aplicarTema("dark"); 
  
  document.getElementById("btnTemaClaro")?.addEventListener("click", () => aplicarTema("light")); 
  document.getElementById("btnTemaEscuro")?.addEventListener("click", () => aplicarTema("dark")); 
  
  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", async () => { 
    // Usaremos nosso novo modal customizado em breve, mas por enquanto:
    if(confirm("Sair?")) { 
      await signOut(auth); 
      window.location.href = "index.html"; 
    } 
  });
}
