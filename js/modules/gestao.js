// =====================================================
// js/modules/gestao.js - GESTÃO DE ATLETAS E BASE
// =====================================================
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
        nome, email: email || "", sexo: sexo || "Masculino", dataNascimento: dataNasc || "", 
        localidade: localidade || "", anoEntrada: anoEntrada || new Date().getFullYear(),
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

export function setupImportacaoAtletas() {
  document.getElementById("btnExportarModeloAtletas")?.addEventListener("click", () => {
    const dadosModelo = [{
      "Nome Completo": "", "E-mail Corporativo": "", "Sexo (Masculino/Feminino)": "",
      "Data Nascimento (AAAA-MM-DD)": "", "Localidade": "", "Ano Entrada": "",
      "Equipe (Bicicleta / Corrida / Fila - Bicicleta / Fila - Corrida)": ""
    }];

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.json_to_sheet(dadosModelo);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cadastro_Atletas");
      XLSX.writeFile(wb, `Modelo_Cadastro_Atletas.xlsx`);
    } else {
      showToast("Biblioteca Excel não carregada.", "error");
    }
  });

  document.getElementById("btnImportarAtletasExcel")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      await processarImportacaoAtletas(json);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; 
  });
}

async function processarImportacaoAtletas(linhas) {
  const cadastrosValidos = linhas.filter(l => l["Nome Completo"] && l["Equipe (Bicicleta / Corrida / Fila - Bicicleta / Fila - Corrida)"]);
  if (cadastrosValidos.length === 0) return showToast("Nenhum atleta válido encontrado na planilha.", "error");

  mostrarConfirmacao("Importar Atletas", `Deseja adicionar ${cadastrosValidos.length} novos membros ao sistema?`, async () => {
    try {
      showToast("Processando cadastros...", "info");
      const { writeBatch } = await import('../firebase.js');
      const batch = writeBatch(db);
      
      cadastrosValidos.forEach(l => {
        const novoRef = doc(collection(db, "atletas")); 
        batch.set(novoRef, {
          nome: String(l["Nome Completo"]).trim(),
          email: l["E-mail Corporativo"] || "",
          sexo: l["Sexo (Masculino/Feminino)"] || "",
          dataNascimento: l["Data Nascimento (AAAA-MM-DD)"] || "",
          localidade: String(l["Localidade"] || "").trim(),
          anoEntrada: l["Ano Entrada"] || new Date().getFullYear(),
          equipe: String(l["Equipe (Bicicleta / Corrida / Fila - Bicicleta / Fila - Corrida)"]).trim(),
          role: "atleta", status: "Aprovado", ativo: true,
          pontuacaoTotal: 0, recusas: 0,
          criadoEm: new Date().toISOString()
        });
      });

      await batch.commit();
      showToast("Atletas importados com sucesso!", "success");
      if (atualizarTelasCallback) atualizarTelasCallback();
    } catch (err) {
      showToast("Erro ao importar: " + err.message, "error");
    }
  });
}

export function setupToggleAtivos() {
  document.addEventListener("change", async (e) => { 
    if(e.target.classList.contains("toggle-ativo")) {
      const isAtivo = e.target.checked; 
      const id = e.target.dataset.id;

      if (!isAtivo) {
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
