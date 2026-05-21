// =====================================================
// js/modules/pontuacao.js
// Melhorias UX: tipo de lançamento, eventos recentes, loteId e extrato agrupado
// =====================================================
import { db, collection, getDocs, doc, query, where, writeBatch, increment } from '../firebase.js';
import { appState } from './state.js';
import { showToast, mostrarConfirmacao } from './ui.js';

let atualizarTelasCallback = null;
let rebuildingEventos = false;

export function setAtualizarTelasCallback(cb) { atualizarTelasCallback = cb; }

export function setupContabilizacao() {
  const elDataTreino = document.getElementById("dataTreino");
  if (elDataTreino) elDataTreino.valueAsDate = new Date();

  aplicarEstilosUXPontuacao();
  setupTipoLancamentoUI();
  setupExtratoAgrupadoUI();

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
    }
  });

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

  document.getElementById("btnSalvarPontuacao")?.addEventListener("click", salvarPontuacoesEmLote);

  document.getElementById("btnExportarModeloExcel")?.addEventListener("click", () => {
    const mod = document.getElementById("modTreino").value;
    if (!mod) return showToast("Selecione uma equipe para baixar o modelo.", "error");

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

  setTimeout(() => {
    renderizarExtratoAgrupado();
  }, 600);
}

function aplicarEstilosUXPontuacao() {
  if (document.getElementById("uxPontuacaoStyles")) return;
  const style = document.createElement("style");
  style.id = "uxPontuacaoStyles";
  style.textContent = `
    .tipo-lancamento-segmented{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;background:var(--bg);border:1px solid var(--border);border-radius:18px;padding:8px}
    .tipo-lancamento-btn{border:1px solid transparent;background:transparent;color:var(--text-light);border-radius:14px;padding:12px 14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;transition:.2s ease;cursor:pointer}
    .tipo-lancamento-btn:hover{background:rgba(0,155,193,.07);color:var(--primary)}
    .tipo-lancamento-btn.active{background:linear-gradient(135deg,#009bc1,#00a693);color:#fff;box-shadow:0 8px 22px rgba(0,155,193,.25)}
    .event-window-note{margin-top:8px;font-size:.78rem;color:var(--text-light);background:rgba(142,68,173,.08);border:1px solid rgba(142,68,173,.18);border-radius:10px;padding:8px 10px}
    .extrato-tabs{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
    .extrato-tab{background:var(--bg-card);border:1px solid var(--border);color:var(--text-light);padding:10px 14px;border-radius:999px;font-weight:700;display:inline-flex;align-items:center;gap:7px}
    .extrato-tab.active{background:var(--primary);border-color:var(--primary);color:#fff;box-shadow:0 8px 18px rgba(0,155,193,.22)}
    .extrato-lotes-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:18px}
    .lote-card{background:var(--bg-card);border:1px solid var(--border);border-radius:20px;box-shadow:var(--shadow);overflow:hidden;transition:.2s ease}
    .lote-card:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(0,0,0,.12)}
    .lote-card-head{background:linear-gradient(135deg,rgba(0,155,193,.14),rgba(0,179,126,.12));padding:15px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .lote-title{font-weight:800;color:var(--text);margin:0 0 4px;font-size:.98rem;line-height:1.25}
    .lote-date{color:var(--primary);font-weight:800;white-space:nowrap;font-size:.86rem}
    .lote-meta{font-size:.78rem;color:var(--text-light);line-height:1.35}
    .lote-body{padding:14px 16px}.lote-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
    .lote-stat{background:rgba(0,155,193,.06);border:1px solid rgba(0,155,193,.12);border-radius:13px;padding:9px 6px;text-align:center}
    .lote-stat strong{display:block;color:var(--text);font-size:1rem}.lote-stat span{font-size:.68rem;color:var(--text-light)}
    .lote-actions{display:flex;gap:8px;align-items:center;justify-content:space-between}.lote-details{display:none;border-top:1px solid var(--border);padding:10px 16px 14px;background:rgba(0,0,0,.015);max-height:220px;overflow:auto}
    .lote-card.open .lote-details{display:block}.lote-row{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed var(--border);padding:7px 0;font-size:.82rem}.lote-row:last-child{border-bottom:0}
    .lote-badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 8px;font-size:.7rem;font-weight:800;background:rgba(0,155,193,.1);color:var(--primary)}
    .nome-atleta-link{color:var(--primary);font-weight:800;cursor:pointer;text-decoration:none;border-bottom:1px dashed rgba(0,155,193,.45)}.nome-atleta-link:hover{filter:brightness(.9)}
    .legacy-auditoria-hidden{display:none!important}
    @media(max-width:720px){.tipo-lancamento-segmented{grid-template-columns:1fr}.lote-stats{grid-template-columns:1fr 1fr}.extrato-lotes-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function setupTipoLancamentoUI() {
  const selectEvento = document.getElementById("lancarEventoSelect");
  const desc = document.getElementById("descTreino");
  const card = selectEvento?.closest(".card");
  if (!selectEvento || !desc || !card || document.getElementById("tipoLancamentoWrap")) return;

  const wrap = document.createElement("div");
  wrap.id = "tipoLancamentoWrap";
  wrap.innerHTML = `
    <label style="color: var(--primary); font-weight: 800; margin-bottom: 8px;">Tipo de lançamento</label>
    <div class="tipo-lancamento-segmented" role="group" aria-label="Tipo de lançamento">
      <button type="button" class="tipo-lancamento-btn active" data-tipo="treino"><i data-lucide="activity"></i> Treino</button>
      <button type="button" class="tipo-lancamento-btn" data-tipo="evento"><i data-lucide="calendar-check"></i> Evento</button>
      <button type="button" class="tipo-lancamento-btn" data-tipo="avulso"><i data-lucide="plus-circle"></i> Avulso</button>
    </div>`;
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

  if(typeof lucide !== 'undefined') lucide.createIcons();
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
    setTimeout(reconstruirDropdownEventos, 0);
  } else {
    campoEvento.style.display = "none";
    selectEvento.value = "";
    desc.value = "";
    desc.placeholder = tipo === "avulso" ? "Ex: Ajuste aprovado pelo comitê / Participação externa" : "Ex: Treino de sábado / Treino especial";
    if (data && tipo !== "avulso") data.valueAsDate = new Date();
  }
}

function reconstruirDropdownEventos() {
  const select = document.getElementById("lancarEventoSelect");
  if (!select || select.dataset.tipoLancamento !== "evento" || rebuildingEventos) return;
  const eventos = Array.isArray(appState.cacheEventos) ? appState.cacheEventos : [];
  const historico = Array.isArray(appState.historicoCompleto) ? appState.historicoCompleto : [];
  const eventosLancados = new Set(historico.filter(h => h.eventoId).map(h => h.eventoId));
  const hoje = zerarHora(new Date());
  const limite = new Date(hoje); limite.setDate(limite.getDate() - 7);
  const proximos = [], recentes = [];
  eventos.forEach(e => {
    if (!e.id || !e.data || eventosLancados.has(e.id) || e.lancamentoRealizado === true || e.statusLancamento === "lancado") return;
    const d = zerarHora(new Date(e.data + "T00:00:00"));
    if (d >= hoje) proximos.push(e); else if (d >= limite) recentes.push(e);
  });
  proximos.sort((a,b) => String(a.data).localeCompare(String(b.data)));
  recentes.sort((a,b) => String(b.data).localeCompare(String(a.data)));
  rebuildingEventos = true;
  select.innerHTML = `<option value="">Selecione um evento</option>`;
  adicionarGrupoEventos(select, "Eventos de hoje e próximos", proximos);
  adicionarGrupoEventos(select, "Eventos realizados nos últimos 7 dias", recentes);
  if (proximos.length === 0 && recentes.length === 0) {
    const opt = document.createElement("option"); opt.value = ""; opt.textContent = "Nenhum evento disponível para lançamento"; opt.disabled = true; select.appendChild(opt);
  }
  rebuildingEventos = false;
  if (!document.getElementById("eventWindowNote")) {
    const note = document.createElement("div"); note.id = "eventWindowNote"; note.className = "event-window-note";
    note.textContent = "Eventos realizados ficam disponíveis por 7 dias. Eventos já lançados são ocultados para evitar duplicidade.";
    select.insertAdjacentElement("afterend", note);
  }
}

function adicionarGrupoEventos(select, label, eventos) {
  if (eventos.length === 0) return;
  const group = document.createElement("optgroup"); group.label = label;
  eventos.forEach(e => { const opt = document.createElement("option"); opt.value = e.id; opt.textContent = `${e.titulo || "Evento sem título"} (${formatarData(e.data)})`; group.appendChild(opt); });
  select.appendChild(group);
}

function setupExtratoAgrupadoUI() {
  const tbody = document.getElementById("listaHistorico");
  if (!tbody || document.getElementById("extratoUxWrap")) return;
  const tabelaContainer = tbody.closest(".tabela-container");
  const wrap = document.createElement("div");
  wrap.id = "extratoUxWrap";
  wrap.innerHTML = `<div class="extrato-tabs"><button type="button" class="extrato-tab active" data-view="lotes"><i data-lucide="layers-3"></i> Por lançamento</button><button type="button" class="extrato-tab" data-view="auditoria"><i data-lucide="list"></i> Auditoria detalhada</button></div><div id="extratoLotes" class="extrato-lotes-grid"></div>`;
  tabelaContainer.parentNode.insertBefore(wrap, tabelaContainer);
  tabelaContainer.classList.add("legacy-auditoria-hidden");
  wrap.querySelectorAll(".extrato-tab").forEach(btn => btn.addEventListener("click", () => {
    wrap.querySelectorAll(".extrato-tab").forEach(b => b.classList.remove("active")); btn.classList.add("active");
    const view = btn.dataset.view; document.getElementById("extratoLotes").style.display = view === "lotes" ? "grid" : "none";
    tabelaContainer.classList.toggle("legacy-auditoria-hidden", view !== "auditoria");
  }));
  ["filtroMesHistorico", "filtroEquipeHistorico", "filtroNomeHistorico", "filtroStatusHistorico"].forEach(id => document.getElementById(id)?.addEventListener("input", () => setTimeout(renderizarExtratoAgrupado, 50)));
  document.getElementById("btnLimparFiltrosExtrato")?.addEventListener("click", () => setTimeout(renderizarExtratoAgrupado, 80));
  new MutationObserver(() => setTimeout(renderizarExtratoAgrupado, 50)).observe(tbody, { childList: true });
  if(typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarExtratoAgrupado() {
  const container = document.getElementById("extratoLotes"); if (!container) return;
  const dados = filtrarHistoricoParaUX();
  if (dados.length === 0) { container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i data-lucide="clipboard-list"></i><p>Nenhum lançamento encontrado para os filtros selecionados.</p></div>`; if(typeof lucide !== 'undefined') lucide.createIcons(); return; }
  const grupos = agruparLancamentos(dados);
  container.innerHTML = grupos.map(g => criarCardLote(g)).join("");
  container.querySelectorAll(".btn-toggle-lote").forEach(btn => btn.addEventListener("click", () => btn.closest(".lote-card")?.classList.toggle("open")));
  container.querySelectorAll(".nome-atleta-link").forEach(el => el.addEventListener("click", () => tentarAbrirFichaAtleta(el.dataset.atletaId)));
  if(typeof lucide !== 'undefined') lucide.createIcons();
}

