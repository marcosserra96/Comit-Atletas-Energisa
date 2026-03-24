// =====================================================
// js/modules/pontuacao.js
// =====================================================
import { db, collection, getDocs, doc, query, where, writeBatch, increment } from '../firebase.js';
import { appState } from './state.js';
import { showToast, mostrarConfirmacao } from './ui.js';

let atualizarTelasCallback = null;
export function setAtualizarTelasCallback(cb) { atualizarTelasCallback = cb; }

export function setupContabilizacao() {
  const elDataTreino = document.getElementById("dataTreino");
  if (elDataTreino) elDataTreino.valueAsDate = new Date();

  // Preencher dados pelo evento da agenda
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

  // Gatilho para gerar a tabela quando escolhe a modalidade
  document.getElementById("modTreino")?.addEventListener("change", async (e) => { 
    const mod = e.target.value; 
    const areaTabela = document.getElementById("areaTabelaPontuacao");
    if(areaTabela) areaTabela.style.display = "none"; 
    
    if (!mod) return; 
    
    try {
      const snapRegras = await getDocs(query(collection(db, "regras_pontuacao"), where("modalidade", "in", ["Ambas", mod]))); 
      if (snapRegras.empty) return showToast("Nenhuma regra criada ainda.", "error"); 
      
      let regrasArray = []; 
      snapRegras.forEach(d => { 
        const r = d.data(); 
        regrasArray.push({ id: d.id, descricao: r.descricao, pontos: r.pontos, regrasVinculadas: r.regrasVinculadas || [] }); 
      }); 
      
      await gerarTabelaContabilizacao(mod, regrasArray); 
      if(areaTabela) areaTabela.style.display = "block"; 
    } catch(err) { 
      showToast("Erro ao carregar tabela: " + err.message, "error"); 
    }
  });

  // Botão de salvar lote
  document.getElementById("btnSalvarPontuacao")?.addEventListener("click", salvarPontuacoesEmLote);

  // Lógica de Exportar/Importar Excel (SheetJS)
  document.getElementById("btnExportarModeloExcel")?.addEventListener("click", () => {
    const mod = document.getElementById("modTreino").value;
    if (!mod) return showToast("Selecione uma 'Equipe Alvo' para baixar o modelo.", "error");

    const atletasAlvo = Object.values(appState.mapAtletas).filter(a => a.equipe === mod && a.ativo !== false);
    if (atletasAlvo.length === 0) return showToast("Nenhum atleta ativo nesta equipe.", "error");

    const dadosPlanilha = atletasAlvo.map(a => ({
      "ID_Oculto (NÃO ALTERAR)": a.id, "Atleta": a.nome, "Equipe": a.equipe,
      "Pontos a Adicionar": "", "Descrição / Evento": "", "Data (AAAA-MM-DD)": new Date().toISOString().split('T')[0]
    }));

    if(typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lancamentos");
      XLSX.writeFile(wb, `Modelo_Lancamentos_${mod}.xlsx`);
    } else {
      showToast("Biblioteca Excel não carregada.", "error");
    }
  });

  document.getElementById("btnImportarExcel")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      processarImportacaoExcel(json);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; 
  });
}

// === AS FUNÇÕES QUE FALTAVAM ===

