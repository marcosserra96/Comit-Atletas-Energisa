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

function exportarPDFExecutivo() {
  showToast("Montando painel corporativo...", "info"); 
  
  const temaAtual = document.body.getAttribute("data-theme"); 
  if (temaAtual === "dark") { 
    document.body.removeAttribute("data-theme"); 
    Chart.defaults.color = '#666'; 
    if(appState.graficoLinhaInstancia) appState.graficoLinhaInstancia.update(); 
  }
  
  setTimeout(() => {
    const elDataHoje = document.getElementById("pdfDataHoje");
    if(elDataHoje) elDataHoje.textContent = new Date().toLocaleDateString('pt-BR'); 
    
    if(document.getElementById("pdfAtivos")) document.getElementById("pdfAtivos").textContent = document.getElementById("totalAtivosGeral")?.textContent || "0"; 
    if(document.getElementById("pdfEngajamento")) document.getElementById("pdfEngajamento").textContent = document.getElementById("engajamento30d")?.textContent || "0%"; 
    if(document.getElementById("pdfInvest")) document.getElementById("pdfInvest").textContent = document.getElementById("totalInvestimento")?.textContent || "R$ 0"; 
    if(document.getElementById("pdfRoi")) document.getElementById("pdfRoi").textContent = document.getElementById("roiAtleta")?.textContent || "R$ 0"; 
    
    if(document.getElementById("pdfMediaBike")) document.getElementById("pdfMediaBike").textContent = document.getElementById("mediaBike")?.textContent || "0"; 
    if(document.getElementById("pdfMediaCorrida")) document.getElementById("pdfMediaCorrida").textContent = document.getElementById("mediaCorrida")?.textContent || "0"; 
    
    if(document.getElementById("pdfTopBike")) document.getElementById("pdfTopBike").innerHTML = document.getElementById("listaPodioBike")?.innerHTML || ""; 
    if(document.getElementById("pdfTopCorrida")) document.getElementById("pdfTopCorrida").innerHTML = document.getElementById("listaPodioCorrida")?.innerHTML || ""; 
    
    if(document.getElementById("pdfListaEvasao")) {
      document.getElementById("pdfListaEvasao").innerHTML = (document.getElementById("listaEvasaoBike")?.innerHTML || "") + (document.getElementById("listaEvasaoCorrida")?.innerHTML || ""); 
    }
    
    const elAgenda = document.getElementById("listaEventosAgenda");
    if(elAgenda) {
      const agendaClone = elAgenda.cloneNode(true); 
      agendaClone.querySelectorAll("button").forEach(b => b.remove()); 
      if(document.getElementById("pdfProximosEventos")) document.getElementById("pdfProximosEventos").innerHTML = agendaClone.innerHTML;
    }
    
    const eventosPassados = {}; 
    appState.historicoCompleto.forEach(h => { 
      if(!h.dataTreino || !h.descTreino || h.descTreino.toLowerCase().includes("falta")) return; 
      const key = `${h.dataTreino}::${h.descTreino}`; 
      if(!eventosPassados[key]) eventosPassados[key] = { data: h.dataTreino, desc: h.descTreino, atletas: new Set() }; 
      eventosPassados[key].atletas.add(h.atletaId); 
    }); 
    
    const listaUltimos = Object.values(eventosPassados).sort((a,b) => new Date(b.data || "1970-01-01") - new Date(a.data || "1970-01-01")).slice(0, 4); 
    let htmlUltimos = ""; 
    listaUltimos.forEach(e => { 
      const d = new Date(e.data + "T00:00:00").toLocaleDateString('pt-BR').substring(0,5); 
      htmlUltimos += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; border-bottom:1px solid #f5f5f5; padding-bottom:4px;"><span style="color:#666;"><strong>${d}</strong> - ${e.desc}</span><strong style="color:var(--primary);">${e.atletas.size} 👤</strong></div>`; 
    }); 
    
    if(document.getElementById("pdfUltimosEventos")) {
      document.getElementById("pdfUltimosEventos").innerHTML = htmlUltimos || "<p style='color:#999; text-align:center;'>Nenhum evento processado.</p>";
    }
    
    const canvasLinha = document.getElementById('graficoTendencia'); 
    let widthOriginal, heightOriginal;
    
    if(canvasLinha) { 
      widthOriginal = canvasLinha.style.width; 
      heightOriginal = canvasLinha.style.height; 
      canvasLinha.style.width = '700px'; 
      canvasLinha.style.height = '200px'; 
      if(appState.graficoLinhaInstancia) appState.graficoLinhaInstancia.resize(); 
      const pdfImg = document.getElementById('pdfImgTendencia');
      if(pdfImg) pdfImg.src = canvasLinha.toDataURL("image/png", 1.0); 
    }
    
    const modalPdf = document.getElementById("pdfOverlay"); 
    const printArea = document.getElementById("pdfPrintArea"); 
    modalPdf.style.display = "flex";
    
    setTimeout(() => { 
      const txtDataHoje = document.getElementById("pdfDataHoje")?.textContent || "report";
      const opt = { 
        margin: 0, 
        filename: `Report_Atletas_${txtDataHoje.replace(/\//g, '-')}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } 
      }; 
      
      html2pdf().set(opt).from(printArea).save().then(() => { 
        modalPdf.style.display = "none"; 
        
        if(canvasLinha) { 
          canvasLinha.style.width = widthOriginal; 
          canvasLinha.style.height = heightOriginal; 
          if(appState.graficoLinhaInstancia) appState.graficoLinhaInstancia.resize(); 
        } 
        
        if (temaAtual === "dark") { 
          document.body.setAttribute("data-theme", "dark"); 
          Chart.defaults.color = '#aaa'; 
          if(appState.graficoLinhaInstancia) appState.graficoLinhaInstancia.update(); 
        } 
        showToast("Download Concluído!", "success"); 
      }); 
    }, 600);
  }, 150); 
}
