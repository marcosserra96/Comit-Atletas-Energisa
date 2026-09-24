import { consolidarAtividades } from "@/lib/activityConsolidation";
import type {
  AtletaDoc,
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
      !atleta.ativo ||
      (atleta.equipe !== "corrida" && atleta.equipe !== "bicicleta")
    ) {
      return [];
    }

    const atividades = consolidarAtividades(porAtleta.get(atleta.id) ?? []);
    const pontuacaoTotal = atividades.reduce(
      (total, atividade) => total + atividade.pontos,
      0,
    );
    const treinos = atividades.filter((atividade) => atividade.tipo === "treino").length;
    const km = atividades.reduce((total, atividade) => total + atividade.km, 0);

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