async function gerarTabelaContabilizacao(modalidade, regras) {
  const tabela = document.getElementById("tabelaPontuacao");
  let atletas = Object.values(appState.mapAtletas).filter(a => a.equipe === modalidade && a.ativo !== false && a.status === "Aprovado");
  atletas.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  
  if (atletas.length === 0) { 
    tabela.innerHTML = `<tr><td style='text-align:center; padding:20px;'>Nenhum atleta ativo na equipe.</td></tr>`; 
    return; 
  }

  let thead = `<thead><tr><th style="vertical-align:middle; position:sticky; left:0; background:var(--table-header); z-index:20;">Nome do Atleta</th>`;
  regras.forEach(r => { 
    thead += `<th style="text-align:center; min-width: 100px;"><div style="display:flex; flex-direction:column; align-items:center; gap:5px;"><span style="font-size:0.75rem;">${r.descricao}</span><strong style="color:var(--primary);">+${r.pontos}</strong></div></th>`; 
  });
  
  thead += `<th style="text-align:center; color:var(--accent); min-width: 90px; border-left: 2px solid var(--border);"><div style="display:flex; flex-direction:column; align-items:center; gap:5px;"><span style="font-weight:bold; font-size: 0.8rem;">Falta Justificada</span><label style="font-size:0.75rem; cursor:pointer;"><input type="checkbox" id="checkMasterFalta"> Todo Time</label></div></th>
            <th style="text-align:left; min-width: 180px; border-left: 1px solid var(--border);">Observação</th></tr></thead><tbody>`;
  
  atletas.forEach(a => {
    thead += `<tr><td style="font-weight:500; position:sticky; left:0; background:var(--bg-card); z-index:10;">${a.nome}</td>`;
    regras.forEach(r => { 
      thead += `<td style="text-align:center;"><input type="checkbox" class="check-ponto" data-atleta-id="${a.id}" data-atleta-nome="${a.nome}" data-atleta-equipe="${a.equipe}" data-regra-id="${r.id}" data-regra-desc="${r.descricao}" data-pontos="${r.pontos}" data-exclui="${(r.regrasVinculadas||[]).join(',')}"></td>`; 
    });
    
    thead += `<td style="text-align:center; background: rgba(243,112,33,0.05); border-left: 2px solid var(--border);"><input type="checkbox" class="check-falta" data-atleta-id="${a.id}" data-atleta-nome="${a.nome}" data-atleta-equipe="${a.equipe}"></td>`;
    thead += `<td style="border-left: 1px solid var(--border);"><input type="text" class="input-obs" data-atleta-id="${a.id}" placeholder="Lesão, atestado..." style="display:none; margin:0; padding:8px; font-size:0.8rem;"></td></tr>`;
  }); 
  
  thead += `</tbody>`; 
  tabela.innerHTML = thead;
  
  const updateObsVisibility = (tr) => {
    const hasChecked = tr.querySelectorAll('.check-ponto:checked, .check-falta:checked').length > 0;
    const obsInput = tr.querySelector('.input-obs');
    if (obsInput) {
      if (hasChecked) { obsInput.style.display = 'block'; } 
      else { obsInput.style.display = 'none'; obsInput.value = ''; }
    }
  };
  
  document.querySelectorAll(".check-ponto").forEach(chk => { 
    chk.addEventListener("change", (e) => { 
      const tr = e.target.closest("tr");
      if (e.target.checked) {
        const idClicado = e.target.dataset.regraId;
        const excluiClicado = e.target.dataset.exclui ? e.target.dataset.exclui.split(",") : [];
        tr.querySelectorAll(".check-ponto").forEach(other => {
          if (other !== e.target) {
            const outroId = other.dataset.regraId;
            const outroExclui = other.dataset.exclui ? other.dataset.exclui.split(",") : [];
            if (excluiClicado.includes(outroId) || outroExclui.includes(idClicado)) other.checked = false;
          }
        });
      }
      updateObsVisibility(tr);
    }); 
  });

  document.getElementById("checkMasterFalta")?.addEventListener("change", (e) => { 
    document.querySelectorAll(".check-falta").forEach(chk => { chk.checked = e.target.checked; chk.dispatchEvent(new Event('change')); }); 
  });
  
  document.querySelectorAll(".check-falta").forEach(chk => { 
    chk.addEventListener("change", (e) => { 
      const tr = e.target.closest("tr"); 
      tr.querySelectorAll(".check-ponto").forEach(p => { p.disabled = e.target.checked; if(e.target.checked) p.checked = false; }); 
      updateObsVisibility(tr);
    }); 
  });
}

