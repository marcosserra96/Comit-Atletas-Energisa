import type { AtletaDoc, HistoricoPontoDoc } from "@/lib/types";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface AtletaInsights {
  posicao: number | null;
  totalNoRanking: number;
  pontosMes: number;
  kmMes: number;
  treinosMes: number;
  treinosSemana: number;
  mediaEquipe: number;
  vsMediaEquipePct: number | null;
  /** Diferença de pontos para a posição imediatamente acima (0 se já é 1º). */
  pontosProximaPosicao: number | null;
  seriesMensal: { label: string; pontos: number }[];
  leitura: string;
}

/**
 * Insights pessoais de um atleta: reaproveita o mesmo critério de ranking já
 * usado na tela Ranking (pontuacaoTotal, mesma equipe), e computa o resto a
 * partir do próprio histórico de lançamentos (mês corrente + últimos 6 meses).
 */
export function calcularInsightsAtleta(params: {
  atleta: AtletaDoc;
  /** Atletas da mesma equipe, já ordenados por pontuacaoTotal desc (mesma query da tela Ranking). */
  companheiros: AtletaDoc[];
  /** Lançamentos do próprio atleta (qualquer ordem). */
  meusLancamentos: HistoricoPontoDoc[];
}): AtletaInsights {
  const { atleta, companheiros, meusLancamentos } = params;
  const hoje = new Date();

  const idx = companheiros.findIndex((a) => a.id === atleta.id);
  const posicao = idx >= 0 ? idx + 1 : null;
  const totalNoRanking = companheiros.length;
  const mediaEquipe = totalNoRanking > 0 ? companheiros.reduce((s, a) => s + a.pontuacaoTotal, 0) / totalNoRanking : 0;
  const vsMediaEquipePct = mediaEquipe > 0 ? Math.round(((atleta.pontuacaoTotal - mediaEquipe) / mediaEquipe) * 100) : null;
  const pontosProximaPosicao = idx > 0 ? companheiros[idx - 1].pontuacaoTotal - atleta.pontuacaoTotal : idx === 0 ? 0 : null;

  const validos = meusLancamentos.filter((l) => !l.estornado);
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const prefixoMes = `${ano}-${String(mes).padStart(2, "0")}`;

  const lotesMes = new Map<string, { pontos: number; km: number }>();
  for (const l of validos) {
    if (!l.dataTreino.startsWith(prefixoMes)) continue;
    const atual = lotesMes.get(l.loteId) ?? { pontos: 0, km: 0 };
    atual.pontos += l.pontos;
    atual.km += l.kmPercorrido ?? 0;
    lotesMes.set(l.loteId, atual);
  }
  const pontosMes = [...lotesMes.values()].reduce((s, v) => s + v.pontos, 0);
  const kmMes = [...lotesMes.values()].reduce((s, v) => s + v.km, 0);
  const treinosMes = lotesMes.size;

  const iso7dias = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const treinosSemana = new Set(validos.filter((l) => l.dataTreino >= iso7dias).map((l) => l.loteId)).size;

  const seriesMensal = Array.from({ length: 6 }, (_, i) => {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
    const prefixo = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
    const pontos = validos.filter((l) => l.dataTreino.startsWith(prefixo)).reduce((s, l) => s + l.pontos, 0);
    return { label: MESES[ref.getMonth()], pontos };
  });

  const leitura = montarLeitura({ posicao, totalNoRanking, pontosProximaPosicao, treinosSemana });

  return {
    posicao,
    totalNoRanking,
    pontosMes,
    kmMes,
    treinosMes,
    treinosSemana,
    mediaEquipe,
    vsMediaEquipePct,
    pontosProximaPosicao,
    seriesMensal,
    leitura,
  };
}

function montarLeitura(params: {
  posicao: number | null;
  totalNoRanking: number;
  pontosProximaPosicao: number | null;
  treinosSemana: number;
}): string {
  const { posicao, totalNoRanking, pontosProximaPosicao, treinosSemana } = params;

  let rankingClause = "";
  if (posicao !== null && totalNoRanking > 1) {
    if (posicao === 1) {
      rankingClause = "Você está em 1º lugar na sua modalidade";
    } else if (pontosProximaPosicao !== null && pontosProximaPosicao > 0) {
      rankingClause = `Você está a ${pontosProximaPosicao} ${pontosProximaPosicao === 1 ? "ponto" : "pontos"} do ${posicao - 1}º lugar`;
    } else {
      rankingClause = `Você está em ${posicao}º lugar na sua modalidade`;
    }
  }

  const treinoClause =
    treinosSemana > 0
      ? `treinou ${treinosSemana} ${treinosSemana === 1 ? "vez" : "vezes"} essa semana`
      : "ainda não treinou essa semana";

  return rankingClause ? `${rankingClause} e ${treinoClause}.` : `Você ${treinoClause}.`;
}
