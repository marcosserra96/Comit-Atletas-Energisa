// =====================================================
// js/modules/pontuacao.js
// Versão estável - UX de lançamento sem travamento
// =====================================================
import { db, collection, getDocs, doc, query, where, writeBatch, increment } from '../firebase.js';
import { appState } from './state.js';
import { showToast, mostrarConfirmacao } from './ui.js';

let atualizarTelasCallback = null;
let uxPontuacaoInicializada = false;
let lotesRenderizados = new Map();

export function setAtualizarTelasCallback(cb) {
  atualizarTelasCallback = cb;
}

export function setupContabilizacao() {
  const elDataTreino = document.getElementById("dataTreino");
  if (elDataTreino && !elDataTreino.value) elDataTreino.valueAsDate = new Date();

  aplicarEstilosUXPontuacao();
  setupTipoLancamentoUI();
  setupExtratoAgrupadoUI();
  setupModalEditarLote();

  const selectEvento = document.getElementById("lancarEventoSelect");
  if (selectEvento && !selectEvento.dataset.listenerAplicado) {
    selectEvento.dataset.listenerAplicado = "1";
    selectEvento.addEventListener("change", (e) => {
      const evId = e.target.value;
      if (!evId) return;

      const evento = (appState.cacheEventos || []).find(x => x.id === evId);
      if (!evento) return;

      document.getElementById("descTreino").value = evento.titulo || "";
      document.getElementById("dataTreino").value = evento.data || "";
      const kmInput = document.getElementById("kmTreino");
      if (kmInput) kmInput.value = Number(evento.km || 0) > 0 ? Number(evento.km || 0) : "";

      if (evento.modalidade && evento.modalidade !== "Ambas") {
        const modTreino = document.getElementById("modTreino");
        modTreino.value = evento.modalidade;
        modTreino.dispatchEvent(new Event("change"));
      }
    });
  }

  const modTreino = document.getElementById("modTreino");
  if (modTreino && !modTreino.dataset.listenerAplicado) {
    modTreino.dataset.listenerAplicado = "1";
    modTreino.addEventListener("change", async (e) => {
      const mod = e.target.value;
      const areaTabela = document.getElementById("areaTabelaPontuacao");
      if (areaTabela) areaTabela.style.display = "none";

      const btnSalvar = document.getElementById("btnSalvarPontuacao");
      if (btnSalvar) btnSalvar.disabled = true;
      if (!mod) return;

      try {
        const snapRegras = await getDocs(
          query(collection(db, "regras_pontuacao"), where("modalidade", "in", ["Ambas", mod]))
        );

        if (snapRegras.empty) {
          return showToast("Nenhuma regra criada ainda.", "error");
        }

        const regrasArray = [];
        const tipoAtual = getTipoLancamentoAtual();
        snapRegras.forEach(d => {
          const r = d.data();
          const tiposPermitidos = Array.isArray(r.tiposLancamento) && r.tiposLancamento.length
            ? r.tiposLancamento
            : ["treino", "evento", "avulso"];

          if (!tiposPermitidos.includes(tipoAtual)) return;

          regrasArray.push({
            id: d.id,
            descricao: r.descricao,
            pontos: r.pontos,
            regrasVinculadas: r.regrasVinculadas || [],
            tiposLancamento: tiposPermitidos
          });
        });

        if (regrasArray.length === 0) {
          return showToast("Nenhuma regra habilitada para este tipo de lançamento.", "error");
        }

        await gerarTabelaContabilizacao(mod, regrasArray);
        if (areaTabela) areaTabela.style.display = "block";
        if (btnSalvar) btnSalvar.disabled = false;
      } catch (err) {
        showToast("Erro ao carregar tabela: " + err.message, "error");
      }
    });
  }

  const btnSalvar = document.getElementById("btnSalvarPontuacao");
  if (btnSalvar && !btnSalvar.dataset.listenerAplicado) {
    btnSalvar.dataset.listenerAplicado = "1";
    btnSalvar.addEventListener("click", salvarPontuacoesEmLote);
  }

  const btnModelo = document.getElementById("btnExportarModeloExcel");
  if (btnModelo && !btnModelo.dataset.listenerAplicado) {
    btnModelo.dataset.listenerAplicado = "1";
    btnModelo.addEventListener("click", exportarModeloExcelPontuacao);
  }

  const btnImportar = document.getElementById("btnImportarExcel");
  if (btnImportar && !btnImportar.dataset.listenerAplicado) {
    btnImportar.dataset.listenerAplicado = "1";
    btnImportar.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        processarImportacaoExcel(json);
      };

      reader.readAsArrayBuffer(file);
      e.target.value = "";
    });
  }

  setTimeout(() => {
    if (getTipoLancamentoAtual() === "evento") preencherDropdownEventosDisponiveis();
    renderizarExtratoAgrupado();
  }, 600);
}

