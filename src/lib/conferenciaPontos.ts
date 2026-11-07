import { consolidarAtividades, lancamentoContaComoTreino, type RegrasDeTreino } from "@/lib/activityConsolidation";
import { REGRA_DESAFIO } from "@/lib/desafios";
import type { Equipe, HistoricoMensalDoc, HistoricoPontoDoc } from "@/lib/types";

/**
 * Conferência dos pontos e treinos: o que pode estar errado sem ninguém ver.
 *
 * O total de cada atleta (`pontuacaoTotal`, que o ranking Geral usa) é somado
 * aos poucos a cada lançamento, estorno ou resumo mensal. Se uma gravação falhar
 * pela metade, ele deixa de bater com a soma do histórico. Aqui ele é refeito do
 * zero: lançamentos válidos + resumos mensais.
 */

export interface AtletaConferido {
  id: string;
  nome: string;
  equipe: Equipe;
  pontuacaoTotal: number;
}

export interface TotalDivergente {
  atletaId: string;
  nome: string;
  equipe: Equipe;
  /** O que está gravado no cadastro do atleta. */
  salvo: number;
  /** O que está na cópia pública (ranking); null quando ela não existe. */
  salvoPublico: number | null;
  /** Soma dos lançamentos válidos e dos resumos mensais. */
  esperado: number;
}

export interface GrupoRepetido {
  chave: string;
  atletaId: string;
  nome: string;
  data: string;
  descricao: string;
  /** Do mais antigo para o mais novo: o primeiro fica, os outros seriam a repetição. */
  lancamentos: HistoricoPontoDoc[];
  /** Pontos a mais, se a repetição for mesmo um erro. */
  pontosAMais: number;
}

export interface MesComDoisRegistros {
  chave: string;
  resumoId: string;
  atletaId: string;
  nome: string;
  competencia: string;
  resumo: { pontos: number; treinos: number };
  lancamentos: { quantidade: number; pontos: number; treinos: number };
}

export interface ResultadoConferencia {
  atletasConferidos: number;
  lancamentosConferidos: number;
  totais: TotalDivergente[];
  repetidos: GrupoRepetido[];
  mesesDuplos: MesComDoisRegistros[];
  futuros: HistoricoPontoDoc[];
  semAtleta: { lancamentos: number; resumos: number; pontos: number };
}

/** Repetições que o comitê já conferiu e marcou como certas (ex.: dois treinos no mesmo dia). */
export type LancamentoConferido = HistoricoPontoDoc & { repeticaoConferida?: boolean };
export type ResumoConferido = HistoricoMensalDoc & { conferidoComLancamentos?: boolean };

const valido = (l: HistoricoPontoDoc) => !l.estornado;

/**
 * Mesmo atleta, mesmo dia, mesmo critério. Ficam de fora as datas aproximadas
 * (treinos extras da planilha antiga, todos no dia 01) e as faltas justificadas.
 * Desafios e avulsos levam a descrição na chave: dois desafios diferentes podem
 * terminar no mesmo dia.
 */
export function chaveRepeticao(l: HistoricoPontoDoc) {
  const porDescricao = l.regraId === REGRA_DESAFIO || l.tipoLancamento === "avulso" || !l.regraId;
  return [l.atletaId, l.dataTreino, l.regraId || "sem-criterio", porDescricao ? `${l.regraDesc}|${l.pontos}` : ""].join("|");
}

