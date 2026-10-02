import { consolidarAtividades, type RegrasDeTreino } from "@/lib/activityConsolidation";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import type {
  AtletaDoc,
  HistoricoMensalDoc,
  HistoricoPontoDoc,
  RankingPeriodKey,
  RankingPeriodsConfigDoc,
  RankingResultadoDoc,
} from "@/lib/types";

export const RANKING_PERIODS_DEFAULT: RankingPeriodsConfigDoc = {
  trimestre: {
    ativo: false,
    nome: "Trimestre atual",
    inicio: "",
    fim: "",
  },
};

/** Competência "YYYY-MM" de agora no horário de Brasília (o servidor roda em UTC). */
export function competenciaAtualBrasil(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(agora);
  const ano = partes.find((p) => p.type === "year")?.value;
  const mes = partes.find((p) => p.type === "month")?.value;
  return `${ano}-${mes}`;
}

/** Primeiro e último dia (YYYY-MM-DD) de uma competência "YYYY-MM". */
export function limitesDaCompetencia(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  return { inicio: `${competencia}-01`, fim: `${competencia}-${String(ultimo).padStart(2, "0")}` };
}

export function normalizarRankingPeriods(
  value?: Partial<RankingPeriodsConfigDoc>,
): RankingPeriodsConfigDoc {
  return {
    trimestre: {
      ativo: value?.trimestre?.ativo === true,
      nome: value?.trimestre?.nome?.trim() || "Trimestre atual",
      inicio: value?.trimestre?.inicio ?? "",
      fim: value?.trimestre?.fim ?? "",
    },
    geracaoPublicada: value?.geracaoPublicada,
    mesPublicado: value?.mesPublicado === true,
    rankingAtualizadoEm: value?.rankingAtualizadoEm,
    rankingAtualizacaoModo: value?.rankingAtualizacaoModo,
    rankingAtualizacaoOrigem: value?.rankingAtualizacaoOrigem,
    atualizadoEm: value?.atualizadoEm,
    atualizadoPor: value?.atualizadoPor,
  };
}

export function calcularResultadosRanking(
  atletas: AtletaDoc[],
  lancamentos: HistoricoPontoDoc[],
  periodoId: RankingPeriodKey,
  inicio?: string,
  fim?: string,
  resumosMensais: HistoricoMensalDoc[] = [],
  regrasTreino?: RegrasDeTreino,
): Omit<RankingResultadoDoc, "geracaoId" | "geradoEm">[] {
  const porAtleta = new Map<string, HistoricoPontoDoc[]>();

  for (const lancamento of lancamentos) {
    if (inicio && lancamento.dataTreino < inicio) continue;
    if (fim && lancamento.dataTreino > fim) continue;
    const lista = porAtleta.get(lancamento.atletaId) ?? [];
    lista.push(lancamento);
    porAtleta.set(lancamento.atletaId, lista);
  }

  return atletas.flatMap((atleta) => {
    if (
      !perfilAtletaVisivel(atleta) ||
      !atleta.ativo ||
      (atleta.equipe !== "corrida" && atleta.equipe !== "bicicleta")
    ) {
      return [];
    }

    const atividades = consolidarAtividades(porAtleta.get(atleta.id) ?? [], regrasTreino);
    const competenciaInicio = inicio?.slice(0, 7);
    const competenciaFim = fim?.slice(0, 7);
    const resumosDoAtleta = resumosMensais.filter(
      (resumo) =>
        resumo.atletaId === atleta.id &&
        (!competenciaInicio || resumo.competencia >= competenciaInicio) &&
        (!competenciaFim || resumo.competencia <= competenciaFim),
    );
    const pontuacaoTotal =
      atividades.reduce((total, atividade) => total + atividade.pontos, 0) +
      resumosDoAtleta.reduce((total, resumo) => total + (resumo.pontos || 0), 0);
    const treinos =
      atividades.filter((atividade) => atividade.tipo === "treino").length +
      resumosDoAtleta.reduce((total, resumo) => total + (resumo.treinos || 0), 0);
    const km =
      atividades.reduce((total, atividade) => total + atividade.km, 0) +
      resumosDoAtleta.reduce((total, resumo) => total + (resumo.km || 0), 0);

    return [{
      id: atleta.id,
      periodoId,
      atletaId: atleta.id,
      nome: atleta.nome,
      equipe: atleta.equipe,
      ativo: atleta.ativo,
      pontuacaoTotal,
      treinos,
      km,
    }];
  });
}