function filtrarHistoricoParaUX() {
  const mes = document.getElementById("filtroMesHistorico")?.value;
  const eq = document.getElementById("filtroEquipeHistorico")?.value;
  const nomeBusca = (document.getElementById("filtroNomeHistorico")?.value || "").toLowerCase();
  const statusFiltro = document.getElementById("filtroStatusHistorico")?.value;
  return (appState.historicoCompleto || []).filter(h => {
    const atleta = appState.mapAtletas[h.atletaId]; const isAtivo = atleta ? (atleta.ativo !== false) : false;
    if (statusFiltro === "ativos" && !isAtivo) return false;
    const nomeFiltro = h.atletaNome || (atleta ? atleta.nome : ""); const eqFiltro = h.atletaEquipe || (atleta ? atleta.equipe : "");
    return (!mes || (h.dataTreino||"").startsWith(mes)) && (!eq || eqFiltro === eq) && (!nomeBusca || String(nomeFiltro).toLowerCase().includes(nomeBusca));
  });
}

function agruparLancamentos(dados) {
  const mapa = new Map();
  dados.forEach(h => {
    const chave = h.loteId || `${h.eventoId || "sem-evento"}|${h.dataTreino || "sem-data"}|${h.descTreino || "Sem descrição"}|${(h.criadoEm || "").slice(0,16)}`;
    if (!mapa.has(chave)) mapa.set(chave, { id: chave, dataTreino: h.dataTreino, titulo: h.tituloLancamento || h.descTreino || "Lançamento sem descrição", tipo: h.tipoLancamento || (h.eventoId ? "evento" : "treino"), equipe: h.modalidade || h.atletaEquipe || "-", criadoPorNome: h.criadoPorNome || "Comitê", criadoEm: h.criadoEm, itens: [] });
    mapa.get(chave).itens.push(h);
  });
  return Array.from(mapa.values()).map(g => { g.qtdAtletas = new Set(g.itens.map(i => i.atletaId)).size; g.qtdRegistros = g.itens.length; g.totalPontos = g.itens.reduce((s, i) => s + (Number(i.pontos) || 0), 0); g.faltas = g.itens.filter(i => Number(i.pontos) === 0).length; return g; }).sort((a,b) => new Date(b.dataTreino || b.criadoEm || "1970-01-01") - new Date(a.dataTreino || a.criadoEm || "1970-01-01"));
}