// =====================================================
// UX VISUAL
// =====================================================
function aplicarEstilosUXPontuacao() {
  if (document.getElementById("uxPontuacaoStyles")) return;

  const style = document.createElement("style");
  style.id = "uxPontuacaoStyles";
  style.textContent = `
    .tipo-lancamento-segmented {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 18px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 8px;
    }

    .tipo-lancamento-btn {
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-light);
      border-radius: 14px;
      padding: 12px 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: .2s ease;
      cursor: pointer;
    }

    .tipo-lancamento-btn:hover {
      background: rgba(0,155,193,.07);
      color: var(--primary);
    }

    .tipo-lancamento-btn.active {
      background: linear-gradient(135deg,#009bc1,#00a693);
      color: #fff;
      box-shadow: 0 8px 22px rgba(0,155,193,.25);
    }

    .event-window-note {
      margin-top: 8px;
      font-size: .78rem;
      color: var(--text-light);
      background: rgba(142,68,173,.08);
      border: 1px solid rgba(142,68,173,.18);
      border-radius: 10px;
      padding: 8px 10px;
    }

    .extrato-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .extrato-tab {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-light);
      padding: 10px 14px;
      border-radius: 999px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }

    .extrato-tab.active {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
      box-shadow: 0 8px 18px rgba(0,155,193,.22);
    }

    .extrato-lotes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit,minmax(280px,1fr));
      gap: 14px;
      margin-bottom: 18px;
    }

    .lote-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      box-shadow: var(--shadow);
      overflow: hidden;
      transition: .2s ease;
      display: flex;
      flex-direction: column;
      min-height: 250px;
    }

    .lote-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 14px 32px rgba(0,0,0,.12);
    }

    .lote-card-head {
      background: linear-gradient(135deg,rgba(0,155,193,.14),rgba(0,179,126,.12));
      padding: 15px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .lote-title {
      font-weight: 800;
      color: var(--text);
      margin: 0 0 4px;
      font-size: .98rem;
      line-height: 1.25;
    }

    .lote-date {
      color: var(--primary);
      font-weight: 800;
      white-space: nowrap;
      font-size: .86rem;
    }

    .lote-meta {
      font-size: .78rem;
      color: var(--text-light);
      line-height: 1.35;
    }

    .lote-body {
      padding: 14px 16px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .lote-stats {
      display: grid;
      grid-template-columns: repeat(4,1fr);
      gap: 8px;
      margin-bottom: 12px;
    }

    .lote-stat {
      background: rgba(0,155,193,.06);
      border: 1px solid rgba(0,155,193,.12);
      border-radius: 13px;
      padding: 9px 6px;
      text-align: center;
      min-height: 54px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .lote-stat strong {
      display: block;
      color: var(--text);
      font-size: 1rem;
    }

    .lote-stat span {
      font-size: .68rem;
      color: var(--text-light);
    }

    .lote-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .lote-action-buttons {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .lancamento-save-bar {
      margin-top: 16px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      box-shadow: var(--shadow);
      position: sticky;
      bottom: 92px;
      z-index: 30;
    }

    .lancamento-save-bar .btn-primario {
      min-width: 220px;
      justify-content: center;
      padding: 13px 18px;
      background: var(--secondary);
    }

    .lancamento-save-bar .btn-primario:disabled {
      opacity: .45;
      cursor: not-allowed;
      filter: grayscale(.25);
    }

    .lancamento-save-bar small {
      color: var(--text-light);
      font-weight: 600;
    }

    .modal-editar-lote-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.78);
      z-index: 10050;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }

    .modal-editar-lote-card {
      width: min(560px, 100%);
      background: var(--bg-card);
      border-radius: 22px;
      border: 1px solid var(--border);
      box-shadow: 0 24px 80px rgba(0,0,0,.28);
      padding: 22px;
      animation: slideUp .22s ease;
    }

    .modal-editar-lote-card h3 {
      margin: 0 0 6px;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-editar-lote-card p {
      margin: 0 0 18px;
      color: var(--text-light);
      font-size: .9rem;
    }

    .modal-editar-lote-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .modal-editar-lote-grid .full {
      grid-column: 1 / -1;
    }

    .modal-editar-lote-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
    }

    .lote-details {
      display: none;
      border-top: 1px solid var(--border);
      padding: 10px 16px 14px;
      background: rgba(0,0,0,.015);
      max-height: 220px;
      overflow: auto;
    }

    .lote-card.open .lote-details {
      display: block;
    }

    .lote-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1px dashed var(--border);
      padding: 7px 0;
      font-size: .82rem;
    }

    .lote-row:last-child {
      border-bottom: 0;
    }

    .lote-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: 999px;
      padding: 5px 8px;
      font-size: .7rem;
      font-weight: 800;
      background: rgba(0,155,193,.1);
      color: var(--primary);
    }

    .nome-atleta-link {
      color: var(--primary);
      font-weight: 800;
      cursor: pointer;
      text-decoration: none;
      border-bottom: 1px dashed rgba(0,155,193,.45);
    }

    .nome-atleta-link:hover {
      filter: brightness(.9);
    }

    .legacy-auditoria-hidden {
      display: none !important;
    }

    @media(max-width:720px) {
      .tipo-lancamento-segmented { grid-template-columns: 1fr; }
      .lote-stats { grid-template-columns: 1fr 1fr; }
      .extrato-lotes-grid { grid-template-columns: 1fr; }
      .lancamento-save-bar { position: static; flex-direction: column; align-items: stretch; }
      .lancamento-save-bar .btn-primario { width: 100%; min-width: 0; }
      .modal-editar-lote-grid { grid-template-columns: 1fr; }
    }
  `;

  document.head.appendChild(style);
}

