import { consolidarAtividades } from "@/lib/activityConsolidation";
import { dataIsoLocal } from "@/lib/date";
import type { HistoricoMensalDoc, HistoricoPontoDoc, Modalidade } from "@/lib/types";

/** 0 = domingo … 6 = sábado (igual a `Date.getDay()`). */
export type DiaDaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AgendaTreinoModalidade {
  /** Dias da semana com treino oficial. Vazio = modalidade sem agenda (aderência não é calculada). */
  dias: DiaDaSemana[];
  /** Primeiro dia (YYYY-MM-DD) em que essa agenda vale. Antes disso não há treino previsto. */
  desde?: string | null;
}

/** Documento `configuracoes/dias_treino`. */
export interface DiasTreinoConfigDoc {
  corrida: AgendaTreinoModalidade;
  bicicleta: AgendaTreinoModalidade;
  /** Datas (YYYY-MM-DD) sem treino para todos: feriados, cancelamentos por chuva etc. */
  semTreino: string[];
  atualizadoEm?: unknown;
  atualizadoPorNome?: string;
}

export const DIAS_TREINO_PADRAO: DiasTreinoConfigDoc = {
  corrida: { dias: [], desde: null },
  bicicleta: { dias: [], desde: null },
  semTreino: [],
};

export const NOMES_DIAS: Record<DiaDaSemana, { curto: string; longo: string }> = {
  0: { curto: "Dom", longo: "Domingo" },
  1: { curto: "Seg", longo: "Segunda" },
  2: { curto: "Ter", longo: "Terça" },
  3: { curto: "Qua", longo: "Quarta" },
  4: { curto: "Qui", longo: "Quinta" },
  5: { curto: "Sex", longo: "Sexta" },
  6: { curto: "Sáb", longo: "Sábado" },
};

/** Segunda primeiro, como no calendário de treinos. */
export const ORDEM_DIAS: DiaDaSemana[] = [1, 2, 3, 4, 5, 6, 0];