async function salvarPontuacoesEmLote() {
  const desc = document.getElementById("descTreino").value.trim();
  const data = document.getElementById("dataTreino").value;
  const hoje = new Date().toISOString().split('T')[0]; 
  
  if (data > hoje) return showToast("Não é permitido lançar dados em datas futuras!", "error");
  
  const eventoIdSelecionado = document.getElementById("lancarEventoSelect").value;
  const checksPontos = document.querySelectorAll(".check-ponto:checked");
  const checksFaltas = document.querySelectorAll(".check-falta:checked");
  const observacoes = document.querySelectorAll(".input-obs");
  
  if (checksPontos.length === 0 && checksFaltas.length === 0) return showToast("Nenhum atleta foi selecionado na tabela!", "error");
  if (!desc || !data) return showToast("Preencha a Descrição e a Data do treino!", "error");
  
  mostrarConfirmacao("Gravar Lançamentos", "Confirmar gravação deste lote de registos na base de dados?", async () => {
    const btn = document.getElementById("btnSalvarPontuacao"); 
    btn.innerHTML = "Gravando na Base..."; btn.disabled = true;

    try {
      const batch = writeBatch(db); 
      let pontosPorAtleta = {};
      const meuNome = appState.mapAtletas[appState.currentUser?.uid] ? appState.mapAtletas[appState.currentUser.uid].nome : "Comitê Gestor";
      
      for (let f of checksFaltas) { 
        batch.set(doc(collection(db, "historico_pontos")), { 
          atletaId: f.dataset.atletaId, atletaNome: f.dataset.atletaNome, atletaEquipe: f.dataset.atletaEquipe, 
          regraId: "falta_just", regraDesc: "Falta Justificada", pontos: 0, descTreino: desc, dataTreino: data, 
          eventoId: eventoIdSelecionado, criadoEm: new Date().toISOString() 
        }); 
      }
      
      for (let check of checksPontos) {
        const aId = check.dataset.atletaId; 
        const pts = Number(check.dataset.pontos) || 0;
        
        batch.set(doc(collection(db, "historico_pontos")), { 
          atletaId: aId, atletaNome: check.dataset.atletaNome, atletaEquipe: check.dataset.atletaEquipe, 
          regraId: check.dataset.regraId, regraDesc: check.dataset.regraDesc, pontos: pts, 
          descTreino: desc, dataTreino: data, eventoId: eventoIdSelecionado, criadoEm: new Date().toISOString() 
        });
        
        if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0; 
        pontosPorAtleta[aId] += pts;
      }
      
      for (let aId in pontosPorAtleta) { 
        batch.update(doc(db, "atletas", aId), { pontuacaoTotal: increment(pontosPorAtleta[aId]) }); 
      }

      for (let obs of observacoes) {
          if (obs.value.trim() !== "" && obs.style.display !== "none") {
              const tr = obs.closest("tr");
              const hasLancemento = tr.querySelector(".check-ponto:checked") || tr.querySelector(".check-falta:checked");
              
              if (hasLancemento) {
                  batch.set(doc(collection(db, "comentarios_atletas")), { 
                      atletaId: obs.dataset.atletaId, 
                      texto: `[Ref: ${data.split('-').reverse().join('/')} - ${desc}] ${obs.value.trim()}`, 
                      autorNome: meuNome, criadoEm: new Date().toISOString() 
                  });
              }
          }
      }
      
      await batch.commit(); 
      showToast("Lançamentos gravados com sucesso!", "success"); 
      
      document.getElementById("areaTabelaPontuacao").style.display = "none"; 
      document.getElementById("descTreino").value = ""; 
      document.getElementById("lancarEventoSelect").value = ""; 
      document.getElementById("modTreino").value = ""; 
      
      if(atualizarTelasCallback) atualizarTelasCallback(); 
    } catch (error) { 
      showToast("Erro ao processar lote: " + error.message, "error"); 
    } finally { 
      btn.innerHTML = `Gravar Lançamentos na Base`; btn.disabled = false; 
    }
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
