// js/modules/dashboard.js
import { appState } from './state.js';
import { showToast } from './ui.js';

export function setupDashboard() {
  const btn = document.getElementById("btnExportarPDF");
  if (btn && !btn.dataset.listenerAplicado) {
    btn.dataset.listenerAplicado = "1";
    btn.addEventListener("click", exportarPDFExecutivo);
  }
}

export function renderGraficosETop(ptsBike, ptsCorrida, arrayAtletas, totalBike, totalCorrida) {
  const hoje = new Date();
  const limite30d = new Date();
  limite30d.setDate(limite30d.getDate() - 30);

  let engajados30d = 0;
  let totalPontosGlobal = 0;

  arrayAtletas.forEach(a => {
    totalPontosGlobal += Number(a.pts) || 0;
    if (a.ativo !== false) {
      const historicoAtleta = (appState.historicoCompleto || [])
        .filter(h => h.atletaId === a.id && Number(h.pontos) > 0 && h.dataTreino)
        .sort((x, y) => new Date(y.dataTreino) - new Date(x.dataTreino));
      const lastEntry = historicoAtleta[0];
      if (lastEntry) {
        const dataTreino = new Date(lastEntry.dataTreino + "T00:00:00");
        const diffTime = Math.abs(hoje - dataTreino);
        a.diasAusente = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (dataTreino >= limite30d) engajados30d++;
      } else {
        a.diasAusente = 999;
      }
    } else {
      a.diasAusente = -1;
    }
  });

  const totalAtivosGerais = arrayAtletas.filter(a => a.ativo !== false).length;
  const analytics = calcularAnalyticsReport(arrayAtletas);
  const monthly = calcularSeriesMensais();
  const modStats = calcularStatsModalidades(arrayAtletas, ptsBike, ptsCorrida, totalBike, totalCorrida);

  setTextDashboard("totalAtivosGeral", totalAtivosGerais);
  const engPct = (totalAtivosGerais > 0 ? Math.round((engajados30d / totalAtivosGerais) * 100) : 0) + "%";
  setTextDashboard("engajamento30d", engPct);
  setTextDashboard("engajamento30d_badge", engPct);
  setTextDashboard("dashAtivos30d", engajados30d);
  setTextDashboard("dashParticipacoes", analytics.participacoes);
  setTextDashboard("dashKmTotal", `${formatarKm(analytics.kmTotal)} km`);
  setTextDashboard("roiAtleta", (totalAtivosGerais > 0 ? (appState.gastoTotalGlobal / totalAtivosGerais) : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

  const custo = Number(appState.gastoTotalGlobal) || 0;
  const custoParticipacao = analytics.participacoes ? custo / analytics.participacoes : 0;
  const custoKm = analytics.kmTotal ? custo / analytics.kmTotal : 0;
  setTextDashboard("dashCustoParticipacao", custoParticipacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  setTextDashboard("dashCustoKm", custoKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

  setTextDashboard("dashResumoSaude", montarResumoSaude(totalAtivosGerais, engajados30d, analytics));
  atualizarResumoMensal(monthly);
  atualizarCardsModalidade(modStats);
  atualizarPainelEstrategicoFinal(arrayAtletas, totalAtivosGerais, analytics);
  renderizarPodios(arrayAtletas);
  renderizarRadarInatividade(arrayAtletas);
  renderizarGraficoEvolucaoMensal(monthly);
}

function montarResumoSaude(totalAtivos, engajados30d, analytics) {
  const eng = totalAtivos ? Math.round((engajados30d / totalAtivos) * 100) : 0;
  return `${eng}% de engajamento recente · ${analytics.participacoes} participações · ${formatarKm(analytics.kmTotal)} km acumulados.`;
}

function atualizarResumoMensal(monthly) {
  const mesAtual = new Date().getMonth();
  const part = monthly.participacoes[mesAtual] || 0;
  const pts = monthly.pontos[mesAtual] || 0;
  const km = monthly.km[mesAtual] || 0;
  const resumoMes = `Mês atual: ${part} part. · ${pts} pts · ${formatarKm(km)} km`;
  setTextDashboard("dashMesAtualResumo", resumoMes);
  setTextDashboard("dashMesAtualResumo_chart", resumoMes);

  const ultimos3 = monthly.participacoes.slice(Math.max(0, mesAtual - 2), mesAtual + 1);
  let tendencia = "sem dados";
  if (ultimos3.length >= 2) {
    const primeiro = ultimos3[0] || 0;
    const ultimo = ultimos3[ultimos3.length - 1] || 0;
    if (ultimo > primeiro) tendencia = "alta nos últimos meses";
    else if (ultimo < primeiro) tendencia = "queda nos últimos meses";
    else tendencia = "estável nos últimos meses";
  }
  const tendenciaTexto = `Tendência: ${tendencia}`;
  setTextDashboard("dashTendencia3m", tendenciaTexto);
  setTextDashboard("dashTendencia3m_chart", tendenciaTexto);
}

function atualizarCardsModalidade(stats) {
  const setBar = (id, pct) => {
    const el = document.getElementById(id);
    if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  };

  setTextDashboard("totalBike", stats.bike.total);
  setTextDashboard("totalCorrida", stats.corrida.total);
  setTextDashboard("dashBikeAtivos30d", stats.bike.ativos30d);
  setTextDashboard("dashCorridaAtivos30d", stats.corrida.ativos30d);
  setTextDashboard("dashBikeEngajamento", `${stats.bike.engajamento}%`);
  setTextDashboard("dashCorridaEngajamento", `${stats.corrida.engajamento}%`);
  setTextDashboard("dashBikeInativos", stats.bike.inativos30d);
  setTextDashboard("dashCorridaInativos", stats.corrida.inativos30d);
  setTextDashboard("dashBikeKm", `${formatarKm(stats.bike.km)} km`);
  setTextDashboard("dashCorridaKm", `${formatarKm(stats.corrida.km)} km`);
  setBar("dashBikeEngBar", stats.bike.engajamento);
  setBar("dashCorridaEngBar", stats.corrida.engajamento);

  setTextDashboard("mediaBike", stats.bike.mediaPts);
  setTextDashboard("mediaCorrida", stats.corrida.mediaPts);
  setTextDashboard("dashBikeParticipacoes", stats.bike.participacoes);
  setTextDashboard("dashCorridaParticipacoes", stats.corrida.participacoes);
  setTextDashboard("dashBikePontosTotal", stats.bike.pontos);
  setTextDashboard("dashCorridaPontosTotal", stats.corrida.pontos);
  setTextDashboard("dashBikeTop", stats.bike.topAtleta);
  setTextDashboard("dashCorridaTop", stats.corrida.topAtleta);
}

function atualizarIconesOutlineDashboard() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarPodios(arrayAtletas) {
  const htmlPodio = (arr) => {
    if (arr.length === 0) {
      return `<li class="podium-empty">Sem pontos registrados</li>`;
    }

    return arr.map((a, i) => {
      const posicao = i + 1;
      return `
        <li class="podium-rank podium-rank-${posicao}">
          <span class="podium-medal podium-medal-${posicao}"><i data-lucide="medal"></i><b>${posicao}</b></span>
          <span class="podium-athlete">
            <strong title="${escapeHtml(a.nome)}">${escapeHtml(a.nome)}</strong>
            ${i === 0 ? '<em>Destaque do ranking</em>' : '<em>Top ' + posicao + '</em>'}
          </span>
          <strong class="podium-score">${Number(a.pts) || 0}</strong>
        </li>`;
    }).join('');
  };

  const bikeAtletas = arrayAtletas.filter(a => a.eq === 'Bicicleta' || a.eq === 'Bike').sort((a, b) => b.pts - a.pts).slice(0, 3);
  const corridaAtletas = arrayAtletas.filter(a => a.eq === 'Corrida').sort((a, b) => b.pts - a.pts).slice(0, 3);

  setHtmlDashboard("listaPodioBike", htmlPodio(bikeAtletas));
  setHtmlDashboard("listaPodioCorrida", htmlPodio(corridaAtletas));
  atualizarIconesOutlineDashboard();
}

function renderizarRadarInatividade(arrayAtletas) {
  const radarBike = arrayAtletas.filter(a => a.diasAusente > 30 && (a.eq === 'Bicicleta' || a.eq === 'Bike')).sort((a, b) => b.diasAusente - a.diasAusente).slice(0, 5);
  const radarCorrida = arrayAtletas.filter(a => a.diasAusente > 30 && a.eq === 'Corrida').sort((a, b) => b.diasAusente - a.diasAusente).slice(0, 5);

  const htmlEvasao = (arr) => {
    if (arr.length === 0) return `<li class="inactivity-empty">Nenhum alerta no momento</li>`;
    return arr.map(a => {
      const periodo = a.diasAusente === 999 ? 'Sem registro' : `${a.diasAusente} dias`;
      return `<li class="inactivity-item">
        <span class="inactivity-name"><i data-lucide="alert-triangle"></i><strong title="${escapeHtml(a.nome)}">${escapeHtml(a.nome)}</strong></span>
        <small>${periodo}</small>
      </li>`;
    }).join('');
  };

  setHtmlDashboard("listaEvasaoBike", htmlEvasao(radarBike));
  setHtmlDashboard("listaEvasaoCorrida", htmlEvasao(radarCorrida));
  atualizarIconesOutlineDashboard();
}

function renderizarGraficoEvolucaoMensal(monthly) {
  const canvas = document.getElementById('graficoTendencia');
  if (!canvas || typeof Chart === 'undefined') return;

  if (appState.graficoLinhaInstancia) appState.graficoLinhaInstancia.destroy();

  appState.graficoLinhaInstancia = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      datasets: [
        { type: 'bar', label: 'Participações', data: monthly.participacoes, backgroundColor: 'rgba(0,155,193,0.18)', borderColor: '#009bc1', borderWidth: 1, borderRadius: 8, yAxisID: 'y' },
        { type: 'line', label: 'Pontos', data: monthly.pontos, borderColor: '#00a693', backgroundColor: 'rgba(0,166,147,0.12)', tension: 0.35, pointRadius: 3, yAxisID: 'y' },
        { type: 'line', label: 'KM', data: monthly.km, borderColor: '#8e44ad', backgroundColor: 'rgba(142,68,173,0.10)', tension: 0.35, pointRadius: 3, yAxisID: 'y' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } }
    }
  });
}

async function exportarPDFExecutivo() {
  const temaAtual = document.body.getAttribute("data-theme");
  if (temaAtual === "dark") document.body.removeAttribute("data-theme");

  showToast("Montando report oficial A4...", "info");
  const modalPdf = document.getElementById("pdfOverlay");

  try {
    await garantirBibliotecasPDF();
    if (typeof html2canvas === "undefined" || !window.jspdf?.jsPDF) {
      return showToast("Bibliotecas de PDF não carregadas. Verifique a conexão com a internet ou bloqueio dos CDNs.", "error");
    }

    if (modalPdf) modalPdf.style.display = "flex";
    await aguardar(150);

    const exportRoot = construirReportPaginasA4();
    document.body.appendChild(exportRoot);
    await aguardar(250);

    const pageWidth = 794;
    const pageHeight = 1123;
    const paginas = Array.from(exportRoot.querySelectorAll(".pdf-page-v10"));
    const pdf = new window.jspdf.jsPDF("p", "pt", [pageWidth, pageHeight]);

    for (let i = 0; i < paginas.length; i++) {
      const canvas = await html2canvas(paginas[i], {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        width: pageWidth,
        height: pageHeight,
        windowWidth: pageWidth,
        windowHeight: pageHeight,
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      if (i > 0) pdf.addPage([pageWidth, pageHeight], "p");
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
    }

    const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    pdf.save(`Report_Atletas_${dataHoje}.pdf`);
    exportRoot.remove();
    showToast("Download concluído!", "success");
  } catch (err) {
    console.error("Erro ao exportar PDF:", err);
    document.getElementById("pdfExportClone")?.remove();
    showToast("Erro ao exportar o report.", "error");
  } finally {
    if (modalPdf) modalPdf.style.display = "none";
    if (temaAtual === "dark") document.body.setAttribute("data-theme", "dark");
  }
}

async function garantirBibliotecasPDF() {
  const carregarScript = (src) => new Promise((resolve, reject) => {
    const existente = document.querySelector(`script[src="${src}"]`);
    if (existente) {
      if (existente.dataset.loaded === "true") return resolve();
      existente.addEventListener("load", resolve, { once: true });
      existente.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const promessas = [];
  if (typeof html2canvas === "undefined") promessas.push(carregarScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"));
  if (!window.jspdf?.jsPDF) promessas.push(carregarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"));
  if (promessas.length > 0) {
    await Promise.all(promessas);
    await aguardar(150);
  }
}

function construirReportPaginasA4() {
  const analytics = calcularAnalyticsReport();
  const monthly = calcularSeriesMensais();
  const atletas = Object.values(appState.mapAtletas || {}).filter(a => a.role === 'atleta' && a.status === 'Aprovado' && !String(a.equipe || '').startsWith('Fila'));
  const arrayAtletas = atletas.map(a => ({ id: a.id, nome: a.nome, eq: a.equipe, pts: Number(a.pontuacaoTotal) || 0, ativo: a.ativo !== false }));
  const stats = calcularStatsModalidades(arrayAtletas, 0, 0, 0, 0);
  const eventosPendentes = contarEventosPendentesLancamento();
  const filaAguardando = Object.values(appState.mapAtletas || {}).filter(a => String(a.equipe || "").startsWith("Fila")).length;
  const regrasSemUso = contarRegrasSemUso();
  const alertas = montarAlertasReport(arrayAtletas, eventosPendentes, filaAguardando, regrasSemUso, analytics);
  const chartImg = document.getElementById('graficoTendencia')?.toDataURL("image/png", 1.0) || "";
  const custo = Number(appState.gastoTotalGlobal) || 0;
  const totalAtivos = arrayAtletas.filter(a => a.ativo !== false).length;
  const eng = document.getElementById("engajamento30d")?.textContent || "0%";

  const root = document.createElement("div");
  root.id = "pdfExportClone";
  root.className = "pdf-export-book-v10";
  root.style.position = "absolute";
  root.style.left = "-9999px";
  root.style.top = "0";
  root.style.width = "794px";

  const pagina = (titulo, subtitulo, html) => {
    const div = document.createElement("div");
    div.className = "pdf-page-v10";
    div.innerHTML = `
      <div class="pdf-v10-header"><div><h1>${titulo}</h1><p>${subtitulo}</p></div><span>Atletas Energisa</span></div>
      ${html}
      <div class="pdf-v10-footer">Gerado em ${new Date().toLocaleDateString('pt-BR')} · Report Oficial</div>
    `;
    root.appendChild(div);
  };

  pagina("Report Oficial", "Resumo executivo do programa", `
    <div class="pdf-v10-kpis">
      ${kpiPdf("Atletas ativos", totalAtivos)}
      ${kpiPdf("Engajamento 30d", eng)}
      ${kpiPdf("Participações", analytics.participacoes)}
      ${kpiPdf("KM total", `${formatarKm(analytics.kmTotal)} km`)}
      ${kpiPdf("Custo realizado", custo.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}))}
      ${kpiPdf("Custo / atleta", (totalAtivos ? custo / totalAtivos : 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}))}
      ${kpiPdf("Custo / participação", (analytics.participacoes ? custo / analytics.participacoes : 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}))}
      ${kpiPdf("Custo / km", (analytics.kmTotal ? custo / analytics.kmTotal : 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}))}
    </div>
    <div class="pdf-v10-section"><h2>Leitura executiva</h2><ul>${montarAnalisesExecutivasReport(analytics)}</ul></div>
    <div class="pdf-v10-section"><h2>Ações recomendadas</h2>${alertas}</div>
  `);

  pagina("Evolução mensal", "Participações, pontos e KM no ano atual", `
    <div class="pdf-v10-section"><h2>Série mensal</h2>${chartImg ? `<img class="pdf-v10-chart" src="${chartImg}" />` : montarTabelaMensalPdf(monthly)}</div>
    <div class="pdf-v10-grid-3">
      ${kpiBoxPdf("Mês atual", document.getElementById("dashMesAtualResumo")?.textContent || "-")}
      ${kpiBoxPdf("Tendência", document.getElementById("dashTendencia3m")?.textContent || "-")}
      ${kpiBoxPdf("Melhor mês", melhorMes(monthly))}
    </div>
    <div class="pdf-v10-section"><h2>Resumo por mês</h2>${montarTabelaMensalPdf(monthly)}</div>
  `);

  pagina("Modalidades", "Comparativo de engajamento e performance", `
    <div class="pdf-v10-grid-2">
      ${modalidadePdf("Bike", stats.bike)}
      ${modalidadePdf("Corrida", stats.corrida)}
    </div>
    <div class="pdf-v10-section"><h2>Interpretação</h2><ul>
      <li>Bike: ${stats.bike.total} atletas, ${stats.bike.engajamento}% de engajamento e ${formatarKm(stats.bike.km)} km.</li>
      <li>Corrida: ${stats.corrida.total} atletas, ${stats.corrida.engajamento}% de engajamento e ${formatarKm(stats.corrida.km)} km.</li>
      <li>Modalidade com maior volume de KM: ${analytics.modalidadeMaisKm}.</li>
    </ul></div>
  `);

  pagina("Gestão", "Pódios, alertas, lançamentos e agenda", `
    <div class="pdf-v10-grid-2">
      <div class="pdf-v10-section"><h2>Pódio Bike</h2><ul>${podioPdf(arrayAtletas, 'bike')}</ul></div>
      <div class="pdf-v10-section"><h2>Pódio Corrida</h2><ul>${podioPdf(arrayAtletas, 'corrida')}</ul></div>
    </div>
    <div class="pdf-v10-grid-2">
      <div class="pdf-v10-section"><h2>Radar de inatividade</h2><ul>${radarPdf(arrayAtletas)}</ul></div>
      <div class="pdf-v10-section"><h2>Próximos eventos</h2>${proximosEventosPdf()}</div>
    </div>
    <div class="pdf-v10-section"><h2>Últimos lançamentos</h2>${montarUltimosLancamentosReport()}</div>
  `);

  return root;
}

function kpiPdf(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}
function kpiBoxPdf(label, value) {
  return `<div class="pdf-v10-section small"><h2>${escapeHtml(label)}</h2><strong>${escapeHtml(value)}</strong></div>`;
}
function modalidadePdf(nome, s) {
  return `<div class="pdf-v10-section"><h2>${escapeHtml(nome)}</h2><div class="pdf-v10-metrics">
    ${kpiPdf("Atletas", s.total)}${kpiPdf("Ativos 30d", s.ativos30d)}${kpiPdf("Engajamento", `${s.engajamento}%`)}${kpiPdf("Pontos", s.pontos)}${kpiPdf("Participações", s.participacoes)}${kpiPdf("KM", `${formatarKm(s.km)} km`)}${kpiPdf("Média pts/atleta", s.mediaPts)}${kpiPdf("Top atleta", s.topAtleta)}
  </div></div>`;
}

function podioPdf(arrayAtletas, tipo) {
  const arr = arrayAtletas.filter(a => tipo === 'bike' ? (a.eq === 'Bicicleta' || a.eq === 'Bike') : a.eq === 'Corrida').sort((a,b) => b.pts - a.pts).slice(0,5);
  if (!arr.length) return "<li>Sem pontuação registrada.</li>";
  return arr.map((a,i) => `<li><span>${i+1}. ${escapeHtml(a.nome)}</span><strong>${Number(a.pts)||0} pts</strong></li>`).join("");
}

function radarPdf(arrayAtletas) {
  const arr = arrayAtletas.filter(a => a.diasAusente > 30).sort((a,b) => b.diasAusente - a.diasAusente).slice(0,8);
  if (!arr.length) return "<li>Nenhum alerta crítico.</li>";
  return arr.map(a => `<li><span>${escapeHtml(a.nome)}</span><strong>${a.diasAusente === 999 ? 'Nunca foi' : a.diasAusente + 'd'}</strong></li>`).join("");
}

function proximosEventosPdf() {
  const hoje = new Date().toISOString().split('T')[0];
  const lista = (appState.cacheEventos || []).filter(e => e.data >= hoje).sort((a,b) => String(a.data).localeCompare(String(b.data))).slice(0,6);
  if (!lista.length) return "<p>Nenhum evento agendado.</p>";
  return `<ul>${lista.map(e => `<li><span>${formatarData(e.data)} · ${escapeHtml(e.titulo || 'Evento')}</span><strong>${escapeHtml(e.modalidade || 'Ambas')}</strong></li>`).join("")}</ul>`;
}

function montarTabelaMensalPdf(monthly) {
  const labels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `<table class="pdf-v10-table"><thead><tr><th>Mês</th><th>Participações</th><th>Pontos</th><th>KM</th></tr></thead><tbody>${labels.map((m,i)=>`<tr><td>${m}</td><td>${monthly.participacoes[i]||0}</td><td>${monthly.pontos[i]||0}</td><td>${formatarKm(monthly.km[i]||0)}</td></tr>`).join('')}</tbody></table>`;
}
function melhorMes(monthly) {
  const labels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  let idx = 0; let val = -1;
  monthly.participacoes.forEach((v,i)=>{ if(v>val){val=v; idx=i;} });
  return val > 0 ? `${labels[idx]} · ${val} part.` : "Sem dados";
}

function montarAlertasReport(arrayAtletas, eventosPendentes, filaAguardando, regrasSemUso, analytics) {
  const atletasSemAtividade30d = arrayAtletas.filter(a => a.diasAusente > 30).length;
  const alertas = [
    { t: "Eventos sem lançamento", v: eventosPendentes },
    { t: "Atletas sem atividade 30d", v: atletasSemAtividade30d },
    { t: "Fila aguardando decisão", v: filaAguardando },
    { t: "Regras sem uso", v: regrasSemUso },
    { t: "Atletas sem histórico", v: analytics.semAtividade }
  ].filter(a => Number(a.v) > 0);
  if (!alertas.length) return "<p>Nenhuma ação crítica pendente no momento.</p>";
  return `<ul>${alertas.map(a=>`<li><span>${escapeHtml(a.t)}</span><strong>${a.v}</strong></li>`).join("")}</ul>`;
}

function atualizarPainelEstrategicoFinal(arrayAtletas, totalAtivosGerais, analyticsParam = null) {
  const analytics = analyticsParam || calcularAnalyticsReport(arrayAtletas);
  const eventosPendentes = contarEventosPendentesLancamento();
  const filaAguardando = Object.values(appState.mapAtletas || {}).filter(a => String(a.equipe || "").startsWith("Fila")).length;
  const regrasSemUso = contarRegrasSemUso();
  const atletasInativos30d = arrayAtletas.filter(a => a.diasAusente > 30).length;

  setTextDashboard("dashEventosPendentes", eventosPendentes);
  setTextDashboard("dashFilaAguardando", filaAguardando);

  const acoes = [
    { tipo: "warning", icon: "calendar-clock", titulo: "Eventos sem lançamento", desc: "Eventos realizados nos últimos 7 dias ainda não foram lançados.", valor: eventosPendentes },
    { tipo: "danger", icon: "alert-triangle", titulo: "Atletas sem atividade 30d", desc: "Priorize contato, justificativa ou reengajamento.", valor: atletasInativos30d },
    { tipo: "warning", icon: "arrow-up-down", titulo: "Fila aguardando decisão", desc: "Revise a ordem, recusas e movimentações pendentes.", valor: filaAguardando },
    { tipo: "warning", icon: "puzzle", titulo: "Regras sem uso", desc: "Regras cadastradas que ainda não apareceram no histórico.", valor: regrasSemUso },
    { tipo: "warning", icon: "user-round", titulo: "Atletas sem histórico", desc: "Atletas ativos que nunca tiveram participação registrada.", valor: analytics.semAtividade }
  ].filter(a => Number(a.valor) > 0);

  const container = document.getElementById("listaAcoesRecomendadas");
  if (container) {
    const cardAcoes = container.closest(".strategic-action-card");
    if (acoes.length === 0) {
      container.innerHTML = "";
      if (cardAcoes) cardAcoes.style.display = "none";
      return;
    }
    if (cardAcoes) cardAcoes.style.display = "block";
    container.innerHTML = acoes.map(a => `
      <div class="strategic-action-item ${a.tipo}">
        <div class="strategic-action-icon"><i data-lucide="${a.icon}"></i></div>
        <div><div class="strategic-action-title">${escapeHtml(a.titulo)}</div><div class="strategic-action-desc">${escapeHtml(a.desc)}</div></div>
        <div class="strategic-action-count">${a.valor}</div>
      </div>`).join("");
    atualizarIconesOutlineDashboard();
  }
}

function calcularSeriesMensais() {
  const anoAtual = new Date().getFullYear().toString();
  const pontos = Array(12).fill(0);
  const participacoes = Array(12).fill(0);
  const km = Array(12).fill(0);
  const vistos = new Set();

  (appState.historicoCompleto || []).forEach(h => {
    if (!h.dataTreino || !h.dataTreino.startsWith(anoAtual)) return;
    const m = parseInt(h.dataTreino.split("-")[1], 10);
    if (isNaN(m) || m < 1 || m > 12) return;
    const idx = m - 1;
    pontos[idx] += Number(h.pontos) || 0;
    const chave = `${h.atletaId}|${h.loteId || h.eventoId || `${h.dataTreino}|${h.descTreino}`}`;
    if (!vistos.has(chave)) {
      vistos.add(chave);
      participacoes[idx] += 1;
      km[idx] += Number(h.kmPercorrido || h.km || 0);
    }
  });
  return { pontos, participacoes, km };
}

function calcularStatsModalidades(arrayAtletas, ptsBikeParam, ptsCorridaParam, totalBikeParam, totalCorridaParam) {
  const base = (nome) => {
    const atletas = arrayAtletas.filter(a => nome === 'bike' ? (a.eq === 'Bicicleta' || a.eq === 'Bike') : a.eq === 'Corrida');
    const total = atletas.length;
    const ativos30d = atletas.filter(a => a.diasAusente <= 30 && a.diasAusente !== -1).length;
    const pontos = atletas.reduce((s,a)=>s+(Number(a.pts)||0),0);
    const top = atletas.slice().sort((a,b)=>(Number(b.pts)||0)-(Number(a.pts)||0))[0];
    const ids = new Set(atletas.map(a=>a.id));
    const vistos = new Set();
    let km = 0, participacoes = 0;
    (appState.historicoCompleto || []).forEach(h => {
      if (!ids.has(h.atletaId)) return;
      const chave = `${h.atletaId}|${h.loteId || h.eventoId || `${h.dataTreino || ''}|${h.descTreino || ''}`}`;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      participacoes++;
      km += Number(h.kmPercorrido || h.km || 0);
    });
    return {
      total,
      ativos30d,
      inativos30d: Math.max(0, total - ativos30d),
      engajamento: total ? Math.round((ativos30d / total) * 100) : 0,
      pontos,
      mediaPts: total ? Math.round(pontos / total) : 0,
      participacoes,
      km,
      topAtleta: top ? top.nome : "-"
    };
  };
  return { bike: base('bike'), corrida: base('corrida') };
}

function calcularAnalyticsReport(arrayAtletasParam = null) {
  const historico = appState.historicoCompleto || [];
  const atletasMap = appState.mapAtletas || {};
  const atletas = Object.values(atletasMap).filter(a => a.status === "Aprovado" && a.role === "atleta" && !String(a.equipe || '').startsWith('Fila'));
  const ativos = atletas.filter(a => a.ativo !== false);
  const vistos = new Set();
  const atletasComAtividade = new Set();
  let kmTotal = 0, kmBike = 0, kmCorrida = 0, participacoes = 0, pontosTotal = 0;

  historico.forEach(h => {
    pontosTotal += Number(h.pontos) || 0;
    if (!h.atletaId) return;
    const chave = `${h.atletaId}|${h.loteId || h.eventoId || `${h.dataTreino || ''}|${h.descTreino || ''}`}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    participacoes++;
    atletasComAtividade.add(h.atletaId);
    const kmH = Number(h.kmPercorrido || h.km || 0);
    if (kmH > 0) {
      kmTotal += kmH;
      const eq = atletasMap[h.atletaId]?.equipe || h.atletaEquipe || "";
      if (eq === "Corrida") kmCorrida += kmH;
      if (eq === "Bicicleta" || eq === "Bike") kmBike += kmH;
    }
  });

  const semAtividade = ativos.filter(a => !atletasComAtividade.has(a.id)).length;
  const mediaKmPorAtleta = ativos.length ? kmTotal / ativos.length : 0;
  const mediaPontosPorParticipacao = participacoes ? pontosTotal / participacoes : 0;
  const modalidadeMaisKm = kmBike > kmCorrida ? "Bike" : (kmCorrida > kmBike ? "Corrida" : "Equilibrado");
  return { kmTotal, kmBike, kmCorrida, participacoes, ativos: ativos.length, semAtividade, mediaKmPorAtleta, mediaPontosPorParticipacao, modalidadeMaisKm };
}

function contarEventosPendentesLancamento() {
  const historico = appState.historicoCompleto || [];
  const eventosLancados = new Set(historico.filter(h => h.eventoId).map(h => h.eventoId));
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const limite = new Date(hoje); limite.setDate(limite.getDate() - 7);
  return (appState.cacheEventos || []).filter(e => {
    if (!e.id || !e.data || eventosLancados.has(e.id)) return false;
    const d = new Date(e.data + "T00:00:00"); d.setHours(0,0,0,0);
    return d < hoje && d >= limite;
  }).length;
}

function contarRegrasSemUso() {
  const usadas = new Set((appState.historicoCompleto || []).map(h => h.regraId).filter(Boolean));
  const regras = appState.listaTodasRegras || [];
  return regras.filter(r => r.id && !usadas.has(r.id)).length;
}

function montarAnalisesExecutivasReport(analytics) {
  const eng = document.getElementById("engajamento30d")?.textContent || "0%";
  const linhas = [
    `Engajamento recente em ${eng}, considerando atletas com atividade nos últimos 30 dias.`,
    `Foram registradas ${analytics.participacoes} participações e ${formatarKm(analytics.kmTotal)} km acumulados no histórico analisado.`,
    `Média de ${formatarKm(analytics.mediaKmPorAtleta)} km por atleta ativo e ${formatarKm(analytics.mediaPontosPorParticipacao)} pontos por participação.`,
    analytics.semAtividade > 0 ? `${analytics.semAtividade} atleta(s) ativo(s) ainda não possuem participação registrada.` : `Todos os atletas ativos possuem ao menos uma participação registrada.`,
    `Modalidade com maior volume de KM: ${analytics.modalidadeMaisKm}.`
  ];
  return linhas.map(l => `<li>${escapeHtml(l)}</li>`).join("");
}

function montarUltimosLancamentosReport() {
  const grupos = {};
  (appState.historicoCompleto || []).forEach(h => {
    if (!h.dataTreino || !h.descTreino) return;
    const key = h.loteId || `${h.dataTreino}::${h.descTreino}`;
    if (!grupos[key]) grupos[key] = { data: h.dataTreino, desc: h.tituloLancamento || h.descTreino, atletas: new Set(), pontos: 0, km: 0, vistosKm: new Set() };
    grupos[key].atletas.add(h.atletaId);
    grupos[key].pontos += Number(h.pontos) || 0;
    const kmKey = `${h.atletaId}|${key}`;
    if (!grupos[key].vistosKm.has(kmKey)) {
      grupos[key].vistosKm.add(kmKey);
      grupos[key].km += Number(h.kmPercorrido || h.km || 0);
    }
  });
  const lista = Object.values(grupos).sort((a,b)=>new Date(b.data||"1970-01-01")-new Date(a.data||"1970-01-01")).slice(0,8);
  if (!lista.length) return "<p>Nenhum lançamento processado.</p>";
  return `<ul>${lista.map(e => `<li><span>${formatarData(e.data)} · ${escapeHtml(e.desc)}</span><strong>${e.atletas.size} atletas · ${e.pontos} pts · ${formatarKm(e.km)} km</strong></li>`).join("")}</ul>`;
}

function setTextDashboard(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
function setHtmlDashboard(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function aguardar(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function formatarKm(valor) { const n = Number(valor) || 0; return n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 }); }
function formatarData(dataStr) { if (!dataStr) return "-"; try { return new Date(dataStr + "T00:00:00").toLocaleDateString('pt-BR'); } catch { return dataStr; } }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
