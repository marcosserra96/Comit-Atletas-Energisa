"use client";

import { consolidarAtividades, type AtividadeConsolidada } from "@/lib/activityConsolidation";
import type { HistoricoMensalDoc, HistoricoPontoDoc } from "@/lib/types";
export type { AtividadeConsolidada } from "@/lib/activityConsolidation";

export type PeriodoDesempenho = "6m" | "12m" | "ano";

export interface SerieMensalDesempenho {
  chave: string;
  rotulo: string;
  rotuloCurto: string;
  treinos: number;
  participacoes: number;
  pontos: number;
  km: number;
}

export interface PontosPorRegra {
  regra: string;
  pontos: number;
}

export interface AnaliseDesempenho {
  serieMensal: SerieMensalDesempenho[];
  atividades: AtividadeConsolidada[];
  lancamentosValidos: HistoricoPontoDoc[];
  /** Totais mensais da planilha antiga dentro do período, mais recentes primeiro. */
  resumosMensais: HistoricoMensalDoc[];
  totalTreinos: number;
  totalParticipacoes: number;
  totalPontos: number;
  totalKm: number;
  kmTreinos: number;
  mediaTreinosMes: number;
  mediaKmTreino: number;
  diasAtivos: number;
  semanasAtivas: number;
  totalSemanasPeriodo: number;
  regularidadePct: number;
  mesesAtivos: number;
  melhorMes: SerieMensalDesempenho | null;
  treinosMesAtual: number;
  treinosMesAnterior: number;
  variacaoTreinosPct: number | null;
  pontosPorRegra: PontosPorRegra[];
}

const formatoMes = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "2-digit",
});

const formatoMesLongo = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

function dataIsoLocal(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return ano + "-" + mes + "-" + dia;
}

function chaveMes(data: Date) {
  return data.getFullYear() + "-" + String(data.getMonth() + 1).padStart(2, "0");
}

function inicioDoMes(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

function adicionarMeses(data: Date, quantidade: number) {
  return new Date(data.getFullYear(), data.getMonth() + quantidade, 1);
}

function dataSegura(valor: string) {
  const data = new Date(valor + "T00:00:00");
  return Number.isNaN(data.getTime()) ? null : data;
}

function chaveSemana(valor: string) {
  const data = dataSegura(valor);
  if (!data) return "";
  const dia = data.getDay();
  const distanciaSegunda = dia === 0 ? -6 : 1 - dia;
  data.setDate(data.getDate() + distanciaSegunda);
  return dataIsoLocal(data);
}

export function obterInicioPeriodo(periodo: PeriodoDesempenho, hoje = new Date()) {
  if (periodo === "ano") {
    return dataIsoLocal(new Date(hoje.getFullYear(), 0, 1));
  }
  const quantidadeMeses = periodo === "6m" ? 6 : 12;
  return dataIsoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - quantidadeMeses + 1, 1));
}

function construirMeses(periodo: PeriodoDesempenho, hoje: Date) {
  const inicio =
    periodo === "ano"
      ? new Date(hoje.getFullYear(), 0, 1)
      : new Date(hoje.getFullYear(), hoje.getMonth() - (periodo === "6m" ? 5 : 11), 1);
  const fim = inicioDoMes(hoje);
  const meses: SerieMensalDesempenho[] = [];

  for (let cursor = inicio; cursor <= fim; cursor = adicionarMeses(cursor, 1)) {
    const rotuloBase = formatoMes.format(cursor).replace(".", "");
    meses.push({
      chave: chaveMes(cursor),
      rotulo: formatoMesLongo.format(cursor),
      rotuloCurto: rotuloBase,
      treinos: 0,
      participacoes: 0,
      pontos: 0,
      km: 0,
    });
  }
  return meses;
}

