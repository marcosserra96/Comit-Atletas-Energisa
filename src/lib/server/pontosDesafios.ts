import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import {
  acaoDePontosDoDesafio,
  descricaoDoLancamentoDoDesafio,
  idLancamentoDoDesafio,
  modalidadesDoDesafio,
  progressoNoDesafio,
  REGRA_DESAFIO,
  type DesafioDoc,
} from "@/lib/desafios";
import type { AtletaDoc, HistoricoPontoDoc, Modalidade, RegraPontuacaoDoc } from "@/lib/types";

const AUTOR = { uid: "sistema", nome: "Desafio do comitê" };

function hojeBrasil() {
  return new Date(Date.now() - 3 * 60 * 60_000).toISOString().slice(0, 10);
}

function modalidadeDe(equipe: string): Modalidade | null {
  return equipe === "corrida" ? "corrida" : equipe === "bicicleta" ? "bicicleta" : null;
}

/**
 * Mantém os pontos dos desafios em dia com quem completou: cria o lançamento
 * "Desafio concluído" no dia em que a pessoa completou, ajusta valor e data,
 * estorna quando deixou de completar (ou o desafio foi excluído / passou a
 * valer 0) e reativa o que o próprio portal estornou. Estorno feito à mão pelo
 * comitê é respeitado. Cada mudança é uma transação (rodar duas vezes ao mesmo
 * tempo não dá pontos em dobro) e atualiza o total do atleta e o ranking.
 *
 * - `desafioIds`: só estes (ao salvar ou excluir um desafio); sem isso, todos.
 * - `atletaIds`: só estes atletas (depois de um lançamento); sem isso, todos.
 */
