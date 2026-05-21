// js/modules/dashboard.js
import { appState } from './state.js';
import { showToast } from './ui.js';

export function setupDashboard() {
  document.getElementById("btnExportarPDF")?.addEventListener("click", exportarPDFExecutivo);
}

export function renderGraficosETop(ptsBike, ptsCorrida, arrayAtletas, totalBike, totalCorrida) {
  const hoje = new Date(); 
  const limite30d = new Date(); limite30d.setDate(limite30d.getDate() - 30); 
  let engajados30d = 0; let totalPontosGlobal = 0;
  
  arrayAtletas.forEach(a => { 
    totalPontosGlobal += a.pts; 
    if (a.ativo !== false) { 
      const lastEntry = appState.historicoCompleto.find(h => h.atletaId === a.id && Number(h.pontos) > 0); 
      if (lastEntry && lastEntry.dataTreino) { 
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
  
  if(document.getElementById("mediaBike")) document.getElementById("mediaBike").textContent = totalBike > 0 ? Math.round(ptsBike / totalBike) : 0; 
  if(document.getElementById("mediaCorrida")) document.getElementById("mediaCorrida").textContent = totalCorrida > 0 ? Math.round(ptsCorrida / totalCorrida) : 0;
  
  const htmlPodio = (arr) => { 
    if(arr.length===0) return "<li style='color:#999; font-size:0.85rem;'>Sem pontos</li>"; 
    return arr.map((a,i) => `<li style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--border);"><span style="display:flex; align-items:center; gap:5px; flex: 1; min-width: 0; margin-right: 10px;"><span style="font-size:0.85rem; flex-shrink: 0;">${i===0?'🥇':i===1?'🥈':'🥉'}</span><strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.85rem;" title="${a.nome}">${a.nome}</strong></span><strong style="font-size:0.85rem; flex-shrink: 0;">${a.pts}</strong></li>`).join(''); 
  };
  
  const bikeAtletas = arrayAtletas.filter(a => a.eq === 'Bicicleta' || a.eq === 'Bike').sort((a,b) => b.pts - a.pts).slice(0,3); 
  const corridaAtletas = arrayAtletas.filter(a => a.eq === 'Corrida').sort((a,b) => b.pts - a.pts).slice(0,3);
  
  if(document.getElementById("listaPodioBike")) document.getElementById("listaPodioBike").innerHTML = htmlPodio(bikeAtletas); 
  if(document.getElementById("listaPodioCorrida")) document.getElementById("listaPodioCorrida").innerHTML = htmlPodio(corridaAtletas);
  
  const radarBike = arrayAtletas.filter(a => a.diasAusente > 30 && (a.eq === 'Bicicleta' || a.eq === 'Bike')).sort((a,b) => b.diasAusente - a.diasAusente).slice(0, 5); 
  const radarCorrida = arrayAtletas.filter(a => a.diasAusente > 30 && a.eq === 'Corrida').sort((a,b) => b.diasAusente - a.diasAusente).slice(0, 5);
  
  const htmlEvasao = (arr) => { 
    if(arr.length===0) return "<li style='color:var(--secondary); font-size:0.8rem;'>Nenhum alerta.</li>"; 
    return arr.map(a => `<li style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px dashed var(--danger);"><span style="display:flex; align-items:center; gap:5px; flex: 1; min-width: 0; margin-right: 10px;"><span style="color:var(--danger); font-size:0.8rem; flex-shrink:0;">⚠️</span><strong style="color:var(--danger); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.8rem;" title="${a.nome}">${a.nome}</strong></span><small style="color:#999; font-weight:600; font-size:0.75rem; flex-shrink:0;">${a.diasAusente === 999 ? 'Nunca foi' : a.diasAusente + 'd'}</small></li>`).join(''); 
  };
  
  if(document.getElementById("listaEvasaoBike")) document.getElementById("listaEvasaoBike").innerHTML = htmlEvasao(radarBike); 
  if(document.getElementById("listaEvasaoCorrida")) document.getElementById("listaEvasaoCorrida").innerHTML = htmlEvasao(radarCorrida);
  
  const totalAtivosGerais = arrayAtletas.filter(a => a.ativo !== false).length;
  
  if(document.getElementById("totalAtivosGeral")) document.getElementById("totalAtivosGeral").textContent = totalAtivosGerais; 
  if(document.getElementById("engajamento30d")) document.getElementById("engajamento30d").textContent = (totalAtivosGerais > 0 ? Math.round((engajados30d / totalAtivosGerais)*100) : 0) + "%"; 
  if(document.getElementById("roiAtleta")) document.getElementById("roiAtleta").textContent = (totalAtivosGerais > 0 ? (appState.gastoTotalGlobal / totalAtivosGerais) : 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); 

  atualizarPainelEstrategicoFinal(arrayAtletas, totalAtivosGerais);
  
  let ativosBikeG = arrayAtletas.filter(a => (a.eq === 'Bicicleta' || a.eq === 'Bike') && a.diasAusente <= 30 && a.diasAusente !== -1).length; 
  let ativosCorridaG = arrayAtletas.filter(a => a.eq === 'Corrida' && a.diasAusente <= 30 && a.diasAusente !== -1).length;
  
  if(document.getElementById('txtAtivosBike')) document.getElementById('txtAtivosBike').textContent = totalBike === 0 ? "0% ativos (30d)" : `${Math.round((ativosBikeG/totalBike)*100)}% ativos (30d)`; 
  if(document.getElementById('txtAtivosCorrida')) document.getElementById('txtAtivosCorrida').textContent = totalCorrida === 0 ? "0% ativos (30d)" : `${Math.round((ativosCorridaG/totalCorrida)*100)}% ativos (30d)`;
  
  // Destruir gráficos antigos antes de criar novos
  if(document.getElementById('graficoEngajBike')) { 
    if(appState.graficoEngajBike) appState.graficoEngajBike.destroy(); 
    appState.graficoEngajBike = new Chart(document.getElementById('graficoEngajBike'), { 
      type: 'doughnut', 
      data: { datasets: [{ data: [ativosBikeG, (totalBike - ativosBikeG)], backgroundColor: ['#009bc1', '#e3e6eb'], borderWidth: 0 }] }, 
      options: { cutout: '75%', plugins: { tooltip:{enabled:false} } } 
    }); 
  }
  
  if(document.getElementById('graficoEngajCorrida')) { 
    if(appState.graficoEngajCorrida) appState.graficoEngajCorrida.destroy(); 
    appState.graficoEngajCorrida = new Chart(document.getElementById('graficoEngajCorrida'), { 
      type: 'doughnut', 
      data: { datasets: [{ data: [ativosCorridaG, (totalCorrida - ativosCorridaG)], backgroundColor: ['#00b37e', '#e3e6eb'], borderWidth: 0 }] }, 
      options: { cutout: '75%', plugins: { tooltip:{enabled:false} } } 
    }); 
  }
  
  if(document.getElementById('graficoTendencia')) { 
    if(appState.graficoLinhaInstancia) appState.graficoLinhaInstancia.destroy(); 
    const anoAtual = new Date().getFullYear().toString(); 
    let ptsPorMes = [0,0,0,0,0,0,0,0,0,0,0,0]; 
    appState.historicoCompleto.forEach(h => { 
      if(h.dataTreino && h.dataTreino.startsWith(anoAtual)) { 
        const m = parseInt(h.dataTreino.split("-")[1], 10); 
        if(!isNaN(m) && m >= 1 && m <= 12) ptsPorMes[m - 1] += (Number(h.pontos) || 0); 
      } 
    }); 
    appState.graficoLinhaInstancia = new Chart(document.getElementById('graficoTendencia'), { 
      type: 'line', 
      data: { 
        labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'], 
        datasets: [{ data: ptsPorMes, borderColor: '#009bc1', backgroundColor: 'rgba(0,155,193,0.1)', fill: true, tension: 0.4 }] 
      }, 
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } 
    }); 
  }
}

async function exportarPDFExecutivo() {
  const temaAtual = document.body.getAttribute("data-theme");
  if (temaAtual === "dark") document.body.removeAttribute("data-theme");

  showToast("Montando report oficial A4...", "info");

  const canvasLinha = document.getElementById('graficoTendencia');
  let widthOriginal, heightOriginal;

  try {
    preencherDadosReportA4();

    if (canvasLinha) {
      widthOriginal = canvasLinha.style.width;
      heightOriginal = canvasLinha.style.height;
      canvasLinha.style.width = '620px';
      canvasLinha.style.height = '190px';
      if (appState.graficoLinhaInstancia) appState.graficoLinhaInstancia.resize();

      const pdfImg = document.getElementById('pdfImgTendencia');
      if (pdfImg) pdfImg.src = canvasLinha.toDataURL("image/png", 1.0);
    }

    const modalPdf = document.getElementById("pdfOverlay");
    const printArea = document.getElementById("pdfPrintArea");
    if (!modalPdf || !printArea) return showToast("Área do report não encontrada.", "error");

    modalPdf.style.display = "flex";
    await aguardar(300);

    await garantirBibliotecasPDF();

    if (typeof html2canvas === "undefined" || !window.jspdf?.jsPDF) {
      modalPdf.style.display = "none";
      return showToast("Bibliotecas de PDF não carregadas. Verifique a conexão com a internet ou bloqueio dos CDNs.", "error");
    }

    const txtDataHoje = document.getElementById("pdfDataHoje")?.textContent || "report";
    const exportRoot = prepararPaginasA4ParaExportacao(printArea);
    document.body.appendChild(exportRoot);
    await aguardar(250);

    const pageWidth = 794;
    const pageHeight = 1123;
    const paginas = Array.from(exportRoot.querySelectorAll(".pdf-export-page"));
    const pdf = new window.jspdf.jsPDF("p", "pt", [pageWidth, pageHeight]);

    for (let i = 0; i < paginas.length; i++) {
      const page = paginas[i];
      const canvas = await html2canvas(page, {
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

    pdf.save(`Report_Atletas_${txtDataHoje.replace(/\//g, '-')}.pdf`);
    exportRoot.remove();
    modalPdf.style.display = "none";
    showToast("Download concluído!", "success");
  } catch (err) {
    console.error("Erro ao exportar PDF:", err);
    document.getElementById("pdfExportClone")?.remove();
    const modalPdf = document.getElementById("pdfOverlay");
    if (modalPdf) modalPdf.style.display = "none";
    showToast("Erro ao exportar o report.", "error");
  } finally {
    if (canvasLinha) {
      canvasLinha.style.width = widthOriginal || "";
      canvasLinha.style.height = heightOriginal || "";
      if (appState.graficoLinhaInstancia) appState.graficoLinhaInstancia.resize();
    }

    if (temaAtual === "dark") {
      document.body.setAttribute("data-theme", "dark");
      Chart.defaults.color = '#aaa';
      if (appState.graficoLinhaInstancia) appState.graficoLinhaInstancia.update();
    }
  }
}

async function garantirBibliotecasPDF() {
  const carregarScript = (src) => new Promise((resolve, reject) => {
    const existente = document.querySelector(`script[src="${src}"]`);
    if (existente) {
      existente.addEventListener("load", resolve, { once: true });
      existente.addEventListener("error", reject, { once: true });
      if (existente.dataset.loaded === "true") resolve();
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

  if (typeof html2canvas === "undefined") {
    promessas.push(carregarScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"));
  }

  if (!window.jspdf?.jsPDF) {
    promessas.push(carregarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"));
  }

  if (promessas.length > 0) {
    await Promise.all(promessas);
    await aguardar(150);
  }
}


function aplicarQuebrasInteligentesNoReport(clone, pageHeight = 1123) {
  const safeBottom = 64;
  const candidatos = Array.from(clone.children).filter(el => {
    return !el.classList.contains("pdf-page-spacer") && el.offsetHeight > 0;
  });

  candidatos.forEach(el => {
    const top = el.offsetTop;
    const height = el.offsetHeight;
    const posNaPagina = top % pageHeight;
    const limite = pageHeight - safeBottom;

    if (posNaPagina > 0 && posNaPagina + height > limite && height < (pageHeight - 120)) {
      const spacer = document.createElement("div");
      spacer.className = "pdf-page-spacer";
      spacer.style.height = `${pageHeight - posNaPagina}px`;
      spacer.style.width = "100%";
      spacer.style.background = "#ffffff";
      spacer.style.border = "0";
      spacer.style.margin = "0";
      spacer.style.padding = "0";
      el.parentNode.insertBefore(spacer, el);
    }
  });
}


function prepararPaginasA4ParaExportacao(printArea) {
  const pageWidth = 794;
  const pageHeight = 1123;
  const paddingX = 42;
  const paddingY = 38;

  const root = document.createElement("div");
  root.id = "pdfExportClone";
  root.style.position = "absolute";
  root.style.left = "-9999px";
  root.style.top = "0";
  root.style.width = `${pageWidth}px`;
  root.style.background = "#ffffff";
  root.style.zIndex = "0";

  const criarPagina = () => {
    const page = document.createElement("div");
    page.className = "pdf-a4-report pdf-export-page";
    page.style.width = `${pageWidth}px`;
    page.style.height = `${pageHeight}px`;
    page.style.minHeight = `${pageHeight}px`;
    page.style.maxHeight = `${pageHeight}px`;
    page.style.padding = `${paddingY}px ${paddingX}px`;
    page.style.margin = "0 0 0 0";
    page.style.boxSizing = "border-box";
    page.style.background = "#ffffff";
    page.style.color = "#0f2d35";
    page.style.overflow = "hidden";
    page.style.display = "block";
    page.style.fontFamily = "'Poppins', Arial, sans-serif";
    root.appendChild(page);
    return page;
  };

  let paginaAtual = criarPagina();

  const filhos = Array.from(printArea.children).filter(el => {
    return el.offsetParent !== null || el.id || el.className;
  });

  filhos.forEach((original, index) => {
    const bloco = original.cloneNode(true);
    bloco.querySelectorAll("img").forEach(img => { img.crossOrigin = "anonymous"; });
    bloco.style.breakInside = "avoid";
    bloco.style.pageBreakInside = "avoid";

    paginaAtual.appendChild(bloco);

    const estourou = paginaAtual.scrollHeight > pageHeight;
    const temMaisDeUmBloco = paginaAtual.children.length > 1;

    if (estourou && temMaisDeUmBloco) {
      paginaAtual.removeChild(bloco);
      paginaAtual = criarPagina();
      paginaAtual.appendChild(bloco);
    }

    if (paginaAtual.scrollHeight > pageHeight && paginaAtual.children.length === 1) {
      bloco.style.transformOrigin = "top left";
      bloco.style.maxHeight = `${pageHeight - (paddingY * 2)}px`;
      bloco.style.overflow = "hidden";
    }
  });

  return root;
}

function prepararCloneA4ParaExportacao(printArea) {
  const clone = printArea.cloneNode(true);
  clone.id = "pdfExportClone";
  clone.classList.add("pdf-export-clone");

  clone.style.position = "absolute";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.width = "794px";
  clone.style.maxWidth = "794px";
  clone.style.minHeight = "1123px";
  clone.style.height = "auto";
  clone.style.margin = "0";
  clone.style.padding = "38px 42px";
  clone.style.boxSizing = "border-box";
  clone.style.background = "#ffffff";
  clone.style.color = "#0f2d35";
  clone.style.display = "block";
  clone.style.overflow = "visible";
  clone.style.zIndex = "0";

  clone.querySelectorAll("img").forEach(img => {
    img.crossOrigin = "anonymous";
  });

  return clone;
}

function preencherDadosReportA4() {
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const setHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };

  setText("pdfDataHoje", new Date().toLocaleDateString('pt-BR'));
  setText("pdfAtivos", document.getElementById("totalAtivosGeral")?.textContent || "0");
  setText("pdfEngajamento", document.getElementById("engajamento30d")?.textContent || "0%");
  setText("pdfInvest", document.getElementById("totalInvestimento")?.textContent || "R$ 0,00");
  setText("pdfRoi", document.getElementById("roiAtleta")?.textContent || "R$ 0,00");
  setText("pdfMediaBike", document.getElementById("mediaBike")?.textContent || "0");
  setText("pdfMediaCorrida", document.getElementById("mediaCorrida")?.textContent || "0");

  const analytics = calcularAnalyticsReport();
  setHtml("pdfAnalises", montarAnalisesExecutivasReport(analytics));
  setText("pdfKmTotal", `${formatarKm(analytics.kmTotal)} km`);
  setText("pdfKmBike", `${formatarKm(analytics.kmBike)} km`);
  setText("pdfKmCorrida", `${formatarKm(analytics.kmCorrida)} km`);
  setText("pdfParticipacoes", analytics.participacoes);

  setHtml("pdfTopBike", limparListaParaPdf(document.getElementById("listaPodioBike")?.innerHTML || ""));
  setHtml("pdfTopCorrida", limparListaParaPdf(document.getElementById("listaPodioCorrida")?.innerHTML || ""));
  setHtml("pdfListaEvasao", limparListaParaPdf((document.getElementById("listaEvasaoBike")?.innerHTML || "") + (document.getElementById("listaEvasaoCorrida")?.innerHTML || "")) || "<li>Nenhum alerta crítico.</li>");

  const elAgenda = document.getElementById("listaEventosAgenda");
  if(elAgenda) {
    const agendaClone = elAgenda.cloneNode(true);
    agendaClone.querySelectorAll("button").forEach(b => b.remove());
    setHtml("pdfProximosEventos", agendaClone.innerHTML || "<p>Nenhum evento agendado.</p>");
  }

  setHtml("pdfUltimosEventos", montarUltimosLancamentosReport());
}


function atualizarPainelEstrategicoFinal(arrayAtletas, totalAtivosGerais) {
  const analytics = calcularAnalyticsReport();
  const eventosPendentes = contarEventosPendentesLancamento();
  const filaAguardando = Object.values(appState.mapAtletas || {}).filter(a => String(a.equipe || "").startsWith("Fila")).length;
  const regrasSemUso = contarRegrasSemUso();
  const atletasInativos30d = arrayAtletas.filter(a => a.diasAusente > 30).length;
  const custo = Number(appState.gastoTotalGlobal) || 0;
  const custoParticipacao = analytics.participacoes ? custo / analytics.participacoes : 0;
  const custoKm = analytics.kmTotal ? custo / analytics.kmTotal : 0;

  setTextDashboard("dashKmTotal", `${formatarKm(analytics.kmTotal)} km`);
  setTextDashboard("dashParticipacoes", analytics.participacoes);
  setTextDashboard("dashCustoParticipacao", custoParticipacao.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}));
  setTextDashboard("dashCustoKm", custoKm.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}));
  setTextDashboard("dashEventosPendentes", eventosPendentes);
  setTextDashboard("dashFilaAguardando", filaAguardando);

  const acoes = [
    { tipo: "warning", icon: "📅", titulo: "Eventos sem lançamento", desc: "Eventos realizados nos últimos 7 dias ainda não foram lançados.", valor: eventosPendentes },
    { tipo: "danger", icon: "⚠️", titulo: "Atletas sem atividade 30d", desc: "Priorize contato, justificativa ou reengajamento.", valor: atletasInativos30d },
    { tipo: "warning", icon: "↕️", titulo: "Fila aguardando decisão", desc: "Revise a ordem, recusas e movimentações pendentes.", valor: filaAguardando },
    { tipo: "warning", icon: "🧩", titulo: "Regras sem uso", desc: "Regras cadastradas que ainda não apareceram no histórico.", valor: regrasSemUso },
    { tipo: "warning", icon: "👤", titulo: "Atletas sem histórico", desc: "Atletas ativos que nunca tiveram participação registrada.", valor: analytics.semAtividade }
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
        <div class="strategic-action-icon">${a.icon}</div>
        <div>
          <div class="strategic-action-title">${escapeHtml(a.titulo)}</div>
          <div class="strategic-action-desc">${escapeHtml(a.desc)}</div>
        </div>
        <div class="strategic-action-count">${a.valor}</div>
      </div>
    `).join("");
  }
}

function setTextDashboard(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
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

function aguardar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calcularAnalyticsReport() {
  const historico = appState.historicoCompleto || [];
  const atletasMap = appState.mapAtletas || {};
  const atletas = Object.values(atletasMap).filter(a => a.status === "Aprovado" && a.role === "atleta");
  const ativos = atletas.filter(a => a.ativo !== false);
  const vistos = new Set();
  const atletasComAtividade = new Set();
  let kmTotal = 0;
  let kmBike = 0;
  let kmCorrida = 0;
  let participacoes = 0;
  let pontosTotal = 0;

  historico.forEach(h => {
    pontosTotal += Number(h.pontos) || 0;
    if (!h.atletaId) return;
    const chave = `${h.atletaId}|${h.loteId || h.eventoId || `${h.dataTreino || ''}|${h.descTreino || ''}`}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    participacoes++;
    atletasComAtividade.add(h.atletaId);

    const km = Number(h.kmPercorrido || h.km || 0);
    if (km > 0) {
      kmTotal += km;
      const eq = atletasMap[h.atletaId]?.equipe || h.atletaEquipe || "";
      if (eq === "Corrida") kmCorrida += km;
      if (eq === "Bicicleta" || eq === "Bike") kmBike += km;
    }
  });

  const semAtividade = ativos.filter(a => !atletasComAtividade.has(a.id)).length;
  const mediaKmPorAtleta = ativos.length ? kmTotal / ativos.length : 0;
  const mediaPontosPorParticipacao = participacoes ? pontosTotal / participacoes : 0;
  const modalidadeMaisKm = kmBike > kmCorrida ? "Bike" : (kmCorrida > kmBike ? "Corrida" : "Equilibrado");

  return { kmTotal, kmBike, kmCorrida, participacoes, ativos: ativos.length, semAtividade, mediaKmPorAtleta, mediaPontosPorParticipacao, modalidadeMaisKm };
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
    if(!h.dataTreino || !h.descTreino) return;
    const key = h.loteId || `${h.dataTreino}::${h.descTreino}`;
    if(!grupos[key]) grupos[key] = { data: h.dataTreino, desc: h.tituloLancamento || h.descTreino, atletas: new Set(), pontos: 0, km: 0, vistosKm: new Set() };
    grupos[key].atletas.add(h.atletaId);
    grupos[key].pontos += Number(h.pontos) || 0;
    const kmKey = `${h.atletaId}|${key}`;
    if(!grupos[key].vistosKm.has(kmKey)) {
      grupos[key].vistosKm.add(kmKey);
      grupos[key].km += Number(h.kmPercorrido || h.km || 0);
    }
  });

  const lista = Object.values(grupos)
    .sort((a,b) => new Date(b.data || "1970-01-01") - new Date(a.data || "1970-01-01"))
    .slice(0, 6);

  if(lista.length === 0) return "<p>Nenhum lançamento processado.</p>";

  return lista.map(e => {
    const d = new Date(e.data + "T00:00:00").toLocaleDateString('pt-BR').substring(0,5);
    return `<div style="display:flex; justify-content:space-between; gap:8px; border-bottom:1px solid #eef3f5; padding:5px 0;"><span><strong>${d}</strong> - ${escapeHtml(e.desc)}</span><strong>${e.atletas.size} atletas · ${e.pontos} pts · ${formatarKm(e.km)} km</strong></div>`;
  }).join("");
}

function limparListaParaPdf(html) {
  return String(html || "")
    .replaceAll('var(--border)', '#e5edf1')
    .replaceAll('var(--danger)', '#e63946')
    .replaceAll('var(--secondary)', '#00a693')
    .replaceAll('var(--primary)', '#009bc1')
    .replaceAll('var(--text-light)', '#607d8b');
}

function formatarKm(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