function criarCardLote(g) {
  const tipoLabel = rotuloTipo(g.tipo);
  const detalhes = g.itens.map(i => `<div class="lote-row"><span><a class="nome-atleta-link" data-atleta-id="${i.atletaId || ''}">${escapeHtml(i.atletaNome || appState.mapAtletas[i.atletaId]?.nome || "Atleta não encontrado")}</a><br><small style="color:var(--text-light);">${escapeHtml(i.regraDesc || "-")}</small></span><strong style="color:${Number(i.pontos) === 0 ? 'var(--accent)' : 'var(--secondary)'};">${Number(i.pontos) === 0 ? "Justificada" : `+${i.pontos}`}</strong></div>`).join("");
  return `<div class="lote-card"><div class="lote-card-head"><div><p class="lote-title">${escapeHtml(g.titulo)}</p><div class="lote-meta"><span class="lote-badge">${tipoLabel}</span> ${escapeHtml(g.equipe || "-")} · ${escapeHtml(g.criadoPorNome || "Comitê")}</div></div><div class="lote-date">${formatarData(g.dataTreino)}</div></div><div class="lote-body"><div class="lote-stats"><div class="lote-stat"><strong>${g.qtdAtletas}</strong><span>atletas</span></div><div class="lote-stat"><strong>${g.totalPontos}</strong><span>pontos</span></div><div class="lote-stat"><strong>${g.faltas}</strong><span>faltas</span></div></div><div class="lote-actions"><small style="color:var(--text-light);">${g.qtdRegistros} registros no lote</small><button type="button" class="btn-acao btn-toggle-lote"><i data-lucide="chevron-down"></i> Detalhes</button></div></div><div class="lote-details">${detalhes}</div></div>`;
}

