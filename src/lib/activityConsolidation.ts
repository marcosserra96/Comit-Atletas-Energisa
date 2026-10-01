import type { HistoricoPontoDoc, RegraPontuacaoDoc, TipoLancamento } from "@/lib/types";

/** IDs dos critérios cujos lançamentos contam como treino. */
export type RegrasDeTreino = ReadonlySet<string>;

/**
 * Um critério conta como treino quando o comitê marcou isso no cadastro. Sem a
 * marcação (critérios antigos): critérios do tipo Treino ou com "treino" no
 * nome — "Treino avulso", "Treino extra" — contam; ajustes e bônus não.
 */
export function regraContaComoTreino(
  regra: Pick<RegraPontuacaoDoc, "descricao" | "tiposLancamento" | "contaComoTreino">,
) {
  if (typeof regra.contaComoTreino === "boolean") return regra.contaComoTreino || regra.tiposLancamento.includes("treino");
  return regra.tiposLancamento.includes("treino") || /treino/i.test(regra.descricao);
}

export function regrasDeTreino(
  regras: readonly Pick<RegraPontuacaoDoc, "id" | "descricao" | "tiposLancamento" | "contaComoTreino">[],
): Set<string> {
  return new Set(regras.filter(regraContaComoTreino).map((r) => r.id));
}

/** O lançamento conta como treino: lançado como Treino ou de um critério que conta como treino. */
export function lancamentoContaComoTreino(lancamento: HistoricoPontoDoc, regrasTreino?: RegrasDeTreino) {
  if (lancamento.tipoLancamento === "treino") return true;
  if (lancamento.tipoLancamento === "evento") return false;
  return Boolean(regrasTreino?.has(lancamento.regraId));
}

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
 * Com `regrasTreino`, atividades de critérios que contam como treino viram treino
 * mesmo lançadas como Avulso (ex.: "Treino avulso" importado da planilha).
 */
export function consolidarAtividades(lancamentos: readonly HistoricoPontoDoc[], regrasTreino?: RegrasDeTreino) {
  const porChave = new Map<string, AtividadeConsolidada>();

  for (const lancamento of lancamentos) {
    if (lancamento.estornado || lancamento.regraId === "falta_justificada") continue;

    const chave = chaveAtividade(lancamento);
    const atual = porChave.get(chave);
    const km = Number(lancamento.kmPercorrido) || 0;

    const tipo: TipoLancamento = lancamentoContaComoTreino(lancamento, regrasTreino) ? "treino" : lancamento.tipoLancamento;
    if (!atual) {
      porChave.set(chave, {
        chave,
        atletaId: lancamento.atletaId,
        data: lancamento.dataTreino,
        tipo,
        descricao: lancamento.descricaoLote || lancamento.regraDesc,
        pontos: lancamento.pontos,
        km,
      });
      continue;
    }

    atual.pontos += lancamento.pontos;
    atual.km = Math.max(atual.km, km);
    if (tipo === "treino") atual.tipo = "treino";
  }

  return [...porChave.values()];
}