// =====================================================
// TIPO DE LANÇAMENTO
// =====================================================
function setupTipoLancamentoUI() {
  if (uxPontuacaoInicializada) return;

  const selectEvento = document.getElementById("lancarEventoSelect");
  const desc = document.getElementById("descTreino");
  const card = selectEvento?.closest(".card");

  if (!selectEvento || !desc || !card) return;

  uxPontuacaoInicializada = true;

  const wrap = document.createElement("div");
  wrap.id = "tipoLancamentoWrap";
  wrap.innerHTML = `
    <label style="color: var(--primary); font-weight: 800; margin-bottom: 8px;">Tipo de lançamento</label>
    <div class="tipo-lancamento-segmented" role="group" aria-label="Tipo de lançamento">
      <button type="button" class="tipo-lancamento-btn active" data-tipo="treino">
        <i data-lucide="activity"></i> Treino
      </button>
      <button type="button" class="tipo-lancamento-btn" data-tipo="evento">
        <i data-lucide="calendar-check"></i> Evento
      </button>
      <button type="button" class="tipo-lancamento-btn" data-tipo="avulso">
        <i data-lucide="plus-circle"></i> Avulso
      </button>
    </div>
  `;

  card.prepend(wrap);

  selectEvento.dataset.tipoLancamento = "treino";
  selectEvento.closest("div").style.display = "none";
  desc.placeholder = "Ex: Treino de sábado / Treino especial";

  document.querySelectorAll(".tipo-lancamento-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tipo-lancamento-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      aplicarTipoLancamento(btn.dataset.tipo);
    });
  });

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function aplicarTipoLancamento(tipo) {
  const selectEvento = document.getElementById("lancarEventoSelect");
  const desc = document.getElementById("descTreino");
  const data = document.getElementById("dataTreino");
  const campoEvento = selectEvento?.closest("div");

  if (!selectEvento || !desc || !campoEvento) return;

  selectEvento.dataset.tipoLancamento = tipo;

  if (tipo === "evento") {
    campoEvento.style.display = "block";
    desc.placeholder = "A descrição será preenchida com o evento selecionado";
    preencherDropdownEventosDisponiveis();
    return;
  }

  campoEvento.style.display = "none";
  selectEvento.value = "";
  desc.value = "";
  const kmInput = document.getElementById("kmTreino");
  if (kmInput && tipo === "treino") kmInput.value = "";
  desc.placeholder = tipo === "avulso"
    ? "Ex: Ajuste aprovado pelo comitê / Participação externa"
    : "Ex: Treino de sábado / Treino especial";

  if (data && tipo === "treino") data.valueAsDate = new Date();
}

function getTipoLancamentoAtual() {
  return document.getElementById("lancarEventoSelect")?.dataset.tipoLancamento || "treino";
}

function preencherDropdownEventosDisponiveis() {
  const select = document.getElementById("lancarEventoSelect");
  if (!select || getTipoLancamentoAtual() !== "evento") return;

  const valorAtual = select.value;
  const eventos = Array.isArray(appState.cacheEventos) ? appState.cacheEventos : [];
  const historico = Array.isArray(appState.historicoCompleto) ? appState.historicoCompleto : [];

  const eventosLancados = new Set(
    historico
      .filter(h => h.eventoId)
      .map(h => h.eventoId)
  );

  const hoje = zerarHora(new Date());
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() - 7);

  const proximos = [];
  const recentes = [];

  eventos.forEach(e => {
    if (!e.id || !e.data) return;
    if (eventosLancados.has(e.id)) return;
    if (e.lancamentoRealizado === true || e.statusLancamento === "lancado") return;

    const dataEvento = zerarHora(new Date(e.data + "T00:00:00"));

    if (dataEvento >= hoje) {
      proximos.push(e);
    } else if (dataEvento >= limite) {
      recentes.push(e);
    }
  });

  proximos.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  recentes.sort((a, b) => String(b.data).localeCompare(String(a.data)));

  select.innerHTML = `<option value="">Selecione um evento</option>`;

  adicionarGrupoEventos(select, "Eventos de hoje e próximos", proximos);
  adicionarGrupoEventos(select, "Eventos realizados nos últimos 7 dias", recentes);

  if (proximos.length === 0 && recentes.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhum evento disponível para lançamento";
    opt.disabled = true;
    select.appendChild(opt);
  }

  if (valorAtual && [...select.options].some(o => o.value === valorAtual)) {
    select.value = valorAtual;
  }

  let note = document.getElementById("eventWindowNote");
  if (!note) {
    note = document.createElement("div");
    note.id = "eventWindowNote";
    note.className = "event-window-note";
    select.insertAdjacentElement("afterend", note);
  }

  note.textContent = "Eventos realizados ficam disponíveis por 7 dias. Eventos já lançados são ocultados para evitar duplicidade.";
}

function adicionarGrupoEventos(select, label, eventos) {
  if (!eventos.length) return;

  const group = document.createElement("optgroup");
  group.label = label;

  eventos.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = `${e.titulo || "Evento sem título"} (${formatarData(e.data)})`;
    group.appendChild(opt);
  });

  select.appendChild(group);
}