function tentarAbrirFichaAtleta(atletaId) {
  if (!atletaId) return;
  const btn = document.querySelector(`.btn-ficha[data-id="${CSS.escape(atletaId)}"]`);
  if (btn) btn.click(); else showToast("Abra a ficha pela tela de Equipes para ver todos os detalhes deste atleta.", "info");
}

async function gerarTabelaContabilizacao(modalidade, regras) {
  const tabela = document.getElementById("tabelaPontuacao");
  let atletas = Object.values(appState.mapAtletas).filter(a => a.equipe === modalidade && a.ativo !== false && a.status === "Aprovado");
  atletas.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  if (atletas.length === 0) { tabela.innerHTML = `<tr><td style='text-align:center; padding:20px;'>Nenhum atleta ativo na equipe.</td></tr>`; return; }
  let thead = `<thead><tr><th style="vertical-align:middle; position:sticky; left:0; background:var(--table-header); z-index:20;">Nome do Atleta</th>`;
  regras.forEach(r => { thead += `<th style="text-align:center; min-width: 100px;"><div style="display:flex; flex-direction:column; align-items:center; gap:5px;"><span style="font-size:0.75rem;">${r.descricao}</span><strong style="color:var(--primary);">+${r.pontos}</strong></div></th>`; });
  thead += `<th style="text-align:center; color:var(--accent); min-width: 90px; border-left: 2px solid var(--border);"><div style="display:flex; flex-direction:column; align-items:center; gap:5px;"><span style="font-weight:bold; font-size: 0.8rem;">Falta Justificada</span><label style="font-size:0.75rem; cursor:pointer;"><input type="checkbox" id="checkMasterFalta"> Todo Time</label></div></th><th style="text-align:left; min-width: 180px; border-left: 1px solid var(--border);">Observação</th></tr></thead><tbody>`;
  atletas.forEach(a => {
    thead += `<tr><td style="font-weight:500; position:sticky; left:0; background:var(--bg-card); z-index:10;">${a.nome}</td>`;
    regras.forEach(r => { thead += `<td style="text-align:center;"><input type="checkbox" class="check-ponto" data-atleta-id="${a.id}" data-atleta-nome="${a.nome}" data-atleta-equipe="${a.equipe}" data-regra-id="${r.id}" data-regra-desc="${r.descricao}" data-pontos="${r.pontos}" data-exclui="${(r.regrasVinculadas||[]).join(',')}"></td>`; });
    thead += `<td style="text-align:center; background: rgba(243,112,33,0.05); border-left: 2px solid var(--border);"><input type="checkbox" class="check-falta" data-atleta-id="${a.id}" data-atleta-nome="${a.nome}" data-atleta-equipe="${a.equipe}"></td><td style="border-left: 1px solid var(--border);"><input type="text" class="input-obs" data-atleta-id="${a.id}" placeholder="Lesão, atestado..." style="display:none; margin:0; padding:8px; font-size:0.8rem;"></td></tr>`;
  });
  tabela.innerHTML = thead + `</tbody>`;
  const updateObsVisibility = (tr) => { const hasChecked = tr.querySelectorAll('.check-ponto:checked, .check-falta:checked').length > 0; const obsInput = tr.querySelector('.input-obs'); if (obsInput) { if (hasChecked) obsInput.style.display = 'block'; else { obsInput.style.display = 'none'; obsInput.value = ''; } } };
  document.querySelectorAll(".check-ponto").forEach(chk => chk.addEventListener("change", (e) => { const tr = e.target.closest("tr"); if (e.target.checked) { const idClicado = e.target.dataset.regraId; const excluiClicado = e.target.dataset.exclui ? e.target.dataset.exclui.split(",") : []; tr.querySelectorAll(".check-ponto").forEach(other => { if (other !== e.target) { const outroId = other.dataset.regraId; const outroExclui = other.dataset.exclui ? other.dataset.exclui.split(",") : []; if (excluiClicado.includes(outroId) || outroExclui.includes(idClicado)) other.checked = false; } }); } updateObsVisibility(tr); }));
  document.getElementById("checkMasterFalta")?.addEventListener("change", (e) => document.querySelectorAll(".check-falta").forEach(chk => { chk.checked = e.target.checked; chk.dispatchEvent(new Event('change')); }));
  document.querySelectorAll(".check-falta").forEach(chk => chk.addEventListener("change", (e) => { const tr = e.target.closest("tr"); tr.querySelectorAll(".check-ponto").forEach(p => { p.disabled = e.target.checked; if(e.target.checked) p.checked = false; }); updateObsVisibility(tr); }));
}

