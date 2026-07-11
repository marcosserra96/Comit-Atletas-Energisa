import { collection, doc, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAudit } from "@/lib/audit";
import type { AtletaDoc, TipoLancamento } from "@/lib/types";
import type { LinhaDuplicada, LinhaImportacao } from "@/app/gestao/pontuacao/RevisarImportacaoModal";

export const TAMANHO_LOTE = 400;

export interface LinhaParaGravar extends LinhaImportacao {
  equipe: AtletaDoc["equipe"];
  regraId: string;
  tipo: TipoLancamento;
  km?: number;
  /** Quando true, "data" só carrega o mês certo (dia 01 por convenção) — o dia exato não é conhecido. */
  dataAproximada?: boolean;
}

export function chaveDuplicidade(atletaId: string, data: string, regraId: string) {
  return `${atletaId}|${data}|${regraId}`;
}

/**
 * Separa candidatas (já validadas e com numeroLinha único) em prontas pra importar
 * e possíveis duplicatas, comparando contra o histórico existente e entre si.
 */
export function analisarDuplicidade(
  candidatas: LinhaParaGravar[],
  chavesExistentes: Set<string>,
): { validas: LinhaImportacao[]; duplicadas: LinhaDuplicada[]; paraGravar: Map<number, LinhaParaGravar> } {
  const validas: LinhaImportacao[] = [];
  const duplicadas: LinhaDuplicada[] = [];
  const paraGravar = new Map<number, LinhaParaGravar>();
  const chavesVistas = new Map<string, number>();

  candidatas.forEach((item) => {
    paraGravar.set(item.numeroLinha, item);
    const chave = chaveDuplicidade(item.atletaId, item.data, item.regraId);
    const linhaAnterior = chavesVistas.get(chave);
    if (chavesExistentes.has(chave)) {
      duplicadas.push({ ...item, motivo: `Já existe um lançamento igual em ${item.data.split("-").reverse().join("/")}` });
    } else if (linhaAnterior) {
      duplicadas.push({ ...item, motivo: `Repetida na própria planilha (linha ${linhaAnterior})` });
    } else {
      validas.push(item);
    }
    chavesVistas.set(chave, item.numeroLinha);
  });

  return { validas, duplicadas, paraGravar };
}

/** Grava em lotes de até 500 operações (limite do Firestore), ajustando o total de pontos por atleta. */
export async function gravarLancamentos(params: {
  linhas: LinhaParaGravar[];
  uid: string;
  autorNome: string;
  acaoAudit: string;
  dadosAudit?: Record<string, unknown>;
}) {
  const { linhas, uid, autorNome, acaoAudit, dadosAudit } = params;
  const loteIdComum = doc(collection(db, "historico_pontos")).id;
  const incrementoPorAtleta = new Map<string, number>();

  for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
    const grupo = linhas.slice(i, i + TAMANHO_LOTE);
    const batch = writeBatch(db);
    grupo.forEach((linha) => {
      const ref = doc(collection(db, "historico_pontos"));
      // Lançamentos com data aproximada representam sessões distintas (sem dia certo) —
      // cada um ganha seu próprio loteId, senão contariam como um treino só nas estatísticas
      // que somam "treinos" por loteId distinto.
      const loteId = linha.dataAproximada ? doc(collection(db, "historico_pontos")).id : loteIdComum;
      batch.set(ref, {
        id: ref.id,
        atletaId: linha.atletaId,
        atletaNome: linha.atletaNome,
        equipe: linha.equipe,
        regraId: linha.regraId,
        regraDesc: linha.regraDesc,
        pontos: linha.pontos,
        ...(linha.km ? { kmPercorrido: linha.km } : {}),
        ...(linha.dataAproximada ? { dataAproximada: true } : {}),
        tipoLancamento: linha.tipo,
        dataTreino: linha.data,
        loteId,
        criadoPor: uid,
        criadoPorNome: autorNome,
        criadoEm: serverTimestamp(),
        estornado: false,
      });
      incrementoPorAtleta.set(linha.atletaId, (incrementoPorAtleta.get(linha.atletaId) ?? 0) + linha.pontos);
    });
    await batch.commit();
  }

  const atletaIds = [...incrementoPorAtleta.entries()];
  for (let i = 0; i < atletaIds.length; i += TAMANHO_LOTE) {
    const grupo = atletaIds.slice(i, i + TAMANHO_LOTE);
    const batch = writeBatch(db);
    grupo.forEach(([atletaId, pontos]) => {
      batch.update(doc(db, "atletas", atletaId), {
        pontuacaoTotal: increment(pontos),
        atualizadoEm: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  if (linhas.length > 0) {
    await logAudit({
      acao: acaoAudit,
      entidade: "historico_pontos",
      entidadeId: loteIdComum,
      dados: { criados: linhas.length, ...dadosAudit },
      criadoPor: uid,
      criadoPorNome: autorNome,
    });
  }
}