// =====================================================
// TABELA DE PONTUAÇÃO
// =====================================================
async function gerarTabelaContabilizacao(modalidade, regras) {
  const tabela = document.getElementById("tabelaPontuacao");
  let atletas = Object.values(appState.mapAtletas).filter(
    a => a.equipe === modalidade && a.ativo !== false && a.status === "Aprovado"
  );

  atletas.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));

  if (atletas.length === 0) {
    tabela.innerHTML = `<tr><td style='text-align:center; padding:20px;'>Nenhum atleta ativo na equipe.</td></tr>`;
    return;
  }

  let html = `
    <thead>
      <tr>
        <th style="vertical-align:middle; position:sticky; left:0; background:var(--table-header); z-index:20;">
          Nome do Atleta
        </th>
  `;

  regras.forEach(r => {
    html += `
      <th style="text-align:center; min-width: 100px;">
        <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
          <span style="font-size:0.75rem;">${escapeHtml(r.descricao)}</span>
          <strong style="color:var(--primary);">+${Number(r.pontos) || 0}</strong>
        </div>
      </th>
    `;
  });

  html += `
        <th style="text-align:center; color:var(--accent); min-width: 90px; border-left: 2px solid var(--border);">
          <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
            <span style="font-weight:bold; font-size: 0.8rem;">Falta Justificada</span>
            <label style="font-size:0.75rem; cursor:pointer;">
              <input type="checkbox" id="checkMasterFalta"> Todo Time
            </label>
          </div>
        </th>
        <th style="text-align:left; min-width: 180px; border-left: 1px solid var(--border);">Observação</th>
      </tr>
    </thead>
    <tbody>
  `;

  atletas.forEach(a => {
    html += `
      <tr>
        <td style="font-weight:500; position:sticky; left:0; background:var(--bg-card); z-index:10;">
          ${escapeHtml(a.nome)}
        </td>
    `;

    regras.forEach(r => {
      html += `
        <td style="text-align:center;">
          <input 
            type="checkbox" 
            class="check-ponto" 
            data-atleta-id="${escapeAttr(a.id)}" 
            data-atleta-nome="${escapeAttr(a.nome)}" 
            data-atleta-equipe="${escapeAttr(a.equipe)}" 
            data-regra-id="${escapeAttr(r.id)}" 
            data-regra-desc="${escapeAttr(r.descricao)}" 
            data-pontos="${Number(r.pontos) || 0}" 
            data-exclui="${escapeAttr((r.regrasVinculadas || []).join(","))}"
          >
        </td>
      `;
    });

    html += `
        <td style="text-align:center; background: rgba(243,112,33,0.05); border-left: 2px solid var(--border);">
          <input 
            type="checkbox" 
            class="check-falta" 
            data-atleta-id="${escapeAttr(a.id)}" 
            data-atleta-nome="${escapeAttr(a.nome)}" 
            data-atleta-equipe="${escapeAttr(a.equipe)}"
          >
        </td>
        <td style="border-left: 1px solid var(--border);">
          <input 
            type="text" 
            class="input-obs" 
            data-atleta-id="${escapeAttr(a.id)}" 
            placeholder="Lesão, atestado..." 
            style="display:none; margin:0; padding:8px; font-size:0.8rem;"
          >
        </td>
      </tr>
    `;
  });

  html += `</tbody>`;
  tabela.innerHTML = html;

  const updateObsVisibility = (tr) => {
    const hasChecked = tr.querySelectorAll(".check-ponto:checked, .check-falta:checked").length > 0;
    const obsInput = tr.querySelector(".input-obs");

    if (!obsInput) return;

    if (hasChecked) {
      obsInput.style.display = "block";
    } else {
      obsInput.style.display = "none";
      obsInput.value = "";
    }
  };

  document.querySelectorAll(".check-ponto").forEach(chk => {
    chk.addEventListener("change", (e) => {
      const tr = e.target.closest("tr");

      if (e.target.checked) {
        const idClicado = e.target.dataset.regraId;
        const excluiClicado = e.target.dataset.exclui ? e.target.dataset.exclui.split(",") : [];

        tr.querySelectorAll(".check-ponto").forEach(other => {
          if (other === e.target) return;

          const outroId = other.dataset.regraId;
          const outroExclui = other.dataset.exclui ? other.dataset.exclui.split(",") : [];

          if (excluiClicado.includes(outroId) || outroExclui.includes(idClicado)) {
            other.checked = false;
          }
        });
      }

      updateObsVisibility(tr);
    });
  });

  document.getElementById("checkMasterFalta")?.addEventListener("change", (e) => {
    document.querySelectorAll(".check-falta").forEach(chk => {
      chk.checked = e.target.checked;
      chk.dispatchEvent(new Event("change"));
    });
  });

  document.querySelectorAll(".check-falta").forEach(chk => {
    chk.addEventListener("change", (e) => {
      const tr = e.target.closest("tr");

      tr.querySelectorAll(".check-ponto").forEach(p => {
        p.disabled = e.target.checked;
        if (e.target.checked) p.checked = false;
      });

      updateObsVisibility(tr);
    });
  });
}

