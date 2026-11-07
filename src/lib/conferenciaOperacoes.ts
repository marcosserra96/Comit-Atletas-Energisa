"use client";

import { collection, doc, getDoc, getDocs, increment, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addAuditToBatch } from "@/lib/audit";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { atualizarRankingAutomaticamente } from "@/lib/rankingAutoUpdate";
import { estornarLancamentos, type Autor } from "@/lib/lancamentosOperacoes";
import { somaEsperada, type GrupoRepetido } from "@/lib/conferenciaPontos";
import type { HistoricoMensalDoc, HistoricoPontoDoc } from "@/lib/types";

/**
 * Correções da Conferência de pontos. Cada total é refeito na hora, direto do
 * banco (não da tela), e gravado como diferença (increment): um lançamento feito
 * por outra pessoa enquanto a tela estava aberta continua contando.
 */
export async function corrigirTotais(atletaIds: readonly string[], autor: Autor) {
  let corrigidos = 0;
  for (const atletaId of atletaIds) {
    const [atletaSnap, publicoSnap, lancSnap, resumosSnap] = await Promise.all([
      getDoc(doc(db, "atletas", atletaId)),
      getDoc(atletaPublicoRef(atletaId)),
      getDocs(query(collection(db, "historico_pontos"), where("atletaId", "==", atletaId))),
      getDocs(query(collection(db, "historico_mensal"), where("atletaId", "==", atletaId))),
    ]);
    if (!atletaSnap.exists()) continue;
    const esperado = somaEsperada(
      lancSnap.docs.map((d) => d.data() as HistoricoPontoDoc),
      resumosSnap.docs.map((d) => d.data() as HistoricoMensalDoc),
    );
    const salvo = Number(atletaSnap.data().pontuacaoTotal) || 0;
    const salvoPublico = publicoSnap.exists() ? Number(publicoSnap.data().pontuacaoTotal) || 0 : null;
    if (salvo === esperado && (salvoPublico === null || salvoPublico === esperado)) continue;

    const batch = writeBatch(db);
    if (salvo !== esperado) {
      batch.update(doc(db, "atletas", atletaId), { pontuacaoTotal: increment(esperado - salvo), atualizadoEm: serverTimestamp() });
    }
    if (salvoPublico !== null && salvoPublico !== esperado) {
      batch.set(atletaPublicoRef(atletaId), { pontuacaoTotal: increment(esperado - salvoPublico) }, { merge: true });
    }
    addAuditToBatch(batch, {
      acao: "corrigir_total_pontos",
      entidade: "atletas",
      entidadeId: atletaId,
      dados: { antes: salvo, depois: esperado, rankingAntes: salvoPublico, nome: String(atletaSnap.data().nome ?? "") },
      criadoPor: autor.uid,
      criadoPorNome: autor.nome,
    });
    await batch.commit();
    corrigidos += 1;
  }
  const rankingAtualizado = corrigidos > 0 ? await atualizarRankingAutomaticamente([...atletaIds], "conferencia_pontos") : true;
  return { corrigidos, rankingAtualizado };
}

/** Estorna as cópias e mantém o lançamento mais antigo. O estorno fica no extrato e pode ser consultado. */
export function estornarRepeticao(grupo: GrupoRepetido, autor: Autor) {
  return estornarLancamentos(grupo.lancamentos.slice(1), "Lançamento repetido (conferência de pontos)", autor, "conferencia_pontos");
}

/** "Está certo": dois lançamentos iguais no mesmo dia que são mesmo dois (ex.: treino de manhã e à noite). */
export async function marcarRepeticaoConferida(grupo: GrupoRepetido, autor: Autor) {
  const batch = writeBatch(db);
  grupo.lancamentos.forEach((l) => batch.update(doc(db, "historico_pontos", l.id), { repeticaoConferida: true }));
  addAuditToBatch(batch, {
    acao: "conferir_repeticao",
    entidade: "historico_pontos",
    entidadeId: grupo.lancamentos[0].id,
    dados: { atletaId: grupo.atletaId, data: grupo.data, quantidade: grupo.lancamentos.length },
    criadoPor: autor.uid,
    criadoPorNome: autor.nome,
  });
  await batch.commit();
}

/** "Está certo": o resumo mensal cobre só a parte do mês que não tem lançamento. */
export async function marcarResumoConferido(resumoId: string, autor: Autor) {
  const batch = writeBatch(db);
  batch.update(doc(db, "historico_mensal", resumoId), { conferidoComLancamentos: true });
  addAuditToBatch(batch, {
    acao: "conferir_resumo_mensal",
    entidade: "historico_mensal",
    entidadeId: resumoId,
    criadoPor: autor.uid,
    criadoPorNome: autor.nome,
  });
  await batch.commit();
}
