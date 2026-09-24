import { auth } from "@/lib/firebase";
import type { RankingPeriodsConfigDoc } from "@/lib/types";

interface RankingUpdateResponse {
  geracaoId: string;
  atletas: number;
  resultados: number;
  atualizadoEm: string;
}

async function requisitarAtualizacao(body: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sua sessão foi encerrada.");
  const token = await user.getIdToken();
  const response = await fetch("/api/admin/ranking/recalcular", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const texto = await response.text();
  let resultado: Record<string, unknown> = {};
  if (texto) {
    try {
      resultado = JSON.parse(texto) as Record<string, unknown>;
    } catch {
      throw new Error("O servidor retornou uma resposta inválida.");
    }
  }
  if (!response.ok) {
    throw new Error(
      typeof resultado.error === "string" ? resultado.error : "Não foi possível atualizar o ranking.",
    );
  }
  return resultado as unknown as RankingUpdateResponse;
}

export async function atualizarRankingAutomaticamente(
  atletaIds: string[],
  origem: string,
): Promise<boolean> {
  const ids = [...new Set(atletaIds.filter(Boolean))];
  if (ids.length === 0) return true;
  try {
    await requisitarAtualizacao({ modo: "automatico", atletaIds: ids, origem });
    return true;
  } catch (error) {
    console.error("Falha na atualização automática do ranking:", error);
    return false;
  }
}

export function recalcularEPublicarRanking(
  trimestre: RankingPeriodsConfigDoc["trimestre"],
) {
  return requisitarAtualizacao({ modo: "completo", trimestre });
}