// =====================================================
// SALVAR LANÇAMENTO
// =====================================================
async function salvarPontuacoesEmLote() {
  const tipoLancamento = getTipoLancamentoAtual();
  const desc = document.getElementById("descTreino").value.trim();
  const data = document.getElementById("dataTreino").value;
  const kmPercorrido = Number(String(document.getElementById("kmTreino")?.value || "0").replace(",", ".")) || 0;
  const hoje = new Date().toISOString().split("T")[0];

  if (data > hoje) {
    return showToast("Não é permitido lançar dados em datas futuras!", "error");
  }

  const eventoIdSelecionado = tipoLancamento === "evento"
    ? document.getElementById("lancarEventoSelect").value
    : "";

  const checksPontos = document.querySelectorAll(".check-ponto:checked");
  const checksFaltas = document.querySelectorAll(".check-falta:checked");
  const observacoes = document.querySelectorAll(".input-obs");

  if (tipoLancamento === "evento" && !eventoIdSelecionado) {
    return showToast("Selecione um evento para continuar.", "error");
  }

  if (checksPontos.length === 0 && checksFaltas.length === 0) {
    return showToast("Nenhum atleta foi selecionado na tabela!", "error");
  }

  if (!desc || !data) {
    return showToast("Preencha a descrição e a data do lançamento!", "error");
  }

  const totalPontos = Array.from(checksPontos).reduce(
    (s, c) => s + (Number(c.dataset.pontos) || 0),
    0
  );

  const resumo = [
    `Confirmar gravação de ${checksPontos.length + checksFaltas.length} registros?`,
    ``,
    `Tipo: ${rotuloTipo(tipoLancamento)}`,
    `Descrição: ${desc}`,
    `Data: ${formatarData(data)}`,
    `KM por atleta: ${kmPercorrido > 0 ? formatarKm(kmPercorrido) + " km" : "não informado"}`,
    `Pontos totais: ${totalPontos}`
  ].join("\n");

  mostrarConfirmacao("Gravar Lançamentos", resumo, async () => {
    const btn = document.getElementById("btnSalvarPontuacao");
    btn.innerHTML = "Gravando na Base...";
    btn.disabled = true;

    try {
      const batch = writeBatch(db);
      const pontosPorAtleta = {};
      const meuNome = appState.mapAtletas[appState.currentUser?.uid]
        ? appState.mapAtletas[appState.currentUser.uid].nome
        : "Comitê Gestor";

      const loteId = gerarLoteId(tipoLancamento);
      const modalidade = document.getElementById("modTreino")?.value || "";

      const dadosLote = {
        loteId,
        tipoLancamento,
        tituloLancamento: desc,
        modalidade,
        criadoPor: appState.currentUser?.uid || "",
        criadoPorNome: meuNome,
        criadoEm: new Date().toISOString()
      };

      for (const f of checksFaltas) {
        batch.set(doc(collection(db, "historico_pontos")), {
          atletaId: f.dataset.atletaId,
          atletaNome: f.dataset.atletaNome,
          atletaEquipe: f.dataset.atletaEquipe,
          regraId: "falta_just",
          regraDesc: "Falta Justificada",
          pontos: 0,
          descTreino: desc,
          dataTreino: data,
          eventoId: eventoIdSelecionado,
          kmPercorrido: 0,
          ...dadosLote
        });
      }

      for (const check of checksPontos) {
        const aId = check.dataset.atletaId;
        const pts = Number(check.dataset.pontos) || 0;

        batch.set(doc(collection(db, "historico_pontos")), {
          atletaId: aId,
          atletaNome: check.dataset.atletaNome,
          atletaEquipe: check.dataset.atletaEquipe,
          regraId: check.dataset.regraId,
          regraDesc: check.dataset.regraDesc,
          pontos: pts,
          descTreino: desc,
          dataTreino: data,
          eventoId: eventoIdSelecionado,
          kmPercorrido,
          ...dadosLote
        });

        if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0;
        pontosPorAtleta[aId] += pts;
      }

      for (const aId in pontosPorAtleta) {
        batch.update(doc(db, "atletas", aId), {
          pontuacaoTotal: increment(pontosPorAtleta[aId])
        });
      }

      for (const obs of observacoes) {
        if (obs.value.trim() === "" || obs.style.display === "none") continue;

        const tr = obs.closest("tr");
        const hasLancamento = tr.querySelector(".check-ponto:checked") || tr.querySelector(".check-falta:checked");

        if (hasLancamento) {
          batch.set(doc(collection(db, "comentarios_atletas")), {
            atletaId: obs.dataset.atletaId,
            texto: `[Ref: ${data.split("-").reverse().join("/")} - ${desc}] ${obs.value.trim()}`,
            autorNome: meuNome,
            criadoEm: new Date().toISOString()
          });
        }
      }

      await batch.commit();
      showToast("Lançamentos gravados com sucesso!", "success");

      document.getElementById("areaTabelaPontuacao").style.display = "none";
      document.getElementById("descTreino").value = "";
      document.getElementById("lancarEventoSelect").value = "";
      document.getElementById("modTreino").value = "";
      document.getElementById("kmTreino").value = "";
      document.getElementById("btnSalvarPontuacao").disabled = true;
      if (document.getElementById("kmTreino")) document.getElementById("kmTreino").value = "";

      if (atualizarTelasCallback) atualizarTelasCallback();

      setTimeout(() => {
        preencherDropdownEventosDisponiveis();
        renderizarExtratoAgrupado();
      }, 800);
    } catch (error) {
      showToast("Erro ao processar lote: " + error.message, "error");
    } finally {
      btn.innerHTML = "Gravar Lançamentos na Base";
      btn.disabled = false;
    }
  });
}

// =====================================================
// IMPORTAÇÃO / EXPORTAÇÃO
// =====================================================
function exportarModeloExcelPontuacao() {
  const mod = document.getElementById("modTreino").value;

  if (!mod) {
    return showToast("Selecione uma equipe para baixar o modelo.", "error");
  }

  const atletasAlvo = Object.values(appState.mapAtletas).filter(
    a => a.equipe === mod && a.ativo !== false
  );

  if (atletasAlvo.length === 0) {
    return showToast("Nenhum atleta ativo nesta equipe.", "error");
  }

  const dadosPlanilha = atletasAlvo.map(a => ({
    "ID_Oculto (NÃO ALTERAR)": a.id,
    "Atleta": a.nome,
    "Equipe": a.equipe,
    "Pontos a Adicionar": "",
    "KM Percorridos": "",
    "Descrição / Evento": "",
    "Data (AAAA-MM-DD)": new Date().toISOString().split("T")[0]
  }));

  if (typeof XLSX !== "undefined") {
    const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lancamentos");
    XLSX.writeFile(wb, `Modelo_Lancamentos_${mod}.xlsx`);
  } else {
    showToast("Biblioteca Excel não carregada.", "error");
  }
}