async function salvarPontuacoesEmLote() {
  const tipoLancamento = document.getElementById("lancarEventoSelect")?.dataset.tipoLancamento || "treino";
  const desc = document.getElementById("descTreino").value.trim();
  const data = document.getElementById("dataTreino").value;
  const hoje = new Date().toISOString().split('T')[0];
  if (data > hoje) return showToast("Não é permitido lançar dados em datas futuras!", "error");
  const eventoIdSelecionado = tipoLancamento === "evento" ? document.getElementById("lancarEventoSelect").value : "";
  const checksPontos = document.querySelectorAll(".check-ponto:checked"); const checksFaltas = document.querySelectorAll(".check-falta:checked"); const observacoes = document.querySelectorAll(".input-obs");
  if (tipoLancamento === "evento" && !eventoIdSelecionado) return showToast("Selecione um evento para continuar.", "error");
  if (checksPontos.length === 0 && checksFaltas.length === 0) return showToast("Nenhum atleta foi selecionado na tabela!", "error");
  if (!desc || !data) return showToast("Preencha a descrição e a data do lançamento!", "error");
  const totalPontos = Array.from(checksPontos).reduce((s, c) => s + (Number(c.dataset.pontos) || 0), 0);
  const resumo = `Confirmar gravação de ${checksPontos.length + checksFaltas.length} registros?\n\nTipo: ${rotuloTipo(tipoLancamento)}\nDescrição: ${desc}\nData: ${formatarData(data)}\nPontos totais: ${totalPontos}`;
  mostrarConfirmacao("Gravar Lançamentos", resumo, async () => {
    const btn = document.getElementById("btnSalvarPontuacao"); btn.innerHTML = "Gravando na Base..."; btn.disabled = true;
    try {
      const batch = writeBatch(db); let pontosPorAtleta = {};
      const meuNome = appState.mapAtletas[appState.currentUser?.uid] ? appState.mapAtletas[appState.currentUser.uid].nome : "Comitê Gestor";
      const loteId = gerarLoteId(tipoLancamento); const modalidade = document.getElementById("modTreino")?.value || "";
      const dadosLote = { loteId, tipoLancamento, tituloLancamento: desc, modalidade, criadoPor: appState.currentUser?.uid || "", criadoPorNome: meuNome, criadoEm: new Date().toISOString() };
      for (let f of checksFaltas) batch.set(doc(collection(db, "historico_pontos")), { atletaId: f.dataset.atletaId, atletaNome: f.dataset.atletaNome, atletaEquipe: f.dataset.atletaEquipe, regraId: "falta_just", regraDesc: "Falta Justificada", pontos: 0, descTreino: desc, dataTreino: data, eventoId: eventoIdSelecionado, ...dadosLote });
      for (let check of checksPontos) { const aId = check.dataset.atletaId; const pts = Number(check.dataset.pontos) || 0; batch.set(doc(collection(db, "historico_pontos")), { atletaId: aId, atletaNome: check.dataset.atletaNome, atletaEquipe: check.dataset.atletaEquipe, regraId: check.dataset.regraId, regraDesc: check.dataset.regraDesc, pontos: pts, descTreino: desc, dataTreino: data, eventoId: eventoIdSelecionado, ...dadosLote }); if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0; pontosPorAtleta[aId] += pts; }
      for (let aId in pontosPorAtleta) batch.update(doc(db, "atletas", aId), { pontuacaoTotal: increment(pontosPorAtleta[aId]) });
      for (let obs of observacoes) if (obs.value.trim() !== "" && obs.style.display !== "none") { const tr = obs.closest("tr"); const hasLancemento = tr.querySelector(".check-ponto:checked") || tr.querySelector(".check-falta:checked"); if (hasLancemento) batch.set(doc(collection(db, "comentarios_atletas")), { atletaId: obs.dataset.atletaId, texto: `[Ref: ${data.split('-').reverse().join('/')} - ${desc}] ${obs.value.trim()}`, autorNome: meuNome, criadoEm: new Date().toISOString() }); }
      await batch.commit(); showToast("Lançamentos gravados com sucesso!", "success");
      document.getElementById("areaTabelaPontuacao").style.display = "none"; document.getElementById("descTreino").value = ""; document.getElementById("lancarEventoSelect").value = ""; document.getElementById("modTreino").value = "";
      if(atualizarTelasCallback) atualizarTelasCallback(); setTimeout(renderizarExtratoAgrupado, 800);
    } catch (error) { showToast("Erro ao processar lote: " + error.message, "error"); }
    finally { btn.innerHTML = `Gravar Lançamentos na Base`; btn.disabled = false; }
  });
}

