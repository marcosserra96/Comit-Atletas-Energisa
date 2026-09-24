import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { calcularResultadosRanking, normalizarRankingPeriods } from "@/lib/rankingPeriods";
import type {
  AtletaDoc,
  HistoricoPontoDoc,
  RankingPeriodsConfigDoc,
  RankingResultadoDoc,
} from "@/lib/types";

const TAMANHO_LOTE = 400;
const LIMITE_CONSULTA_IN = 30;

function gruposDe<T>(itens: T[], tamanho: number) {
  const grupos: T[][] = [];
  for (let indice = 0; indice < itens.length; indice += tamanho) {
    grupos.push(itens.slice(indice, indice + tamanho));
  }
  return grupos;
}

async function gravarEmLotes(
  db: Firestore,
  operacoes: Array<(batch: FirebaseFirestore.WriteBatch) => void>,
) {
  for (const grupo of gruposDe(operacoes, TAMANHO_LOTE)) {
    const batch = db.batch();
    grupo.forEach((operacao) => operacao(batch));
    await batch.commit();
  }
}

function resultadosDoPeriodo(
  atletas: AtletaDoc[],
  historico: HistoricoPontoDoc[],
  config: RankingPeriodsConfigDoc,
  geracaoId: string,
  geradoEm: FirebaseFirestore.Timestamp,
) {
  const geral = calcularResultadosRanking(atletas, historico, "geral");
  const trimestral = config.trimestre.ativo
    ? calcularResultadosRanking(
        atletas,
        historico,
        "trimestre",
        config.trimestre.inicio,
        config.trimestre.fim,
      )
    : [];
  const resultados: RankingResultadoDoc[] = [...geral, ...trimestral].map((resultado) => ({
    ...resultado,
    geracaoId,
    geradoEm,
  }));
  return { geral, resultados };
}

export async function publicarRankingCompleto(params: {
  db: Firestore;
  uid: string;
  autorNome: string;
  configOverride?: RankingPeriodsConfigDoc["trimestre"];
  modo?: "automatico" | "manual";
}) {
  const { db, uid, autorNome, configOverride, modo = "manual" } = params;
  const [{ FieldValue, Timestamp }] = await Promise.all([import("firebase-admin/firestore")]);
  const configRef = db.collection("configuracoes").doc("ranking_periodos");
  const [configSnap, atletasSnap, historicoSnap, resultadosAntigosSnap] = await Promise.all([
    configRef.get(),
    db.collection("atletas").get(),
    db.collection("historico_pontos").get(),
    db.collection("ranking_resultados").get(),
  ]);
  const config = normalizarRankingPeriods(
    configSnap.exists ? (configSnap.data() as Partial<RankingPeriodsConfigDoc>) : undefined,
  );
  if (configOverride) config.trimestre = configOverride;

  const atletas = atletasSnap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as AtletaDoc,
  );
  const historico = historicoSnap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as HistoricoPontoDoc,
  );
  const geracaoId = db.collection("ranking_resultados").doc().id;
  const { geral, resultados } = resultadosDoPeriodo(
    atletas,
    historico,
    config,
    geracaoId,
    Timestamp.now(),
  );

  await gravarEmLotes(
    db,
    resultados.map(
      (resultado) => (batch) =>
        batch.set(
          db
            .collection("ranking_resultados")
            .doc(`${geracaoId}_${resultado.periodoId}_${resultado.atletaId}`),
          resultado,
        ),
    ),
  );

  const finalBatch = db.batch();
  finalBatch.set(configRef, {
    trimestre: config.trimestre,
    geracaoPublicada: geracaoId,
    rankingAtualizadoEm: FieldValue.serverTimestamp(),
    rankingAtualizacaoModo: modo,
    atualizadoEm: FieldValue.serverTimestamp(),
    atualizadoPor: uid,
  });
  finalBatch.set(db.collection("auditoria").doc(), {
    acao: "ranking_periodos_publicados",
    entidade: "configuracoes",
    entidadeId: "ranking_periodos",
    dados: {
      trimestre: config.trimestre,
      atletas: geral.length,
      resultados: resultados.length,
      geracaoId,
    },
    criadoPor: uid,
    criadoPorNome: autorNome,
    criadoEm: FieldValue.serverTimestamp(),
  });
  await finalBatch.commit();

  await gravarEmLotes(
    db,
    resultadosAntigosSnap.docs.map((item) => (batch) => batch.delete(item.ref)),
  );

  return { geracaoId, atletas: geral.length, resultados: resultados.length };
}

