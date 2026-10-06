import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { hojeBrasil, normalizarCalendario, planoDoCalendario, somarDias } from "@/lib/calendarioPremiacao";
import { normalizarRankingPeriods } from "@/lib/rankingPeriods";
import { normalizarRankingVisibility } from "@/lib/rankingVisibility";
import type { RankingPeriodsConfigDoc, RankingVisibilityConfigDoc } from "@/lib/types";

/** Meia-noite de Brasília (UTC−3, sem horário de verão) de uma data civil. */
function inicioDoDiaBrasil(iso: string) {
  return new Date(`${iso}T03:00:00.000Z`);
}
function fimDoDiaBrasil(iso: string) {
  return new Date(inicioDoDiaBrasil(somarDias(iso, 1)).getTime() - 1);
}

/**
 * Aplica o calendário de premiação: troca o trimestre do ranking (republicando
 * os resultados) e programa a ocultação nas duas modalidades. Idempotente:
 * sem mudança, só lê três documentos.
 */
export async function sincronizarCalendario(db: Firestore, autor: { uid: string; nome: string }) {
  const [calSnap, periodosSnap, visSnap] = await Promise.all([
    db.collection("configuracoes").doc("calendario_premiacao").get(),
    db.collection("configuracoes").doc("ranking_periodos").get(),
    db.collection("configuracoes").doc("ranking_visibilidade").get(),
  ]);
  const cal = normalizarCalendario(calSnap.data() as never);
  if (!cal.ativo) return { aplicado: false as const, motivo: "calendario_desligado" };

  const hoje = hojeBrasil();
  const plano = planoDoCalendario(cal, hoje);
  const alteracoes: string[] = [];

  // 1. Trimestre do ranking
  const periodos = normalizarRankingPeriods(periodosSnap.data() as Partial<RankingPeriodsConfigDoc> | undefined);
  const atual = periodos.trimestre;
  const mudouTrimestre =
    atual.ativo !== plano.trimestre.ativo ||
    (plano.trimestre.ativo &&
      (atual.nome !== plano.trimestre.nome || atual.inicio !== plano.trimestre.inicio || atual.fim !== plano.trimestre.fim));
  if (mudouTrimestre) {
    const { publicarRankingCompleto } = await import("@/lib/server/rankingPublisher");
    await publicarRankingCompleto({ db, uid: autor.uid, autorNome: autor.nome, configOverride: plano.trimestre, modo: "automatico" });
    alteracoes.push(plano.trimestre.ativo ? `trimestre:${plano.trimestre.nome}` : "trimestre:nenhum");
  }

  // 2. Ocultação (as regras do Firestore leem os horários exatos)
  const vis = normalizarRankingVisibility(visSnap.data() as Partial<RankingVisibilityConfigDoc> | undefined);
  const alvo = plano.ocultacao
    ? { ativo: true, inicio: plano.ocultacao.inicio, fim: plano.ocultacao.fim, mensagem: cal.mensagem.trim() }
    : { ativo: false, inicio: "", fim: "", mensagem: cal.mensagem.trim() };
  const igual = (p: RankingVisibilityConfigDoc["corrida"]) =>
    p.ativo === alvo.ativo && p.inicio === alvo.inicio && p.fim === alvo.fim && p.mensagem.trim() === alvo.mensagem;
  if (!igual(vis.corrida) || !igual(vis.bicicleta)) {
    const { Timestamp, FieldValue } = await import("firebase-admin/firestore");
    const periodo = {
      ...alvo,
      inicioEm: alvo.inicio ? Timestamp.fromDate(inicioDoDiaBrasil(alvo.inicio)) : null,
      fimEm: alvo.fim ? Timestamp.fromDate(fimDoDiaBrasil(alvo.fim)) : null,
    };
    const batch = db.batch();
    batch.set(db.collection("configuracoes").doc("ranking_visibilidade"), {
      exibirParaAtletas: vis.exibirParaAtletas,
      corrida: periodo,
      bicicleta: periodo,
      origem: "calendario",
      atualizadoEm: FieldValue.serverTimestamp(),
      atualizadoPor: autor.uid,
    });
    batch.set(db.collection("auditoria").doc(), {
      acao: "ocultacao_ranking_pelo_calendario",
      entidade: "configuracoes",
      entidadeId: "ranking_visibilidade",
      dados: { ...alvo, trimestre: plano.ocultacao?.trimestreNome ?? null },
      criadoPor: autor.uid,
      criadoPorNome: autor.nome,
      criadoEm: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    alteracoes.push(alvo.ativo ? `ocultacao:${alvo.inicio}..${alvo.fim}` : "ocultacao:nenhuma");
  }

  return { aplicado: true as const, hoje, alteracoes, plano };
}