async function processarImportacaoExcel(linhas) {
  const lancamentosValidos = linhas.filter(
    l => l["Pontos a Adicionar"] !== "" && l["Pontos a Adicionar"] !== undefined
  );

  if (lancamentosValidos.length === 0) {
    return showToast("A planilha não contém pontos preenchidos.", "error");
  }

  mostrarConfirmacao("Confirmar Importação", `Foram encontrados ${lancamentosValidos.length} lançamentos. Gravar no sistema?`, async () => {
    try {
      showToast("Processando importação...", "info");

      const batch = writeBatch(db);
      const pontosPorAtleta = {};
      const loteId = gerarLoteId("importacao");
      const meuNome = appState.mapAtletas[appState.currentUser?.uid]
        ? appState.mapAtletas[appState.currentUser.uid].nome
        : "Comitê Gestor";

      lancamentosValidos.forEach(l => {
        const aId = l["ID_Oculto (NÃO ALTERAR)"];
        const pts = Number(l["Pontos a Adicionar"]) || 0;
        const kmImportado = Number(String(l["KM Percorridos"] || "0").replace(",", ".")) || 0;
        const desc = l["Descrição / Evento"] || "Lançamento via Planilha";
        const dataStr = l["Data (AAAA-MM-DD)"] || new Date().toISOString().split("T")[0];

        if (!appState.mapAtletas[aId]) return;

        batch.set(doc(collection(db, "historico_pontos")), {
          atletaId: aId,
          atletaNome: appState.mapAtletas[aId].nome,
          atletaEquipe: appState.mapAtletas[aId].equipe,
          regraId: "import",
          regraDesc: "Importação via Planilha",
          pontos: pts,
          descTreino: desc,
          dataTreino: dataStr,
          kmPercorrido: kmImportado,
          loteId,
          tipoLancamento: "importacao",
          tituloLancamento: desc,
          modalidade: appState.mapAtletas[aId].equipe,
          criadoPor: appState.currentUser?.uid || "",
          criadoPorNome: meuNome,
          criadoEm: new Date().toISOString()
        });

        if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0;
        pontosPorAtleta[aId] += pts;
      });

      for (const aId in pontosPorAtleta) {
        batch.update(doc(db, "atletas", aId), {
          pontuacaoTotal: increment(pontosPorAtleta[aId])
        });
      }

      await batch.commit();
      showToast("Importação concluída com sucesso!", "success");

      if (atualizarTelasCallback) atualizarTelasCallback();

      setTimeout(renderizarExtratoAgrupado, 800);
    } catch (err) {
      showToast("Erro ao importar: " + err.message, "error");
    }
  });
}