export function calcularDesempenhoAtleta(params: {
  lancamentos: HistoricoPontoDoc[];
  /** Totais mensais legados do atleta (sem dia de cada treino). */
  resumosMensais?: HistoricoMensalDoc[];
  periodo: PeriodoDesempenho;
  hoje?: Date;
}): AnaliseDesempenho {
  const hoje = params.hoje ?? new Date();
  const inicio = obterInicioPeriodo(params.periodo, hoje);
  const fim = dataIsoLocal(hoje);
  const lancamentosValidos = params.lancamentos.filter(
    (l) => !l.estornado && l.dataTreino >= inicio && l.dataTreino <= fim,
  );
  const atividades = consolidarAtividades(lancamentosValidos);
  const treinos = atividades.filter((a) => a.tipo === "treino");
  const serieMensal = construirMeses(params.periodo, hoje);
  const porMes = new Map(serieMensal.map((mes) => [mes.chave, mes]));

  for (const lancamento of lancamentosValidos) {
    const mes = porMes.get(lancamento.dataTreino.slice(0, 7));
    if (mes) mes.pontos += lancamento.pontos;
  }

  for (const atividade of atividades) {
    const mes = porMes.get(atividade.data.slice(0, 7));
    if (!mes) continue;
    mes.participacoes += 1;
    mes.km += atividade.km;
    if (atividade.tipo === "treino") mes.treinos += 1;
  }

  // Histórico mensal: soma nos meses e nos totais, como no Ranking. Fica fora
  // da regularidade semanal, porque não sabemos o dia de cada treino.
  const resumosMensais = (params.resumosMensais ?? [])
    .filter((r) => porMes.has(r.competencia))
    .sort((a, b) => b.competencia.localeCompare(a.competencia));
  let pontosResumos = 0;
  let kmResumos = 0;
  let treinosResumos = 0;
  for (const resumo of resumosMensais) {
    const mes = porMes.get(resumo.competencia)!;
    const pontos = resumo.pontos || 0;
    const km = resumo.km || 0;
    const qtd = resumo.treinos || 0;
    mes.pontos += pontos;
    mes.km += km;
    mes.treinos += qtd;
    mes.participacoes += qtd;
    pontosResumos += pontos;
    kmResumos += km;
    treinosResumos += qtd;
  }

  const totalPontos = lancamentosValidos.reduce((soma, l) => soma + l.pontos, 0) + pontosResumos;
  const totalKm = atividades.reduce((soma, atividade) => soma + atividade.km, 0) + kmResumos;
  const kmTreinos = treinos.reduce((soma, atividade) => soma + atividade.km, 0) + kmResumos;
  const totalTreinos = treinos.length + treinosResumos;
  const diasAtivos = new Set(treinos.map((treino) => treino.data)).size;
  const semanasAtivas = new Set(treinos.map((treino) => chaveSemana(treino.data)).filter(Boolean)).size;

  const inicioData = dataSegura(inicio) ?? hoje;
  const totalSemanasPeriodo = Math.max(
    1,
    Math.ceil((hoje.getTime() - inicioData.getTime() + 86400000) / (7 * 86400000)),
  );
  const mesesAtivos = serieMensal.filter((mes) => mes.treinos > 0).length;
  const melhorMes =
    [...serieMensal]
      .filter((mes) => mes.treinos > 0)
      .sort((a, b) => b.treinos - a.treinos || b.pontos - a.pontos)[0] ?? null;

  const mesAtual = serieMensal.at(-1);
  const mesAnterior = serieMensal.at(-2);
  const treinosMesAtual = mesAtual?.treinos ?? 0;
  const treinosMesAnterior = mesAnterior?.treinos ?? 0;
  const variacaoTreinosPct =
    treinosMesAnterior > 0
      ? Math.round(((treinosMesAtual - treinosMesAnterior) / treinosMesAnterior) * 100)
      : null;

  const pontosPorRegraMap = new Map<string, number>();
  for (const lancamento of lancamentosValidos) {
    const regra = lancamento.regraDesc || "Sem critério";
    pontosPorRegraMap.set(regra, (pontosPorRegraMap.get(regra) ?? 0) + lancamento.pontos);
  }
  if (pontosResumos !== 0) {
    pontosPorRegraMap.set("Histórico mensal", (pontosPorRegraMap.get("Histórico mensal") ?? 0) + pontosResumos);
  }
  const pontosPorRegra = [...pontosPorRegraMap.entries()]
    .map(([regra, pontos]) => ({ regra, pontos }))
    .filter((item) => item.pontos !== 0)
    .sort((a, b) => Math.abs(b.pontos) - Math.abs(a.pontos));

  return {
    serieMensal,
    atividades,
    lancamentosValidos,
    resumosMensais,
    totalTreinos,
    totalParticipacoes: atividades.length + treinosResumos,
    totalPontos,
    totalKm,
    kmTreinos,
    mediaTreinosMes: serieMensal.length > 0 ? totalTreinos / serieMensal.length : 0,
    mediaKmTreino: totalTreinos > 0 ? kmTreinos / totalTreinos : 0,
    diasAtivos,
    semanasAtivas,
    totalSemanasPeriodo,
    regularidadePct: Math.min(100, Math.round((semanasAtivas / totalSemanasPeriodo) * 100)),
    mesesAtivos,
    melhorMes,
    treinosMesAtual,
    treinosMesAnterior,
    variacaoTreinosPct,
    pontosPorRegra,
  };
}