function criadoEmMs(valor: unknown): number {
  if (valor && typeof valor === "object") {
    const v = valor as { toMillis?: () => number; seconds?: number };
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v.seconds === "number") return v.seconds * 1000;
  }
  if (typeof valor === "string" || typeof valor === "number") {
    const ms = new Date(valor).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

export function somaEsperada(lancamentos: readonly HistoricoPontoDoc[], resumos: readonly HistoricoMensalDoc[]) {
  return (
    lancamentos.reduce((s, l) => (valido(l) ? s + (Number(l.pontos) || 0) : s), 0) +
    resumos.reduce((s, r) => s + (Number(r.pontos) || 0), 0)
  );
}

export function conferirPontos(entrada: {
  atletas: readonly AtletaConferido[];
  /** pontuacaoTotal da cópia pública, por atleta (só as que existem). */
  publicos: ReadonlyMap<string, number>;
  lancamentos: readonly LancamentoConferido[];
  resumos: readonly ResumoConferido[];
  regrasTreino?: RegrasDeTreino;
  hoje: string;
}): ResultadoConferencia {
  const { atletas, publicos, lancamentos, resumos, regrasTreino, hoje } = entrada;
  const porId = new Map(atletas.map((a) => [a.id, a]));
  const lancPorAtleta = new Map<string, LancamentoConferido[]>();
  const resumosPorAtleta = new Map<string, ResumoConferido[]>();
  const semAtleta = { lancamentos: 0, resumos: 0, pontos: 0 };

  for (const l of lancamentos) {
    if (!porId.has(l.atletaId)) {
      if (valido(l)) {
        semAtleta.lancamentos += 1;
        semAtleta.pontos += Number(l.pontos) || 0;
      }
      continue;
    }
    const lista = lancPorAtleta.get(l.atletaId) ?? [];
    lista.push(l);
    lancPorAtleta.set(l.atletaId, lista);
  }
  for (const r of resumos) {
    if (!porId.has(r.atletaId)) {
      semAtleta.resumos += 1;
      semAtleta.pontos += Number(r.pontos) || 0;
      continue;
    }
    const lista = resumosPorAtleta.get(r.atletaId) ?? [];
    lista.push(r);
    resumosPorAtleta.set(r.atletaId, lista);
  }

  const totais: TotalDivergente[] = [];
  for (const a of atletas) {
    const esperado = somaEsperada(lancPorAtleta.get(a.id) ?? [], resumosPorAtleta.get(a.id) ?? []);
    const salvo = Number(a.pontuacaoTotal) || 0;
    const salvoPublico = publicos.has(a.id) ? Number(publicos.get(a.id)) || 0 : null;
    if (salvo !== esperado || (salvoPublico !== null && salvoPublico !== esperado)) {
      totais.push({ atletaId: a.id, nome: a.nome, equipe: a.equipe, salvo, salvoPublico, esperado });
    }
  }
  totais.sort((x, y) => Math.abs(y.esperado - y.salvo) - Math.abs(x.esperado - x.salvo) || x.nome.localeCompare(y.nome, "pt-BR"));

  const grupos = new Map<string, LancamentoConferido[]>();
  for (const lista of lancPorAtleta.values()) {
    for (const l of lista) {
      if (!valido(l) || l.dataAproximada || l.regraId === "falta_justificada") continue;
      const chave = chaveRepeticao(l);
      const g = grupos.get(chave) ?? [];
      g.push(l);
      grupos.set(chave, g);
    }
  }
  const repetidos: GrupoRepetido[] = [];
  for (const [chave, g] of grupos) {
    if (g.length < 2 || g.every((l) => l.repeticaoConferida)) continue;
    const ordenados = [...g].sort((x, y) => criadoEmMs(x.criadoEm) - criadoEmMs(y.criadoEm) || x.id.localeCompare(y.id));
    repetidos.push({
      chave,
      atletaId: g[0].atletaId,
      nome: porId.get(g[0].atletaId)?.nome ?? g[0].atletaNome,
      data: g[0].dataTreino,
      descricao: g[0].regraDesc,
      lancamentos: ordenados,
      pontosAMais: ordenados.slice(1).reduce((s, l) => s + (Number(l.pontos) || 0), 0),
    });
  }
  repetidos.sort((x, y) => y.data.localeCompare(x.data) || x.nome.localeCompare(y.nome, "pt-BR"));

  const mesesDuplos: MesComDoisRegistros[] = [];
  for (const [atletaId, lista] of resumosPorAtleta) {
    for (const r of lista) {
      if (r.conferidoComLancamentos) continue;
      const doMes = (lancPorAtleta.get(atletaId) ?? []).filter((l) => valido(l) && l.dataTreino.startsWith(r.competencia));
      if (!doMes.length) continue;
      const treinos = consolidarAtividades(doMes, regrasTreino).filter((a) => a.tipo === "treino").length;
      mesesDuplos.push({
        chave: r.id,
        resumoId: r.id,
        atletaId,
        nome: porId.get(atletaId)?.nome ?? r.atletaNome,
        competencia: r.competencia,
        resumo: { pontos: Number(r.pontos) || 0, treinos: Number(r.treinos) || 0 },
        lancamentos: { quantidade: doMes.length, pontos: doMes.reduce((s, l) => s + (Number(l.pontos) || 0), 0), treinos },
      });
    }
  }
  mesesDuplos.sort((x, y) => y.competencia.localeCompare(x.competencia) || x.nome.localeCompare(y.nome, "pt-BR"));

  const futuros = [...lancPorAtleta.values()]
    .flat()
    .filter((l) => valido(l) && l.dataTreino > hoje)
    .sort((x, y) => x.dataTreino.localeCompare(y.dataTreino));

  return {
    atletasConferidos: atletas.length,
    lancamentosConferidos: lancamentos.filter(valido).length,
    totais,
    repetidos,
    mesesDuplos,
    futuros,
    semAtleta,
  };
}

export function quantidadeDePendencias(r: ResultadoConferencia) {
  return r.totais.length + r.repetidos.length + r.mesesDuplos.length + r.futuros.length + (r.semAtleta.lancamentos + r.semAtleta.resumos > 0 ? 1 : 0);
}

/* ---------- Um atleta, mês a mês ---------- */

export interface CriterioDoMes {
  chave: string;
  descricao: string;
  vezes: number;
  pontos: number;
  contaComoTreino: boolean;
}

export interface MesDoAtleta {
  competencia: string;
  pontos: number;
  treinos: number;
  km: number;
  criterios: CriterioDoMes[];
  /** Lançamentos de treino que viraram um só treino (mesmo dia e mesmo lançamento). */
  juntados: number;
  faltasJustificadas: number;
  estornados: number;
  resumo: { pontos: number; treinos: number; km: number } | null;
}

/**
 * Como os números de um atleta são formados, mês a mês e critério a critério —
 * para comparar com a planilha do comitê. Usa a mesma regra do ranking: cada
 * atividade (atleta + dia + lançamento) conta como um treino.
 */
export function detalharAtleta(
  atletaId: string,
  lancamentos: readonly HistoricoPontoDoc[],
  resumos: readonly HistoricoMensalDoc[],
  ano: string,
  regrasTreino?: RegrasDeTreino,
): MesDoAtleta[] {
  const doAno = lancamentos.filter((l) => l.atletaId === atletaId && l.dataTreino.startsWith(ano));
  const resumosDoAno = resumos.filter((r) => r.atletaId === atletaId && r.competencia.startsWith(ano));
  const competencias = new Set([...doAno.map((l) => l.dataTreino.slice(0, 7)), ...resumosDoAno.map((r) => r.competencia)]);

  return [...competencias]
    .sort((a, b) => b.localeCompare(a))
    .map((competencia) => {
      const doMes = doAno.filter((l) => l.dataTreino.startsWith(competencia));
      const validos = doMes.filter((l) => valido(l));
      const atividades = consolidarAtividades(validos, regrasTreino);
      const treinosLancados = atividades.filter((a) => a.tipo === "treino").length;
      const lancamentosDeTreino = validos.filter((l) => l.regraId !== "falta_justificada" && lancamentoContaComoTreino(l, regrasTreino)).length;

      const criterios = new Map<string, CriterioDoMes>();
      for (const l of validos) {
        if (l.regraId === "falta_justificada") continue;
        const chave = l.regraId === REGRA_DESAFIO || !l.regraId ? `${l.regraId}|${l.regraDesc}` : l.regraId;
        const atual = criterios.get(chave) ?? { chave, descricao: l.regraDesc, vezes: 0, pontos: 0, contaComoTreino: lancamentoContaComoTreino(l, regrasTreino) };
        atual.vezes += 1;
        atual.pontos += Number(l.pontos) || 0;
        criterios.set(chave, atual);
      }

      const r = resumosDoAno.find((x) => x.competencia === competencia);
      const resumo = r ? { pontos: Number(r.pontos) || 0, treinos: Number(r.treinos) || 0, km: Number(r.km) || 0 } : null;

      return {
        competencia,
        pontos: validos.reduce((s, l) => s + (Number(l.pontos) || 0), 0) + (resumo?.pontos ?? 0),
        treinos: treinosLancados + (resumo?.treinos ?? 0),
        km: atividades.reduce((s, a) => s + a.km, 0) + (resumo?.km ?? 0),
        criterios: [...criterios.values()].sort((a, b) => Number(b.contaComoTreino) - Number(a.contaComoTreino) || b.vezes - a.vezes || a.descricao.localeCompare(b.descricao, "pt-BR")),
        juntados: Math.max(0, lancamentosDeTreino - treinosLancados),
        faltasJustificadas: validos.filter((l) => l.regraId === "falta_justificada").length,
        estornados: doMes.length - validos.length,
        resumo,
      };
    });
}
