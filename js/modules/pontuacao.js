// js/modules/pontuacao.js
import { db, collection, getDocs, doc, query, where, writeBatch, increment, deleteDoc, updateDoc } from '../firebase.js';
import { appState } from './state.js';
import { showToast, mostrarConfirmacao } from './ui.js';

// Função global para re-renderizar a tela (será importada do admin.js no futuro)
let atualizarTelasCallback = null;
export function setAtualizarTelasCallback(cb) { atualizarTelasCallback = cb; }

export function setupContabilizacao() {
  const elDataTreino = document.getElementById("dataTreino");
  if (elDataTreino) elDataTreino.valueAsDate = new Date();

  // Integração com a Agenda
  document.getElementById("lancarEventoSelect")?.addEventListener("change", (e) => { 
    const evId = e.target.value; 
    if(evId) { 
      const evento = appState.cacheEventos.find(x => x.id === evId); 
      if(evento) { 
        document.getElementById("descTreino").value = evento.titulo; 
        document.getElementById("dataTreino").value = evento.data; 
        if(evento.modalidade !== "Ambas") { 
          document.getElementById("modTreino").value = evento.modalidade; 
          document.getElementById("modTreino").dispatchEvent(new Event('change')); 
        } 
      } 
    } else { 
      document.getElementById("descTreino").value = ""; 
      if (elDataTreino) elDataTreino.valueAsDate = new Date(); 
    } 
  });

  // Lógica de Exportar Excel (SheetJS)
  document.getElementById("btnExportarModeloExcel")?.addEventListener("click", () => {
    const mod = document.getElementById("modTreino").value;
    if (!mod) return showToast("Selecione uma 'Equipe Alvo' para baixar o modelo correto.", "error");

    const atletasAlvo = Object.values(appState.mapAtletas).filter(a => a.equipe === mod && a.ativo !== false);
    if (atletasAlvo.length === 0) return showToast("Nenhum atleta ativo nesta equipe.", "error");

    const dadosPlanilha = atletasAlvo.map(a => ({
      "ID_Oculto (NÃO ALTERAR)": a.id,
      "Atleta": a.nome,
      "Equipe": a.equipe,
      "Pontos a Adicionar": "",
      "Descrição / Evento": "",
      "Data (AAAA-MM-DD)": new Date().toISOString().split('T')[0]
    }));

    if(typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
      XLSX.writeFile(wb, `Modelo_Lançamentos_${mod}.xlsx`);
    } else {
      showToast("Biblioteca Excel não carregada.", "error");
    }
  });

  // Lógica de Importar Excel (SheetJS)
  document.getElementById("btnImportarExcel")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const json = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
      processarImportacaoExcel(json);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // Permite subir o mesmo ficheiro novamente
  });
}

async function processarImportacaoExcel(linhas) {
  const lancamentosValidos = linhas.filter(l => l["Pontos a Adicionar"] !== "" && l["Pontos a Adicionar"] !== undefined);
  if (lancamentosValidos.length === 0) return showToast("A planilha não contém pontos preenchidos.", "error");

  mostrarConfirmacao("Confirmar Importação", `Foram encontrados ${lancamentosValidos.length} lançamentos. Gravar no sistema?`, async () => {
    try {
      showToast("Processando importação...", "info");
      const batch = writeBatch(db);
      let pontosPorAtleta = {};
      
      lancamentosValidos.forEach(l => {
        const aId = l["ID_Oculto (NÃO ALTERAR)"];
        const pts = Number(l["Pontos a Adicionar"]) || 0;
        const desc = l["Descrição / Evento"] || "Lançamento via Planilha";
        const dataStr = l["Data (AAAA-MM-DD)"] || new Date().toISOString().split('T')[0];

        if (appState.mapAtletas[aId]) {
          batch.set(doc(collection(db, "historico_pontos")), {
            atletaId: aId, atletaNome: appState.mapAtletas[aId].nome, atletaEquipe: appState.mapAtletas[aId].equipe,
            regraId: "import", regraDesc: "Importação via Planilha",
            pontos: pts, descTreino: desc, dataTreino: dataStr,
            criadoEm: new Date().toISOString()
          });

          if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0;
          pontosPorAtleta[aId] += pts;
        }
      });

      for (let aId in pontosPorAtleta) {
        batch.update(doc(db, "atletas", aId), { pontuacaoTotal: increment(pontosPorAtleta[aId]) });
      }

      await batch.commit();
      showToast("Importação concluída com sucesso!", "success");
      if(atualizarTelasCallback) atualizarTelasCallback();
    } catch (err) {
      showToast("Erro ao importar: " + err.message, "error");
    }
  });
}

// Obs: As funções antigas `gerarTabelaContabilizacao`, `salvarPontuacoesEmLote` e `filtrarHistorico` do admin.js também devem ser movidas para cá.