export function normalizarDiasTreino(valor?: Partial<DiasTreinoConfigDoc> | null): DiasTreinoConfigDoc {
  const agenda = (a?: Partial<AgendaTreinoModalidade>): AgendaTreinoModalidade => ({
    dias: [...new Set((a?.dias ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() as DiaDaSemana[],
    desde: a?.desde || null,
  });
  return {
    corrida: agenda(valor?.corrida),
    bicicleta: agenda(valor?.bicicleta),
    semTreino: [...new Set(valor?.semTreino ?? [])].sort(),
    atualizadoEm: valor?.atualizadoEm,
    atualizadoPorNome: valor?.atualizadoPorNome,
  };
}

/** "Ter, Qui e Sáb" */
export function descreverDias(dias: DiaDaSemana[]) {
  const nomes = ORDEM_DIAS.filter((d) => dias.includes(d)).map((d) => NOMES_DIAS[d].curto);
  if (nomes.length <= 1) return nomes[0] ?? "Sem treinos definidos";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

function paraData(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

/**
 * Datas com treino previsto entre `de` e `ate` (YYYY-MM-DD, inclusive), nunca
 * depois de hoje: dias da agenda, a partir de `desde`, sem as datas sem treino.
 */
export function datasPrevistas(
  agenda: AgendaTreinoModalidade,
  de: string,
  ate: string,
  semTreino: readonly string[] = [],
  hoje: string = dataIsoLocal(),
): string[] {
  if (agenda.dias.length === 0) return [];
  const inicio = agenda.desde && agenda.desde > de ? agenda.desde : de;
  const fim = ate < hoje ? ate : hoje;
  if (inicio > fim) return [];
  const excluidas = new Set(semTreino);
  const dias = new Set<number>(agenda.dias);
  const datas: string[] = [];
  for (let d = paraData(inicio); dataIsoLocal(d) <= fim; d.setDate(d.getDate() + 1)) {
    const iso = dataIsoLocal(d);
    if (dias.has(d.getDay()) && !excluidas.has(iso)) datas.push(iso);
  }
  return datas;
}

/** Primeiro e último dia de um intervalo de competências "YYYY-MM". */
export function limitesDasCompetencias(de: string, ate: string) {
  const [anoAte, mesAte] = ate.split("-").map(Number);
  const ultimoDia = new Date(anoAte, mesAte, 0).getDate();
  return { inicio: `${de}-01`, fim: `${ate}-${String(ultimoDia).padStart(2, "0")}` };
}

export interface ResultadoAderencia {
  /** Treinos que contam (limitados aos previstos). */
  feitos: number;
  /** Treinos previstos já descontadas as faltas justificadas. */
  previstos: number;
  /** 0–100, ou null quando não há treino previsto (agenda não configurada ou período sem treino). */
  percentual: number | null;
  /** O período inclui mês com aderência informada pelo comitê no histórico mensal. */
  informada?: boolean;
}

/**
 * Aderência = treinos feitos ÷ treinos previstos. Faltas justificadas em dia de
 * treino saem dos previstos (o atleta não é penalizado). Treinos a mais do que o
 * previsto não passam de 100%.
 */
export function calcularAderencia(params: {
  previstas: readonly string[];
  treinosFeitos: number;
  faltasJustificadas?: readonly string[];
}): ResultadoAderencia {
  const abonadas = new Set(params.faltasJustificadas ?? []);
  const previstos = params.previstas.filter((d) => !abonadas.has(d)).length;
  if (previstos === 0) return { feitos: 0, previstos: 0, percentual: null };
  const feitos = Math.min(params.treinosFeitos, previstos);
  return { feitos, previstos, percentual: Math.round((feitos / previstos) * 100) };
}

/** Aderência calculada pela agenda (lançamentos + treinos do histórico mensal). */
function aderenciaCalculada(params: {
  modalidade: Modalidade;
  config: DiasTreinoConfigDoc;
  lancamentos: readonly HistoricoPontoDoc[];
  resumosMensais: readonly HistoricoMensalDoc[];
  de: string;
  ate: string;
  hoje?: string;
}): ResultadoAderencia {
  const { modalidade, config, de, ate } = params;
  const previstas = datasPrevistas(config[modalidade], de, ate, config.semTreino, params.hoje);
  const doPeriodo = params.lancamentos.filter((l) => !l.estornado && l.dataTreino >= de && l.dataTreino <= ate);
  const faltas = doPeriodo.filter((l) => l.regraId === "falta_justificada").map((l) => l.dataTreino);
  const treinos = consolidarAtividades(doPeriodo).filter((a) => a.tipo === "treino").length;
  const competenciaDe = de.slice(0, 7);
  const competenciaAte = ate.slice(0, 7);
  const treinosMensais = params.resumosMensais
    .filter((r) => r.competencia >= competenciaDe && r.competencia <= competenciaAte)
    .reduce((s, r) => s + (r.treinos || 0), 0);
  return calcularAderencia({ previstas, treinosFeitos: treinos + treinosMensais, faltasJustificadas: faltas });
}

/** Competências "YYYY-MM" de `de` até `ate`, inclusive. */
function competenciasEntre(de: string, ate: string) {
  const lista: string[] = [];
  let [ano, mes] = de.split("-").map(Number);
  const [anoFim, mesFim] = ate.split("-").map(Number);
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    lista.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return lista;
}

/**
 * Aderência de um atleta num intervalo de datas, a partir dos lançamentos dele
 * (e do histórico mensal, que entra como treinos do mês).
 *
 * Mês com aderência informada no histórico mensal usa o valor informado: se a
 * agenda previa treinos naquele mês, o valor vira treinos feitos proporcionais;
 * se não previa (mês anterior à agenda), o mês entra com o peso de um mês comum.
 */
export function aderenciaDoAtleta(params: {
  modalidade: Modalidade;
  config: DiasTreinoConfigDoc;
  lancamentos: readonly HistoricoPontoDoc[];
  resumosMensais?: readonly HistoricoMensalDoc[];
  de: string;
  ate: string;
  hoje?: string;
}): ResultadoAderencia {
  const resumosMensais = params.resumosMensais ?? [];
  const informadas = new Map<string, number>();
  for (const r of resumosMensais) {
    if (r.aderencia == null || !Number.isFinite(r.aderencia)) continue;
    if (r.competencia < params.de.slice(0, 7) || r.competencia > params.ate.slice(0, 7)) continue;
    informadas.set(r.competencia, Math.min(100, Math.max(0, Math.round(r.aderencia))));
  }
  if (informadas.size === 0) return aderenciaCalculada({ ...params, resumosMensais });

  let feitos = 0;
  let previstos = 0;
  let mesesComAgenda = 0;
  const soPercentual: number[] = [];
  for (const competencia of competenciasEntre(params.de.slice(0, 7), params.ate.slice(0, 7))) {
    const limites = limitesDasCompetencias(competencia, competencia);
    const de = params.de > limites.inicio ? params.de : limites.inicio;
    const ate = params.ate < limites.fim ? params.ate : limites.fim;
    const mes = aderenciaCalculada({ ...params, resumosMensais, de, ate });
    const informada = informadas.get(competencia);
    if (mes.previstos > 0) mesesComAgenda += 1;
    if (informada == null) {
      feitos += mes.feitos;
      previstos += mes.previstos;
    } else if (mes.previstos > 0) {
      // Fração mantida: arredondar aqui distorce o percentual (95% de 9 viraria 100%).
      feitos += (informada / 100) * mes.previstos;
      previstos += mes.previstos;
    } else {
      soPercentual.push(informada);
    }
  }

  // Meses só com o percentual entram com o peso médio dos meses com agenda (ou 1).
  const peso = mesesComAgenda > 0 ? previstos / mesesComAgenda : 1;
  const numerador = feitos + soPercentual.reduce((s, p) => s + (p / 100) * peso, 0);
  const denominador = previstos + soPercentual.length * peso;
  if (denominador === 0) return { feitos: 0, previstos: 0, percentual: null };
  return {
    feitos: Math.round(feitos),
    previstos,
    percentual: Math.round((numerador / denominador) * 100),
    informada: true,
  };
}

/** Aderência de vários atletas de uma vez (agrupa os lançamentos uma só vez). */
export function aderenciaPorAtleta(params: {
  atletas: readonly { id: string; equipe: string }[];
  config: DiasTreinoConfigDoc;
  lancamentos: readonly HistoricoPontoDoc[];
  resumosMensais?: readonly HistoricoMensalDoc[];
  de: string;
  ate: string;
  hoje?: string;
}): Map<string, ResultadoAderencia> {
  const lancPorAtleta = new Map<string, HistoricoPontoDoc[]>();
  for (const l of params.lancamentos) {
    const lista = lancPorAtleta.get(l.atletaId);
    if (lista) lista.push(l);
    else lancPorAtleta.set(l.atletaId, [l]);
  }
  const mensaisPorAtleta = new Map<string, HistoricoMensalDoc[]>();
  for (const r of params.resumosMensais ?? []) {
    const lista = mensaisPorAtleta.get(r.atletaId);
    if (lista) lista.push(r);
    else mensaisPorAtleta.set(r.atletaId, [r]);
  }
  const resultado = new Map<string, ResultadoAderencia>();
  for (const atleta of params.atletas) {
    if (atleta.equipe !== "corrida" && atleta.equipe !== "bicicleta") continue;
    resultado.set(
      atleta.id,
      aderenciaDoAtleta({
        modalidade: atleta.equipe,
        config: params.config,
        lancamentos: lancPorAtleta.get(atleta.id) ?? [],
        resumosMensais: mensaisPorAtleta.get(atleta.id) ?? [],
        de: params.de,
        ate: params.ate,
        hoje: params.hoje,
      }),
    );
  }
  return resultado;
}

/** Média das aderências calculáveis (ignora quem não tinha treino previsto). */
export function mediaAderencia(resultados: Iterable<ResultadoAderencia | undefined>): number | null {
  const validos = [...resultados].filter((r): r is ResultadoAderencia & { percentual: number } => r?.percentual != null);
  if (validos.length === 0) return null;
  return Math.round(validos.reduce((s, r) => s + r.percentual, 0) / validos.length);
}

/** "78%" ou "—" quando não há treino previsto. */
export function formatAderencia(percentual: number | null | undefined) {
  return percentual == null ? "—" : `${percentual}%`;
}
