import { aderenciaPorAtleta, limitesDasCompetencias, mediaAderencia, type DiasTreinoConfigDoc } from "@/lib/aderencia";
import { calcularResumoRankingPeriodo } from "@/lib/rankingMensal";
import { calcularPosicoesRanking } from "@/lib/rankingPosition";
import type { AtletaDoc, HistoricoMensalDoc, HistoricoPontoDoc, Modalidade } from "@/lib/types";

export type FormatoInformativo = "paisagem" | "vertical";

export const DIMENSOES: Record<FormatoInformativo, { largura: number; altura: number; rotulo: string }> = {
  paisagem: { largura: 1920, altura: 1080, rotulo: "16:9" },
  vertical: { largura: 1080, altura: 1920, rotulo: "Vertical 9:16" },
};

/**
 * Quantas linhas de tabela cabem em cada página. A primeira página divide
 * espaço com o cabeçalho e o pódio; as seguintes são só tabela (na paisagem,
 * em duas colunas).
 */
export const CAPACIDADE: Record<
  FormatoInformativo,
  { primeira: number; seguintes: number; primeiraComDestaques: number; seguintesComDestaques: number }
> = {
  paisagem: { primeira: 14, seguintes: 30, primeiraComDestaques: 8, seguintesComDestaques: 18 },
  vertical: { primeira: 9, seguintes: 30, primeiraComDestaques: 7, seguintesComDestaques: 24 },
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface PeriodoInformativo {
  /** Competências "YYYY-MM" (iguais quando é um mês só). */
  de: string;
  ate: string;
}

/** O mês fechado anterior: é o que normalmente vira informativo. */
export function mesReferenciaPadrao(hoje = new Date()) {
  const anterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${anterior.getFullYear()}-${String(anterior.getMonth() + 1).padStart(2, "0")}`;
}

/** "Setembro 2026", "Julho a Setembro 2026" ou "Nov 2025 a Fev 2026". */
export function rotuloPeriodo({ de, ate }: PeriodoInformativo) {
  const [anoDe, mesDe] = de.split("-").map(Number);
  const [anoAte, mesAte] = ate.split("-").map(Number);
  if (de === ate) return `${MESES[mesDe - 1]} ${anoDe}`;
  if (anoDe === anoAte) return `${MESES[mesDe - 1]} a ${MESES[mesAte - 1]} ${anoAte}`;
  return `${MESES[mesDe - 1].slice(0, 3)} ${anoDe} a ${MESES[mesAte - 1].slice(0, 3)} ${anoAte}`;
}

export function sufixoArquivo({ de, ate }: PeriodoInformativo) {
  return de === ate ? de : `${de}_a_${ate}`;
}

export interface LinhaRanking {
  id: string;
  nome: string;
  posicao: number;
  pontos: number;
  treinos: number;
  km: number;
  /** null quando não havia treino previsto (agenda não configurada). */
  aderencia: number | null;
}

export interface DegrauPodio {
  posicao: number;
  atletas: LinhaRanking[];
}

export interface PaginaInformativo {
  numero: number;
  total: number;
  /** Só na primeira página. */
  podio: DegrauPodio[] | null;
  linhas: LinhaRanking[];
  /** Os destaques do período fecham sempre a última página (o espaço é reservado). */
  destaques: boolean;
}

export interface DadosInformativo {
  modalidade: Modalidade;
  periodo: PeriodoInformativo;
  ranking: LinhaRanking[];
  totais: { atletas: number; treinos: number; km: number; pontos: number; aderencia: number | null };
}

/** No máximo 2 nomes por degrau; empatados a mais seguem na tabela com a mesma posição. */
export const NOMES_POR_DEGRAU = 2;

/**
 * Ranking de uma modalidade no período: só pontos definem a posição, empates
 * dividem a colocação (1º, 2º, 2º, 4º). Treinos, km e aderência são informativos.
 */
export function montarInformativo(params: {
  modalidade: Modalidade;
  periodo: PeriodoInformativo;
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
  resumosMensais: HistoricoMensalDoc[];
  diasTreino: DiasTreinoConfigDoc;
  hoje?: string;
}): DadosInformativo {
  const { modalidade, periodo } = params;
  const resumo = calcularResumoRankingPeriodo({
    atletas: params.atletas,
    lancamentos: params.lancamentos,
    resumosMensais: params.resumosMensais,
    de: periodo.de,
    ate: periodo.ate,
  }).filter((r) => r.equipe === modalidade);

  const { inicio, fim } = limitesDasCompetencias(periodo.de, periodo.ate);
  const aderencias = aderenciaPorAtleta({
    atletas: resumo.map((r) => ({ id: r.id, equipe: r.equipe })),
    config: params.diasTreino,
    lancamentos: params.lancamentos,
    resumosMensais: params.resumosMensais,
    de: inicio,
    ate: fim,
    hoje: params.hoje,
  });

  const ordenado = [...resumo].sort((a, b) => b.pontosMes - a.pontosMes || a.nome.localeCompare(b.nome, "pt-BR"));
  const posicoes = calcularPosicoesRanking(ordenado.map((r) => r.pontosMes));
  const ranking: LinhaRanking[] = ordenado.map((r, i) => ({
    id: r.id,
    nome: r.nome,
    posicao: posicoes[i],
    pontos: r.pontosMes,
    treinos: r.treinosMes,
    km: r.kmMes,
    aderencia: aderencias.get(r.id)?.percentual ?? null,
  }));

  return {
    modalidade,
    periodo,
    ranking,
    totais: {
      atletas: ranking.length,
      treinos: ranking.reduce((s, r) => s + r.treinos, 0),
      km: ranking.reduce((s, r) => s + r.km, 0),
      pontos: ranking.reduce((s, r) => s + r.pontos, 0),
      aderencia: mediaAderencia(aderencias.values()),
    },
  };
}

/**
 * Pódio: as posições 1 a 3 que existem (com empate, pode faltar a 2ª ou a 3ª),
 * até 2 nomes por degrau. Só entra quem pontuou.
 */
export function separarPodio(ranking: LinhaRanking[]) {
  const podio: DegrauPodio[] = [];
  const noPodio = new Set<string>();
  for (const linha of ranking) {
    if (linha.posicao > 3 || linha.pontos <= 0) break;
    let degrau = podio.find((d) => d.posicao === linha.posicao);
    if (!degrau) {
      degrau = { posicao: linha.posicao, atletas: [] };
      podio.push(degrau);
    }
    if (degrau.atletas.length < NOMES_POR_DEGRAU) {
      degrau.atletas.push(linha);
      noPodio.add(linha.id);
    }
  }
  return { podio, restantes: ranking.filter((l) => !noPodio.has(l.id)) };
}

/** Divide o ranking em páginas: a primeira com pódio, as demais só com tabela. Ninguém fica de fora. */
export function paginar(ranking: LinhaRanking[], formato: FormatoInformativo): PaginaInformativo[] {
  // Sem ninguém pontuando, só a capa com o aviso: uma lista de zeros não informa nada.
  if (ranking.every((l) => l.pontos <= 0)) {
    return [{ numero: 1, total: 1, podio: [], linhas: [], destaques: false }];
  }
  const { podio, restantes } = separarPodio(ranking);
  const cap = CAPACIDADE[formato];

  // Cabe tudo numa imagem só, com os destaques.
  if (restantes.length <= cap.primeiraComDestaques) {
    return [{ numero: 1, total: 1, podio, linhas: restantes, destaques: true }];
  }

  const paginas: Omit<PaginaInformativo, "total">[] = [
    { numero: 1, podio, linhas: restantes.slice(0, cap.primeira), destaques: false },
  ];
  const sobra = restantes.slice(cap.primeira);
  if (sobra.length === 0) {
    // A capa encheu sem espaço para os destaques: eles ganham uma página de fechamento.
    paginas.push({ numero: 2, podio: null, linhas: [], destaques: true });
  } else {
    // Páginas cheias; a última recebe o que sobra (até o limite que deixa espaço
    // para os destaques). Se sobrar pouco, a arte completa o espaço com o resumo.
    let quantas = 1;
    while ((quantas - 1) * cap.seguintes + cap.seguintesComDestaques < sobra.length) quantas++;
    let inicio = 0;
    for (let i = 0; i < quantas; i++) {
      const tamanho = i < quantas - 1 ? cap.seguintes : sobra.length - inicio;
      paginas.push({ numero: paginas.length + 1, podio: null, linhas: sobra.slice(inicio, inicio + tamanho), destaques: false });
      inicio += tamanho;
    }
    paginas[paginas.length - 1].destaques = true;
  }
  return paginas.map((p) => ({ ...p, total: paginas.length }));
}
