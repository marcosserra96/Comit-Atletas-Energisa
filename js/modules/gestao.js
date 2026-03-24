// js/modules/gestao.js
import { db, collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where } from '../firebase.js';
import { appState } from './state.js';
import { showToast, mostrarConfirmacao } from './ui.js';

let atualizarTelasCallback = null;
export function setAtualizarTelasGestao(cb) { atualizarTelasCallback = cb; }

export function setupCadastrarPessoa() { 
  document.getElementById("btnCadastrarPessoa")?.addEventListener("click", async (e) => { 
    const nome = document.getElementById("novoNome")?.value.trim();
    const email = document.getElementById("novoEmail")?.value.trim();
    const sexo = document.getElementById("novoSexo")?.value;
    const dataNasc = document.getElementById("novaDataNasc")?.value;
    const localidade = document.getElementById("novaLocalidade")?.value.trim();
    const anoEntrada = document.getElementById("novoAnoEntrada")?.value.trim();
    const papel = document.getElementById("novoPapel")?.value;
    const btn = e.target; 
    
    if (!nome) return showToast("Preencha o nome obrigatório!", "error"); 
    
    try { 
      btn.textContent = "Salvando..."; btn.classList.add("loading");
      btn.disabled = true; 
      
      await addDoc(collection(db, "atletas"), { 
        nome, email: email || "", sexo: sexo || "", dataNascimento: dataNasc || "", 
        localidade: localidade || "", anoEntrada: anoEntrada || "",
        role: "atleta", equipe: papel, status: "Aprovado", ativo: true, 
        pontuacaoTotal: 0, recusas: 0, criadoEm: new Date().toISOString() 
      }); 
      
      document.querySelectorAll("#sub-cadastrar input").forEach(i => i.value = "");
      showToast(`${nome} adicionado com sucesso!`, "success"); 
      
      document.querySelector('[data-target="sub-equipes"]')?.click(); 
      if(atualizarTelasCallback) atualizarTelasCallback(); 
    } catch (error) { 
      showToast("Erro ao adicionar: " + error.message, "error"); 
    } finally {
      btn.textContent = "Adicionar ao Sistema"; btn.classList.remove("loading");
      btn.disabled = false; 
    }
  }); 
}

export function setupToggleAtivos() {
  document.addEventListener("change", async (e) => { 
    if(e.target.classList.contains("toggle-ativo")) {
      const isAtivo = e.target.checked; 
      const id = e.target.dataset.id;

      if (!isAtivo) {
        // Fluxo de Saída com o novo motivo
        const motivo = prompt("Qual o motivo da saída/desligamento do atleta do programa?"); 
        try { 
          await updateDoc(doc(db, "atletas", id), { 
            ativo: false, 
            dataSaida: new Date().toISOString(),
            motivoSaida: motivo || "Não informado"
          }); 
          showToast("Atleta Inativado.", "info"); 
        } catch(err) { showToast("Erro ao inativar.", "error"); }
      } else {
        // Fluxo de Retorno
        try { 
          await updateDoc(doc(db, "atletas", id), { 
            ativo: true, 
            dataSaida: null, 
            motivoSaida: null 
          }); 
          showToast("Atleta Reativado!", "success"); 
        } catch(err) { showToast("Erro ao ativar.", "error"); }
      }
      
      const td = e.target.closest('tr').querySelector('td'); 
      if(isAtivo) td.classList.remove('inativo-txt'); else td.classList.add('inativo-txt'); 
    }
  }); 
}

export function setupLimparBase() { 
  document.getElementById("btnLimparBase")?.addEventListener("click", () => { 
    if (appState.userRole !== "admin") return; 
    
    mostrarConfirmacao("Zerar Banco de Dados", "CUIDADO EXTREMO! Isso apagará TODOS os dados. Deseja prosseguir?", async () => {
      if (prompt("Digite 'LIMPAR' para confirmar a exclusão de toda a base:") !== "LIMPAR") return;
      
      const btn = document.getElementById("btnLimparBase"); 
      btn.innerHTML = "Apagando base..."; btn.disabled = true; 
      
      try { 
        const colunas = ["historico_pontos", "regras_pontuacao", "despesas", "comentarios_atletas"]; 
        for (let c of colunas) { 
          const snap = await getDocs(collection(db, c)); 
          snap.forEach(async (d) => await deleteDoc(doc(db, c, d.id))); 
        } 
        
        // Mantém a conta administrativa atual segura (exigência da sua arquitetura)
        const snapA = await getDocs(collection(db, "atletas")); 
        snapA.forEach(async (d) => { 
          if (d.data().role !== "admin") {
            await deleteDoc(doc(db, "atletas", d.id)); 
          }
        }); 
        
        showToast("Base Limpa permanentemente!", "success"); 
        setTimeout(() => window.location.reload(), 2000); 
      } catch(err) { 
        showToast("Erro durante a exclusão.", "error"); 
        btn.disabled = false; btn.innerHTML = "Zerar Todo o Banco de Dados";
      }
    }, "danger");
  }); 
}