// =====================================================
// EXTRATO AGRUPADO
// =====================================================
function setupExtratoAgrupadoUI() {
  const tbody = document.getElementById("listaHistorico");
  if (!tbody || document.getElementById("extratoUxWrap")) return;

  const tabelaContainer = tbody.closest(".tabela-container");
  if (!tabelaContainer) return;

  const wrap = document.createElement("div");
  wrap.id = "extratoUxWrap";
  wrap.innerHTML = `
    <div class="extrato-tabs">
      <button type="button" class="extrato-tab active" data-view="lotes">
        <i data-lucide="layers-3"></i> Por lançamento
      </button>
      <button type="button" class="extrato-tab" data-view="auditoria">
        <i data-lucide="list"></i> Auditoria detalhada
      </button>
    </div>
    <div id="extratoLotes" class="extrato-lotes-grid"></div>
  `;

  tabelaContainer.parentNode.insertBefore(wrap, tabelaContainer);
  tabelaContainer.classList.add("legacy-auditoria-hidden");

  wrap.querySelectorAll(".extrato-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".extrato-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const view = btn.dataset.view;
      const lotes = document.getElementById("extratoLotes");

      if (lotes) lotes.style.display = view === "lotes" ? "grid" : "none";
      tabelaContainer.classList.toggle("legacy-auditoria-hidden", view !== "auditoria");
    });
  });

  ["filtroMesHistorico", "filtroEquipeHistorico", "filtroNomeHistorico", "filtroStatusHistorico"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.uxFiltroAplicado) return;

    el.dataset.uxFiltroAplicado = "1";
    el.addEventListener("input", () => setTimeout(renderizarExtratoAgrupado, 80));
  });

  const btnLimpar = document.getElementById("btnLimparFiltrosExtrato");
  if (btnLimpar && !btnLimpar.dataset.uxFiltroAplicado) {
    btnLimpar.dataset.uxFiltroAplicado = "1";
    btnLimpar.addEventListener("click", () => setTimeout(renderizarExtratoAgrupado, 120));
  }

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function renderizarExtratoAgrupado() {
  const container = document.getElementById("extratoLotes");
  if (!container) return;

  const dados = filtrarHistoricoParaUX();

  if (dados.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i data-lucide="clipboard-list"></i>
        <p>Nenhum lançamento encontrado para os filtros selecionados.</p>
      </div>
    `;
    if (typeof lucide !== "undefined") lucide.createIcons();
    return;
  }

  const grupos = agruparLancamentos(dados);
  lotesRenderizados = new Map(grupos.map(g => [g.id, g]));
  container.innerHTML = grupos.map(g => criarCardLote(g)).join("");

  container.querySelectorAll(".btn-toggle-lote").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.closest(".lote-card")?.classList.toggle("open");
    });
  });

  container.querySelectorAll(".btn-editar-lote").forEach(btn => {
    btn.addEventListener("click", () => abrirModalEditarLote(btn.dataset.loteKey));
  });

  container.querySelectorAll(".nome-atleta-link").forEach(el => {
    el.addEventListener("click", () => tentarAbrirFichaAtleta(el.dataset.atletaId));
  });

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function filtrarHistoricoParaUX() {
  const mes = document.getElementById("filtroMesHistorico")?.value;
  const eq = document.getElementById("filtroEquipeHistorico")?.value;
  const nomeBusca = (document.getElementById("filtroNomeHistorico")?.value || "").toLowerCase();
  const statusFiltro = document.getElementById("filtroStatusHistorico")?.value;

  return (appState.historicoCompleto || []).filter(h => {
    const atleta = appState.mapAtletas[h.atletaId];
    const isAtivo = atleta ? atleta.ativo !== false : false;

    if (statusFiltro === "ativos" && !isAtivo) return false;

    const nomeFiltro = h.atletaNome || (atleta ? atleta.nome : "");
    const eqFiltro = h.atletaEquipe || (atleta ? atleta.equipe : "");

    return (
      (!mes || (h.dataTreino || "").startsWith(mes)) &&
      (!eq || eqFiltro === eq) &&
      (!nomeBusca || String(nomeFiltro).toLowerCase().includes(nomeBusca))
    );
  });
}

function agruparLancamentos(dados) {
  const mapa = new Map();

  dados.forEach(h => {
    const chave = h.loteId || [
      h.eventoId || "sem-evento",
      h.dataTreino || "sem-data",
      h.descTreino || "Sem descrição",
      (h.criadoEm || "").slice(0, 16)
    ].join("|");

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        id: chave,
        dataTreino: h.dataTreino,
        titulo: h.tituloLancamento || h.descTreino || "Lançamento sem descrição",
        tipo: h.tipoLancamento || (h.eventoId ? "evento" : "treino"),
        equipe: h.modalidade || h.atletaEquipe || "-",
        criadoPorNome: h.criadoPorNome || "Comitê",
        criadoEm: h.criadoEm,
        itens: []
      });
    }

    mapa.get(chave).itens.push(h);
  });

  return Array.from(mapa.values())
    .map(g => {
      g.qtdAtletas = new Set(g.itens.map(i => i.atletaId)).size;
      g.qtdRegistros = g.itens.length;
      g.totalPontos = g.itens.reduce((s, i) => s + (Number(i.pontos) || 0), 0);
      g.faltas = g.itens.filter(i => Number(i.pontos) === 0).length;
      g.totalKm = calcularKmGrupo(g.itens);
      return g;
    })
    .sort((a, b) => {
      const da = new Date(a.dataTreino || a.criadoEm || "1970-01-01");
      const db = new Date(b.dataTreino || b.criadoEm || "1970-01-01");
      return db - da;
    });
}

function criarCardLote(g) {
  const detalhes = g.itens.map(i => {
    const nome = escapeHtml(i.atletaNome || appState.mapAtletas[i.atletaId]?.nome || "Atleta não encontrado");
    const regra = escapeHtml(i.regraDesc || "-");
    const pontos = Number(i.pontos) === 0 ? "Justificada" : `+${Number(i.pontos) || 0}`;
    const kmInfo = Number(i.kmPercorrido || 0) > 0 ? ` • ${formatarKm(i.kmPercorrido)} km` : "";
    const cor = Number(i.pontos) === 0 ? "var(--accent)" : "var(--secondary)";

    return `
      <div class="lote-row">
        <span>
          <a class="nome-atleta-link" data-atleta-id="${escapeAttr(i.atletaId || "")}">${nome}</a>
          <br>
          <small style="color:var(--text-light);">${regra}${kmInfo}</small>
        </span>
        <strong style="color:${cor};">${pontos}</strong>
      </div>
    `;
  }).join("");

  return `
    <div class="lote-card">
      <div class="lote-card-head">
        <div>
          <p class="lote-title">${escapeHtml(g.titulo)}</p>
          <div class="lote-meta">
            <span class="lote-badge">${rotuloTipo(g.tipo)}</span>
            ${escapeHtml(g.equipe || "-")} · ${escapeHtml(g.criadoPorNome || "Comitê")}
          </div>
        </div>
        <div class="lote-date">${formatarData(g.dataTreino)}</div>
      </div>

      <div class="lote-body">
        <div class="lote-stats">
          <div class="lote-stat"><strong>${g.qtdAtletas}</strong><span>atletas</span></div>
          <div class="lote-stat"><strong>${g.totalPontos}</strong><span>pontos</span></div>
          <div class="lote-stat"><strong>${formatarKm(g.totalKm)}</strong><span>km</span></div>
          <div class="lote-stat"><strong>${g.faltas}</strong><span>faltas</span></div>
        </div>

        <div class="lote-actions">
          <small style="color:var(--text-light);">${g.qtdRegistros} registros no lote</small>
          <div class="lote-action-buttons">
            <button type="button" class="btn-acao btn-editar-lote" data-lote-key="${escapeAttr(g.id)}">
              <i data-lucide="edit-3"></i> Editar
            </button>
            <button type="button" class="btn-acao btn-toggle-lote">
              <i data-lucide="chevron-down"></i> Detalhes
            </button>
          </div>
        </div>
      </div>

      <div class="lote-details">${detalhes}</div>
    </div>
  `;
}


function setupModalEditarLote() {
  if (document.getElementById("modalEditarLote")) return;

  const modal = document.createElement("div");
  modal.id = "modalEditarLote";
  modal.className = "modal-editar-lote-backdrop";
  modal.innerHTML = `
    <div class="modal-editar-lote-card">
      <h3><i data-lucide="edit-3"></i> Editar lançamento</h3>
      <p>Altere dados gerais do lote. Pontos individuais não são recalculados aqui.</p>
      <input type="hidden" id="editLoteKey" />
      <div class="modal-editar-lote-grid">
        <div class="full">
          <label>Descrição</label>
          <input type="text" id="editLoteDescricao" placeholder="Descrição do lançamento" />
        </div>
        <div>
          <label>Data</label>
          <input type="date" id="editLoteData" />
        </div>
        <div>
          <label>KM por atleta</label>
          <input type="number" id="editLoteKm" min="0" step="0.01" placeholder="Ex: 5 ou 21.1" />
        </div>
      </div>
      <div class="modal-editar-lote-actions">
        <button type="button" id="btnCancelarEditLote" class="btn-acao">Cancelar</button>
        <button type="button" id="btnSalvarEditLote" class="btn-primario"><i data-lucide="save"></i> Salvar alterações</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("btnCancelarEditLote")?.addEventListener("click", fecharModalEditarLote);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) fecharModalEditarLote();
  });
  document.getElementById("btnSalvarEditLote")?.addEventListener("click", salvarEdicaoLote);

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function abrirModalEditarLote(loteKey) {
  const lote = lotesRenderizados.get(loteKey);
  if (!lote) {
    showToast("Não foi possível localizar este lote.", "error");
    return;
  }

  const modal = document.getElementById("modalEditarLote");
  if (!modal) return;

  const kmReferencia = lote.itens.find(i => Number(i.kmPercorrido || 0) > 0)?.kmPercorrido || 0;

  document.getElementById("editLoteKey").value = loteKey;
  document.getElementById("editLoteDescricao").value = lote.titulo || "";
  document.getElementById("editLoteData").value = lote.dataTreino || "";
  document.getElementById("editLoteKm").value = kmReferencia ? String(kmReferencia).replace(".", ",") : "";

  modal.style.display = "flex";
}

