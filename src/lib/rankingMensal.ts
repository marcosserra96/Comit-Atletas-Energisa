import { consolidarAtividades, type RegrasDeTreino } from "@/lib/activityConsolidation";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import type { AlertaCriterio, AtletaDoc, Equipe, HistoricoMensalDoc, HistoricoPontoDoc } from "@/lib/types";

export interface ResumoAtletaMensal {
  id: string;
  nome: string;
  equipe: Equipe;
  pontosMes: number;
  kmMes: number;
  treinosMes: number;
  ultimaData: string;
}

/** Ranking mensal (só atletas ativos) a partir do histórico completo, filtrado para o mês de referência. */
export function calcularResumoRankingMensal(params: {
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
  resumosMensais?: HistoricoMensalDoc[];
  ano: number;
  mes: number;
  regrasTreino?: RegrasDeTreino;
}): ResumoAtletaMensal[] {
  const { atletas, lancamentos, resumosMensais = [], ano, mes, regrasTreino } = params;
  const competencia = `${ano}-${String(mes).padStart(2, "0")}`;
  return calcularResumoRankingPeriodo({ atletas, lancamentos, resumosMensais, de: competencia, ate: competencia, regrasTreino });
}

/**
 * Ranking acumulado de um período de meses (inclusive nas duas pontas).
 * `de` e `ate` no formato "YYYY-MM" — os campos do resumo continuam com sufixo
 * "Mes" por compatibilidade, mas representam o total do período pedido.
 */
export function calcularResumoRankingPeriodo(params: {
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
  resumosMensais?: HistoricoMensalDoc[];
  de: string;
  ate: string;
  /** Critérios que contam como treino mesmo lançados como Avulso. */
  regrasTreino?: RegrasDeTreino;
}): ResumoAtletaMensal[] {
  const { atletas, lancamentos, resumosMensais = [] } = params;
  const de = params.de <= params.ate ? params.de : params.ate;
  const ate = params.de <= params.ate ? params.ate : params.de;

  const porAtleta = new Map<string, ResumoAtletaMensal>();
  for (const a of atletas) {
    if (!a.ativo || !perfilAtletaVisivel(a)) continue;
    porAtleta.set(a.id, { id: a.id, nome: a.nome, equipe: a.equipe, pontosMes: 0, kmMes: 0, treinosMes: 0, ultimaData: "" });
  }

  const lancamentosDoPeriodo: HistoricoPontoDoc[] = [];

  for (const lancamento of lancamentos) {
    if (lancamento.estornado) continue;
    const item = porAtleta.get(lancamento.atletaId);
    if (!item) continue;
    if (lancamento.dataTreino && lancamento.dataTreino > item.ultimaData) {
      item.ultimaData = lancamento.dataTreino;
    }

    const competencia = lancamento.dataTreino.slice(0, 7);
    if (competencia < de || competencia > ate) continue;

    item.pontosMes += lancamento.pontos;
    lancamentosDoPeriodo.push(lancamento);
  }

  for (const atividade of consolidarAtividades(lancamentosDoPeriodo, params.regrasTreino)) {
    const item = porAtleta.get(atividade.atletaId);
    if (!item) continue;
    item.kmMes += atividade.km;
    if (atividade.tipo === "treino") item.treinosMes += 1;
  }

  // Totais mensais legados entram como complemento do histórico detalhado.
  // Não alteram ultimaData porque não conhecemos o dia real de cada treino.
  for (const resumo of resumosMensais) {
    if (resumo.competencia < de || resumo.competencia > ate) continue;
    const item = porAtleta.get(resumo.atletaId);
    if (!item) continue;
    item.pontosMes += resumo.pontos || 0;
    item.kmMes += resumo.km || 0;
    item.treinosMes += resumo.treinos || 0;
  }

  return [...porAtleta.values()].sort(ordenarRankingMensal);
}

export function ordenarRankingMensal(a: ResumoAtletaMensal, b: ResumoAtletaMensal) {
  return (
    b.pontosMes - a.pontosMes ||
    a.nome.localeCompare(b.nome, "pt-BR")
  );
}

export function atletaEstaEmAlerta(atleta: ResumoAtletaMensal, criterio: AlertaCriterio, valor: number): boolean {
  if (criterio === "ate_x_treinos") return atleta.treinosMes <= valor;
  if (criterio === "ate_x_pontos") return atleta.pontosMes <= valor;
  if (criterio === "sem_treino_30d") {
    if (!atleta.ultimaData) return true;
    const ultima = new Date(`${atleta.ultimaData}T00:00:00`);
    if (Number.isNaN(ultima.getTime())) return true;
    const diffDias = Math.floor((Date.now() - ultima.getTime()) / 86400000);
    return diffDias > valor;
  }
  return atleta.treinosMes <= 0;
}

export function diasUteisNoMes(ano: number, mes: number): number {
  let count = 0;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const diaSemana = new Date(ano, mes - 1, dia).getDay();
    if (diaSemana !== 0 && diaSemana !== 6) count++;
  }
  return count;
}
