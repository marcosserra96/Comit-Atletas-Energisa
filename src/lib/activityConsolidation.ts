import type { HistoricoPontoDoc, TipoLancamento } from "@/lib/types";

export interface AtividadeConsolidada {
  chave: string;
  atletaId: string;
  data: string;
  tipo: TipoLancamento;
  descricao: string;
  pontos: number;
  km: number;
}

/**
 * Identifica uma atividade de forma estável. A importação antiga pode
 * reutilizar o mesmo lote em datas diferentes, por isso a data faz parte da chave.
 */
export function chaveAtividade(lancamento: HistoricoPontoDoc) {
  const identidade = lancamento.loteId?.trim()
    ? ["lote", lancamento.loteId, lancamento.dataTreino]
    : lancamento.eventoId?.trim()
      ? ["evento", lancamento.eventoId, lancamento.dataTreino]
      : [
          "atividade",
          lancamento.dataTreino,
          lancamento.tipoLancamento,
          lancamento.descricaoLote || "sem-descricao",
        ];

  return [lancamento.atletaId, ...identidade].join("|");
}

/**
 * Consolida todas as regras geradas pela mesma atividade em uma participação:
 * soma pontos, mas considera a quilometragem apenas uma vez (maior valor informado).
 * Estornos e faltas justificadas não contam como atividade realizada.
 */
export function consolidarAtividades(lancamentos: HistoricoPontoDoc[]) {
  const porChave = new Map<string, AtividadeConsolidada>();

  for (const lancamento of lancamentos) {
    if (lancamento.estornado || lancamento.regraId === "falta_justificada") continue;

    const chave = chaveAtividade(lancamento);
    const atual = porChave.get(chave);
    const km = Number(lancamento.kmPercorrido) || 0;

    if (!atual) {
      porChave.set(chave, {
        chave,
        atletaId: lancamento.atletaId,
        data: lancamento.dataTreino,
        tipo: lancamento.tipoLancamento,
        descricao: lancamento.descricaoLote || lancamento.regraDesc,
        pontos: lancamento.pontos,
        km,
      });
      continue;
    }

    atual.pontos += lancamento.pontos;
    atual.km = Math.max(atual.km, km);
    if (lancamento.tipoLancamento === "treino") atual.tipo = "treino";
  }

  return [...porChave.values()];
}