function fecharModalEditarLote() {
  const modal = document.getElementById("modalEditarLote");
  if (modal) modal.style.display = "none";
}

async function salvarEdicaoLote() {
  const loteKey = document.getElementById("editLoteKey")?.value;
  const lote = lotesRenderizados.get(loteKey);
  if (!lote) return showToast("Lote não localizado.", "error");

  const novaDescricao = document.getElementById("editLoteDescricao")?.value.trim();
  const novaData = document.getElementById("editLoteData")?.value;
  const novoKm = Number(String(document.getElementById("editLoteKm")?.value || "0").replace(",", ".")) || 0;

  if (!novaDescricao || !novaData) {
    return showToast("Preencha descrição e data.", "error");
  }

  const btn = document.getElementById("btnSalvarEditLote");
  btn.disabled = true;
  btn.innerHTML = "Salvando...";

  try {
    const batch = writeBatch(db);

    lote.itens.forEach(item => {
      if (!item.id) return;
      const pontos = Number(item.pontos) || 0;
      batch.update(doc(db, "historico_pontos", item.id), {
        descTreino: novaDescricao,
        tituloLancamento: novaDescricao,
        dataTreino: novaData,
        kmPercorrido: pontos > 0 ? novoKm : 0,
        atualizadoEm: new Date().toISOString()
      });
    });

    await batch.commit();

    appState.historicoCompleto = (appState.historicoCompleto || []).map(h => {
      if (!lote.itens.some(i => i.id === h.id)) return h;
      const pontos = Number(h.pontos) || 0;
      return {
        ...h,
        descTreino: novaDescricao,
        tituloLancamento: novaDescricao,
        dataTreino: novaData,
        kmPercorrido: pontos > 0 ? novoKm : 0,
        atualizadoEm: new Date().toISOString()
      };
    });

    fecharModalEditarLote();
    renderizarExtratoAgrupado();
    showToast("Lançamento atualizado com sucesso.", "success");
  } catch (err) {
    showToast("Erro ao editar lançamento: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="save"></i> Salvar alterações`;
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

function tentarAbrirFichaAtleta(atletaId) {
  if (!atletaId) return;

  let btn = null;
  try {
    btn = document.querySelector(`.btn-ficha[data-id="${CSS.escape(atletaId)}"]`);
  } catch {
    btn = null;
  }

  if (btn) {
    btn.click();
  } else {
    showToast("Abra a ficha pela tela de Equipes para ver todos os detalhes deste atleta.", "info");
  }
}

// =====================================================
// HELPERS
// =====================================================

function calcularKmGrupo(itens = []) {
  const vistos = new Set();
  let total = 0;

  itens.forEach(i => {
    const km = Number(i.kmPercorrido || i.km || 0);
    if (!km || km <= 0) return;

    const chave = `${i.atletaId || ""}|${i.loteId || i.eventoId || `${i.dataTreino || ""}|${i.descTreino || ""}`}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    total += km;
  });

  return total;
}

function formatarKm(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1
  });
}

function gerarLoteId(tipo) {
  return `${tipo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function rotuloTipo(tipo) {
  return {
    treino: "Treino",
    evento: "Evento",
    avulso: "Avulso",
    importacao: "Importação"
  }[tipo] || "Lançamento";
}

function zerarHora(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatarData(dataStr) {
  if (!dataStr) return "-";

  try {
    return new Date(dataStr + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return dataStr;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
