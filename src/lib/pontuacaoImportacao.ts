import { collection, doc, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { logAudit } from "@/lib/audit";
import { atualizarRankingAutomaticamente } from "@/lib/rankingAutoUpdate";
import type { AtletaDoc, TipoLancamento } from "@/lib/types";
import type { LinhaImportacao } from "@/app/gestao/pontuacao/RevisarImportacaoModal";
export { analisarDuplicidade, chaveDuplicidade } from "@/lib/duplicidadeImportacao";

// Cada atleta pode gerar duas escritas (privada + pública) no mesmo batch.
export const TAMANHO_LOTE = 200;

export interface LinhaParaGravar extends LinhaImportacao {
  equipe: AtletaDoc["equipe"];
  regraId: string;
  tipo: TipoLancamento;
  km?: number;
  /** Quando true, "data" só carrega o mês certo (dia 01 por convenção) — o dia exato não é conhecido. */
  dataAproximada?: boolean;
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
      batch.set(atletaPublicoRef(atletaId), { pontuacaoTotal: increment(pontos) }, { merge: true });
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

  return {
    rankingAtualizado: await atualizarRankingAutomaticamente(
      [...incrementoPorAtleta.keys()],
      acaoAudit,
    ),
  };
}
