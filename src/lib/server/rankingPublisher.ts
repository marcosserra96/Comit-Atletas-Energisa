import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import {
  calcularResultadosRanking,
  competenciaAtualBrasil,
  limitesDaCompetencia,
  normalizarRankingPeriods,
} from "@/lib/rankingPeriods";
import { regrasDeTreino, type RegrasDeTreino } from "@/lib/activityConsolidation";
import type {
  AtletaDoc,
  HistoricoMensalDoc,
  HistoricoPontoDoc,
  RankingPeriodKey,
  RankingPeriodsConfigDoc,
  RankingResultadoDoc,
  RegraPontuacaoDoc,
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

/** Critérios que contam como treino (mesma regra das telas do portal). */
async function carregarRegrasDeTreino(db: Firestore): Promise<RegrasDeTreino> {
  const snap = await db.collection("regras_pontuacao").get();
  return regrasDeTreino(snap.docs.map((d) => ({ ...(d.data() as RegraPontuacaoDoc), id: d.id })));
}

function resultadosDoPeriodo(
  atletas: AtletaDoc[],
  historico: HistoricoPontoDoc[],
  resumosMensais: HistoricoMensalDoc[],
  config: RankingPeriodsConfigDoc,
  geracaoId: string,
  geradoEm: FirebaseFirestore.Timestamp,
  regrasTreino: RegrasDeTreino,
) {
  const geral = calcularResultadosRanking(atletas, historico, "geral", undefined, undefined, resumosMensais, regrasTreino);
  const trimestral = config.trimestre.ativo
    ? calcularResultadosRanking(
        atletas,
        historico,
        "trimestre",
        config.trimestre.inicio,
        config.trimestre.fim,
        resumosMensais,
        regrasTreino,
      )
    : [];
  // Ranking do mês corrente; a competência fica gravada para a tela saber quando o mês virou.
  const competencia = competenciaAtualBrasil();
  const { inicio, fim } = limitesDaCompetencia(competencia);
  const mensal = calcularResultadosRanking(atletas, historico, "mes", inicio, fim, resumosMensais, regrasTreino).map(
    (resultado) => ({ ...resultado, competencia }),
  );
  const resultados: RankingResultadoDoc[] = [...geral, ...trimestral, ...mensal].map((resultado) => ({
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
  const [configSnap, atletasSnap, historicoSnap, resumosSnap, resultadosAntigosSnap, regrasTreino] = await Promise.all([
    configRef.get(),
    db.collection("atletas").get(),
    db.collection("historico_pontos").get(),
    db.collection("historico_mensal").get(),
    db.collection("ranking_resultados").get(),
    carregarRegrasDeTreino(db),
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
  const resumosMensais = resumosSnap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as HistoricoMensalDoc,
  );
  const geracaoId = db.collection("ranking_resultados").doc().id;
  const { geral, resultados } = resultadosDoPeriodo(
    atletas,
    historico,
    resumosMensais,
    config,
    geracaoId,
    Timestamp.now(),
    regrasTreino,
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
    mesPublicado: true,
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
  const [atletasPorGrupo, historicosSnaps, resumosSnaps] = await Promise.all([
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
    Promise.all(
      gruposDe(atletaIds, LIMITE_CONSULTA_IN).map((grupo) =>
        db.collection("historico_mensal").where("atletaId", "in", grupo).get(),
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
  const resumosMensais = resumosSnaps.flatMap((snap) =>
    snap.docs.map((item) => ({ id: item.id, ...item.data() }) as HistoricoMensalDoc),
  );
  return { atletas, historico, resumosMensais };
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
  const [{ atletas, historico, resumosMensais }, regrasTreino] = await Promise.all([
    carregarDadosDosAtletas(db, atletaIds),
    carregarRegrasDeTreino(db),
  ]);
  const { resultados } = resultadosDoPeriodo(
    atletas,
    historico,
    resumosMensais,
    config,
    geracaoId,
    Timestamp.now(),
    regrasTreino,
  );
  const resultadoPorChave = new Map(
    resultados.map((resultado) => [`${resultado.periodoId}_${resultado.atletaId}`, resultado]),
  );
  // "mes" só depois que uma publicação completa criou o ranking do mês para todos.
  const periodos: RankingPeriodKey[] = [
    "geral",
    ...(config.trimestre.ativo ? (["trimestre"] as const) : []),
    ...(config.mesPublicado ? (["mes"] as const) : []),
  ];
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
