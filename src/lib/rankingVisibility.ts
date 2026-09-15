import { dataIsoLocal } from "@/lib/date";
import type {
  Equipe,
  Modalidade,
  RankingVisibilityConfigDoc,
  RankingVisibilityPeriodConfig,
} from "@/lib/types";

export const RANKING_VISIBILITY_DEFAULT: RankingVisibilityConfigDoc = {
  corrida: { ativo: false, inicio: "", fim: "", mensagem: "" },
  bicicleta: { ativo: false, inicio: "", fim: "", mensagem: "" },
};

function normalizarPeriodo(
  value?: Partial<RankingVisibilityPeriodConfig>,
): RankingVisibilityPeriodConfig {
  return {
    ativo: value?.ativo === true,
    inicio: value?.inicio ?? "",
    fim: value?.fim ?? "",
    mensagem: value?.mensagem ?? "",
    inicioEm: value?.inicioEm,
    fimEm: value?.fimEm,
  };
}

export function normalizarRankingVisibility(
  value?: Partial<RankingVisibilityConfigDoc>,
): RankingVisibilityConfigDoc {
  return {
    corrida: normalizarPeriodo(value?.corrida),
    bicicleta: normalizarPeriodo(value?.bicicleta),
    atualizadoEm: value?.atualizadoEm,
    atualizadoPor: value?.atualizadoPor,
  };
}

export function modalidadeDoAtleta(equipe: Equipe): Modalidade | null {
  if (equipe === "corrida" || equipe === "fila_corrida") return "corrida";
  if (equipe === "bicicleta" || equipe === "fila_bicicleta") return "bicicleta";
  return null;
}

export function rankingOcultoAgora(
  config: RankingVisibilityConfigDoc,
  modalidade: Modalidade,
  hoje = dataIsoLocal(),
) {
  const periodo = config[modalidade];
  return Boolean(
    periodo.ativo &&
      periodo.inicio &&
      periodo.fim &&
      hoje >= periodo.inicio &&
      hoje <= periodo.fim,
  );
}