async function carregarDadosDosAtletas(db: Firestore, atletaIds: string[]) {
  const [atletasPorGrupo, historicosSnaps] = await Promise.all([
    Promise.all(
      gruposDe(atletaIds, 200).map((grupo) =>
        db.getAll(...grupo.map((id) => db.collection("atletas").doc(id))),
      ),
    ),
    Promise.all(
      gruposDe(atletaIds, LIMITE_CONSULTA_IN).map((grupo) =>
        db.collection("historico_pontos").where("atletaId", "in", grupo).get(),
      ),
    ),
  ]);
  const atletas = atletasPorGrupo
    .flat()
    .filter((item) => item.exists)
    .map((item) => ({ id: item.id, ...item.data() }) as AtletaDoc);
  const historico = historicosSnaps.flatMap((snap) =>
    snap.docs.map((item) => ({ id: item.id, ...item.data() }) as HistoricoPontoDoc),
  );
  return { atletas, historico };
}

export async function atualizarRankingDosAtletas(params: {
  db: Firestore;
  uid: string;
  autorNome: string;
  atletaIds: string[];
  origem?: string;
  tentativa?: number;
}) {
  const { db, uid, autorNome, tentativa = 0 } = params;
  const atletaIds = [...new Set(params.atletaIds.filter(Boolean))];
  if (atletaIds.length === 0) return { geracaoId: null, atletas: 0, resultados: 0 };

  const [{ FieldValue, Timestamp }] = await Promise.all([import("firebase-admin/firestore")]);
  const configRef = db.collection("configuracoes").doc("ranking_periodos");
  const configSnap = await configRef.get();
  const config = normalizarRankingPeriods(
    configSnap.exists ? (configSnap.data() as Partial<RankingPeriodsConfigDoc>) : undefined,
  );

  if (!config.geracaoPublicada) {
    return publicarRankingCompleto({ db, uid, autorNome, modo: "automatico" });
  }

  const geracaoId = config.geracaoPublicada;
  const requisicaoId = db.collection("ranking_recalculos").doc().id;
  await gravarEmLotes(
    db,
    atletaIds.map(
      (atletaId) => (batch) =>
        batch.set(db.collection("ranking_recalculos").doc(atletaId), {
          requisicaoId,
          solicitadoEm: FieldValue.serverTimestamp(),
        }),
    ),
  );
  const { atletas, historico } = await carregarDadosDosAtletas(db, atletaIds);
  const { resultados } = resultadosDoPeriodo(
    atletas,
    historico,
    config,
    geracaoId,
    Timestamp.now(),
  );
  const resultadoPorChave = new Map(
    resultados.map((resultado) => [`${resultado.periodoId}_${resultado.atletaId}`, resultado]),
  );
  const periodos = config.trimestre.ativo ? (["geral", "trimestre"] as const) : (["geral"] as const);
  let atletasAtualizados = 0;
  for (const grupo of gruposDe(atletaIds, 100)) {
    atletasAtualizados += await db.runTransaction(async (transaction) => {
      const locks = await Promise.all(
        grupo.map((atletaId) =>
          transaction.get(db.collection("ranking_recalculos").doc(atletaId)),
        ),
      );
      let atualizadosNoGrupo = 0;

      grupo.forEach((atletaId, indice) => {
        if (locks[indice].data()?.requisicaoId !== requisicaoId) return;
        atualizadosNoGrupo += 1;
        for (const periodoId of periodos) {
          const chave = `${periodoId}_${atletaId}`;
          const ref = db.collection("ranking_resultados").doc(`${geracaoId}_${chave}`);
          const resultado = resultadoPorChave.get(chave);
          if (resultado) transaction.set(ref, resultado);
          else transaction.delete(ref);
        }
        if (!config.trimestre.ativo) {
          transaction.delete(
            db
              .collection("ranking_resultados")
              .doc(`${geracaoId}_trimestre_${atletaId}`),
          );
        }
      });

      return atualizadosNoGrupo;
    });
  }

  if (atletasAtualizados > 0) {
    await configRef.set(
      {
        rankingAtualizadoEm: FieldValue.serverTimestamp(),
        rankingAtualizacaoModo: "automatico",
        rankingAtualizacaoOrigem: params.origem || "alteracao_pontuacao",
      },
      { merge: true },
    );
  }

  const configAtualSnap = await configRef.get();
  if (configAtualSnap.data()?.geracaoPublicada !== geracaoId && tentativa < 1) {
    return atualizarRankingDosAtletas({ ...params, tentativa: tentativa + 1 });
  }

  return { geracaoId, atletas: atletasAtualizados, resultados: resultados.length };
}