export async function sincronizarPontosDosDesafios(db: Firestore, filtro: { desafioIds?: string[]; atletaIds?: string[] } = {}) {
  const hoje = hojeBrasil();
  const { FieldValue } = await import("firebase-admin/firestore");

  // 1. Desafios: os pedidos (inclusive os excluídos) ou todos.
  const desafios = new Map<string, DesafioDoc | null>();
  if (filtro.desafioIds?.length) {
    const docs = await db.getAll(...filtro.desafioIds.map((id) => db.collection("desafios").doc(id)));
    docs.forEach((d, i) => desafios.set(filtro.desafioIds![i], d.exists ? ({ ...(d.data() as Omit<DesafioDoc, "id">), id: d.id }) : null));
  } else {
    const snap = await db.collection("desafios").orderBy("inicio", "desc").limit(100).get();
    snap.docs.forEach((d) => desafios.set(d.id, { ...(d.data() as Omit<DesafioDoc, "id">), id: d.id }));
  }

  // 2. Lançamentos de desafio que já existem (poucos: um por atleta que completou).
  const existentesSnap = await db.collection("historico_pontos").where("regraId", "==", REGRA_DESAFIO).get();
  const existentes = new Map(
    existentesSnap.docs
      .map((d) => d.data() as HistoricoPontoDoc & { desafioId?: string; estornoAutomatico?: boolean })
      .filter((l) => l.desafioId && desafios.has(l.desafioId) && (!filtro.atletaIds || filtro.atletaIds.includes(l.atletaId)))
      .map((l) => [idLancamentoDoDesafio(l.desafioId!, l.atletaId), l]),
  );

  // 3. Quem completou: só os desafios que valem pontos e já começaram.
  const comPontos = [...desafios.values()].filter((d): d is DesafioDoc => !!d && (d.pontos ?? 0) > 0 && d.inicio <= hoje);
  const deveria = new Map<string, { desafio: DesafioDoc; atleta: AtletaDoc; concluidoEm: string | null }>();
  /** Pares atleta × desafio que foram de fato avaliados agora. */
  const avaliados = new Set<string>();
  if (comPontos.length) {
    const inicio = comPontos.map((d) => d.inicio).sort()[0];
    const fim = comPontos.map((d) => (d.fim < hoje ? d.fim : hoje)).sort().at(-1)!;
    const [atletasSnap, lancSnap, regrasSnap] = await Promise.all([
      db.collection("atletas").where("equipe", "in", ["corrida", "bicicleta"]).get(),
      db.collection("historico_pontos").where("dataTreino", ">=", inicio).where("dataTreino", "<=", fim).get(),
      db.collection("regras_pontuacao").get(),
    ]);
    const { regrasDeTreino } = await import("@/lib/activityConsolidation");
    const regrasTreino = regrasDeTreino(regrasSnap.docs.map((d) => ({ ...(d.data() as RegraPontuacaoDoc), id: d.id })));
    const porAtleta = new Map<string, HistoricoPontoDoc[]>();
    for (const d of lancSnap.docs) {
      const l = { ...(d.data() as HistoricoPontoDoc), id: d.id };
      if (l.regraId === REGRA_DESAFIO) continue; // os pontos do próprio desafio não contam para a meta
      porAtleta.set(l.atletaId, [...(porAtleta.get(l.atletaId) ?? []), l]);
    }
    for (const d of atletasSnap.docs) {
      const atleta = { ...(d.data() as AtletaDoc), id: d.id };
      if (filtro.atletaIds && !filtro.atletaIds.includes(atleta.id)) continue;
      if (atleta.ativo === false || atleta.visivelNasListas === false) continue;
      const modalidade = modalidadeDe(atleta.equipe);
      if (!modalidade) continue;
      for (const desafio of comPontos) {
        if (!modalidadesDoDesafio(desafio).includes(modalidade)) continue;
        avaliados.add(idLancamentoDoDesafio(desafio.id, atleta.id));
        const progresso = progressoNoDesafio({ desafio, modalidade, lancamentos: porAtleta.get(atleta.id) ?? [], regrasTreino, hoje });
        if (progresso?.concluidoEm) deveria.set(idLancamentoDoDesafio(desafio.id, atleta.id), { desafio, atleta, concluidoEm: progresso.concluidoEm });
      }
    }
  }

  // 4. Aplica: cada lançamento numa transação que relê o estado atual.
  const chaves = new Set([...deveria.keys(), ...existentes.keys()]);
  const mudancas: { atletaId: string; desafioId: string; acao: string }[] = [];
  for (const chave of chaves) {
    const alvo = deveria.get(chave);
    const antigo = existentes.get(chave);
    const desafioId = alvo?.desafio.id ?? antigo!.desafioId!;
    const desafio = desafios.get(desafioId) ?? null;
    const atletaId = alvo?.atleta.id ?? antigo!.atletaId;
    // Desafio ainda valendo pontos, mas o atleta não foi avaliado agora (ficou inativo,
    // oculto ou trocou de equipe): o que ele já ganhou fica como está.
    if (!alvo && desafio && (desafio.pontos ?? 0) > 0 && desafio.inicio <= hoje && !avaliados.has(chave)) continue;
    // Sem nada a fazer pelo que já foi lido, nem abre a transação.
    const previa = acaoDePontosDoDesafio({
      pontos: desafio ? (desafio.pontos ?? 0) : null,
      concluidoEm: alvo?.concluidoEm ?? null,
      existente: antigo ? { estornado: antigo.estornado, estornoAutomatico: antigo.estornoAutomatico, pontos: antigo.pontos, dataTreino: antigo.dataTreino } : null,
    });
    if (!previa) continue;
    const ref = db.collection("historico_pontos").doc(chave);
    const atletaRef = db.collection("atletas").doc(atletaId);
    const publicoRef = db.collection("atletas_publicos").doc(atletaId);
    const feito = await db.runTransaction(async (tx) => {
      // Firestore: todas as leituras antes de qualquer escrita.
      const [snap, atletaSnap, publicoSnap] = await Promise.all([tx.get(ref), tx.get(atletaRef), tx.get(publicoRef)]);
      const atual = snap.exists ? (snap.data() as HistoricoPontoDoc & { estornoAutomatico?: boolean }) : null;
      const acao = acaoDePontosDoDesafio({
        pontos: desafio ? (desafio.pontos ?? 0) : null,
        concluidoEm: alvo?.concluidoEm ?? null,
        existente: atual ? { estornado: atual.estornado, estornoAutomatico: atual.estornoAutomatico, pontos: atual.pontos, dataTreino: atual.dataTreino } : null,
      });
      if (!acao) return null;
      // Quanto o total do atleta muda: o que passa a valer menos o que valia.
      const valia = atual && !atual.estornado ? atual.pontos : 0;
      const vale = acao.acao === "estornar" ? 0 : acao.pontos;
      if (acao.acao === "criar") {
        const atleta = alvo!.atleta;
        tx.create(ref, {
          id: chave,
          atletaId,
          atletaNome: atleta.nome,
          equipe: atleta.equipe,
          regraId: REGRA_DESAFIO,
          regraDesc: descricaoDoLancamentoDoDesafio(desafio!.titulo),
          descricaoLote: desafio!.titulo,
          pontos: acao.pontos,
          tipoLancamento: "avulso",
          dataTreino: acao.data,
          loteId: `desafio_${desafioId}`,
          desafioId,
          criadoPor: AUTOR.uid,
          criadoPorNome: AUTOR.nome,
          criadoEm: FieldValue.serverTimestamp(),
          estornado: false,
        });
      } else if (acao.acao === "estornar") {
        tx.update(ref, {
          estornado: true,
          estornoAutomatico: true,
          estornadoEm: FieldValue.serverTimestamp(),
          estornadoPor: AUTOR.uid,
          motivoEstorno: acao.motivo,
        });
      } else {
        tx.update(ref, {
          pontos: acao.pontos,
          dataTreino: acao.data,
          ...(desafio ? { regraDesc: descricaoDoLancamentoDoDesafio(desafio.titulo), descricaoLote: desafio.titulo } : {}),
          ...(acao.acao === "reativar"
            ? { estornado: false, estornoAutomatico: FieldValue.delete(), estornadoEm: FieldValue.delete(), estornadoPor: FieldValue.delete(), motivoEstorno: FieldValue.delete() }
            : {}),
          atualizadoEm: FieldValue.serverTimestamp(),
        });
      }
      const delta = vale - valia;
      if (delta !== 0) {
        if (atletaSnap.exists) tx.update(atletaRef, { pontuacaoTotal: FieldValue.increment(delta), atualizadoEm: FieldValue.serverTimestamp() });
        if (publicoSnap.exists) tx.update(publicoRef, { pontuacaoTotal: FieldValue.increment(delta) });
      }
      return acao.acao;
    });
    if (feito) mudancas.push({ atletaId, desafioId, acao: feito });
  }

  // 5. Ranking publicado de quem mudou (falha aqui não desfaz os pontos).
  if (mudancas.length) {
    try {
      const { atualizarRankingDosAtletas } = await import("@/lib/server/rankingPublisher");
      await atualizarRankingDosAtletas({ db, uid: AUTOR.uid, autorNome: AUTOR.nome, atletaIds: [...new Set(mudancas.map((m) => m.atletaId))], origem: "desafio" });
    } catch (erro) {
      console.error("Pontos de desafio lançados, mas o ranking não atualizou:", erro);
    }
  }
  return mudancas;
}