async function processarImportacaoExcel(linhas) {
  const lancamentosValidos = linhas.filter(l => l["Pontos a Adicionar"] !== "" && l["Pontos a Adicionar"] !== undefined);
  if (lancamentosValidos.length === 0) return showToast("A planilha não contém pontos preenchidos.", "error");
  mostrarConfirmacao("Confirmar Importação", `Foram encontrados ${lancamentosValidos.length} lançamentos. Gravar no sistema?`, async () => {
    try {
      showToast("Processando importação...", "info"); const batch = writeBatch(db); let pontosPorAtleta = {};
      const loteId = gerarLoteId("importacao"); const meuNome = appState.mapAtletas[appState.currentUser?.uid] ? appState.mapAtletas[appState.currentUser.uid].nome : "Comitê Gestor";
      lancamentosValidos.forEach(l => { const aId = l["ID_Oculto (NÃO ALTERAR)"]; const pts = Number(l["Pontos a Adicionar"]) || 0; const desc = l["Descrição / Evento"] || "Lançamento via Planilha"; const dataStr = l["Data (AAAA-MM-DD)"] || new Date().toISOString().split('T')[0]; if (appState.mapAtletas[aId]) { batch.set(doc(collection(db, "historico_pontos")), { atletaId: aId, atletaNome: appState.mapAtletas[aId].nome, atletaEquipe: appState.mapAtletas[aId].equipe, regraId: "import", regraDesc: "Importação via Planilha", pontos: pts, descTreino: desc, dataTreino: dataStr, loteId, tipoLancamento: "importacao", tituloLancamento: desc, modalidade: appState.mapAtletas[aId].equipe, criadoPor: appState.currentUser?.uid || "", criadoPorNome: meuNome, criadoEm: new Date().toISOString() }); if (!pontosPorAtleta[aId]) pontosPorAtleta[aId] = 0; pontosPorAtleta[aId] += pts; } });
      for (let aId in pontosPorAtleta) batch.update(doc(db, "atletas", aId), { pontuacaoTotal: increment(pontosPorAtleta[aId]) });
      await batch.commit(); showToast("Importação concluída com sucesso!", "success"); if(atualizarTelasCallback) atualizarTelasCallback(); setTimeout(renderizarExtratoAgrupado, 800);
    } catch (err) { showToast("Erro ao importar: " + err.message, "error"); }
  });
}

function gerarLoteId(tipo) { return `${tipo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function rotuloTipo(tipo) { return { treino: "Treino", evento: "Evento", avulso: "Avulso", importacao: "Importação" }[tipo] || "Lançamento"; }
function zerarHora(data) { const d = new Date(data); d.setHours(0,0,0,0); return d; }
function formatarData(dataStr) { if (!dataStr) return "-"; try { return new Date(dataStr + "T00:00:00").toLocaleDateString('pt-BR'); } catch { return dataStr; } }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
