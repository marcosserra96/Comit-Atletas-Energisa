"use client";

import { arrayUnion, deleteField, doc, increment, serverTimestamp, writeBatch, type WriteBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addAuditToBatch } from "@/lib/audit";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { atualizarRankingAutomaticamente } from "@/lib/rankingAutoUpdate";
import { invalidarLancamentos } from "@/lib/lancamentosCache";
import { resumirMudancas, type EdicaoRegistrada, type MudancasLancamento } from "@/lib/extrato";
import type { HistoricoPontoDoc } from "@/lib/types";

/**
 * Estornar, excluir e editar lançamentos de pontos. Usado pelo Extrato e pela
 * ficha do atleta, para as duas telas fazerem exatamente a mesma coisa:
 * ajustar o total do atleta (e a cópia pública), registrar na auditoria no
 * mesmo envio e atualizar o ranking.
 */

export interface Autor {
  uid: string;
  nome: string;
}

const TAMANHO_LOTE = 400;

/** Grava em lotes de até 400 operações (limite do Firestore é 500). */
async function emLotes<T>(itens: readonly T[], montar: (batch: WriteBatch, item: T) => void, extra?: (batch: WriteBatch) => void) {
  for (let i = 0; i < Math.max(itens.length, 1); i += TAMANHO_LOTE) {
    const batch = writeBatch(db);
    itens.slice(i, i + TAMANHO_LOTE).forEach((item) => montar(batch, item));
    if (i === 0) extra?.(batch);
    await batch.commit();
  }
}

/** Soma a diferença de pontos no total do atleta e na cópia pública (ranking). */
function ajustarTotais(batch: WriteBatch, atletaId: string, delta: number) {
  if (!delta) return;
  batch.update(doc(db, "atletas", atletaId), { pontuacaoTotal: increment(delta), atualizadoEm: serverTimestamp() });
  batch.set(atletaPublicoRef(atletaId), { pontuacaoTotal: increment(delta) }, { merge: true });
}

function deltasPorAtleta(itens: readonly HistoricoPontoDoc[], sinal: 1 | -1) {
  const mapa = new Map<string, number>();
  for (const l of itens) mapa.set(l.atletaId, (mapa.get(l.atletaId) ?? 0) + sinal * l.pontos);
  return [...mapa.entries()];
}

const idsDosAtletas = (itens: readonly HistoricoPontoDoc[]) => [...new Set(itens.map((l) => l.atletaId))];

export async function estornarLancamentos(itens: readonly HistoricoPontoDoc[], motivo: string, autor: Autor, origem = "estorno_lancamento") {
  const validos = itens.filter((l) => !l.estornado);
  if (validos.length === 0) return true;
  const deltas = deltasPorAtleta(validos, -1);
  await emLotes(
    validos,
    (batch, l) =>
      batch.update(doc(db, "historico_pontos", l.id), {
        estornado: true,
        estornadoEm: serverTimestamp(),
        estornadoPor: autor.uid,
        motivoEstorno: motivo,
      }),
    (batch) => {
      deltas.forEach(([atletaId, delta]) => ajustarTotais(batch, atletaId, delta));
      addAuditToBatch(batch, {
        acao: validos.length === 1 ? "estornar_lancamento" : "estornar_lote",
        entidade: "historico_pontos",
        entidadeId: validos.length === 1 ? validos[0].id : validos[0].loteId || validos[0].id,
        dados: { motivo, quantidade: validos.length, pontos: validos.reduce((s, l) => s + l.pontos, 0), atletaIds: idsDosAtletas(validos).slice(0, 50) },
        criadoPor: autor.uid,
        criadoPorNome: autor.nome,
      });
    },
  );
  return atualizarRankingAutomaticamente(idsDosAtletas(validos), origem);
}

/** Só administrador: apaga de vez (os pontos ainda válidos saem do total). */
export async function excluirLancamentos(itens: readonly HistoricoPontoDoc[], autor: Autor) {
  if (itens.length === 0) return true;
  const deltas = deltasPorAtleta(itens.filter((l) => !l.estornado), -1);
  await emLotes(
    itens,
    (batch, l) => batch.delete(doc(db, "historico_pontos", l.id)),
    (batch) => {
      deltas.forEach(([atletaId, delta]) => ajustarTotais(batch, atletaId, delta));
      addAuditToBatch(batch, {
        acao: "excluir_lancamento",
        entidade: "historico_pontos",
        entidadeId: itens.length === 1 ? itens[0].id : `lote_${itens.length}_itens`,
        dados: {
          quantidade: itens.length,
          itens: itens.slice(0, 100).map((l) => ({ id: l.id, atletaNome: l.atletaNome, regraDesc: l.regraDesc, pontos: l.pontos, dataTreino: l.dataTreino })),
        },
        criadoPor: autor.uid,
        criadoPorNome: autor.nome,
      });
    },
  );
  return atualizarRankingAutomaticamente(idsDosAtletas(itens), "exclusao_lancamento");
}

function registroDeEdicao(autor: Autor, resumo: string, motivo?: string): EdicaoRegistrada {
  return { em: new Date().toISOString(), porNome: autor.nome, resumo, ...(motivo?.trim() ? { motivo: motivo.trim() } : {}) };
}

/**
 * Corrige um lançamento no lugar (sem estornar e lançar de novo). Guarda no
 * próprio lançamento o que mudou, quem mudou e quando.
 * Devolve null quando nada mudou.
 */
export async function editarLancamento(item: HistoricoPontoDoc, pedidas: MudancasLancamento, autor: Autor, motivo?: string) {
  if (item.estornado) throw new Error("Lançamento estornado não pode ser editado.");
  const { mudou, resumo, vazio } = resumirMudancas(item, pedidas);
  if (vazio) return null;
  const campos: Record<string, unknown> = {};
  if (mudou.regraId) {
    campos.regraId = mudou.regraId;
    campos.regraDesc = mudou.regraDesc;
  }
  if (mudou.pontos !== undefined) campos.pontos = mudou.pontos;
  if (mudou.dataTreino) {
    campos.dataTreino = mudou.dataTreino;
    campos.dataAproximada = deleteField(); // a data agora foi informada de verdade
  }
  if (mudou.kmPercorrido !== undefined) campos.kmPercorrido = mudou.kmPercorrido > 0 ? mudou.kmPercorrido : deleteField();
  if (mudou.observacao !== undefined) campos.observacao = mudou.observacao ? mudou.observacao : deleteField();

  const batch = writeBatch(db);
  batch.update(doc(db, "historico_pontos", item.id), {
    ...campos,
    editadoEm: serverTimestamp(),
    editadoPor: autor.uid,
    editadoPorNome: autor.nome,
    edicoes: arrayUnion(registroDeEdicao(autor, resumo, motivo)),
  });
  if (mudou.pontos !== undefined) ajustarTotais(batch, item.atletaId, mudou.pontos - item.pontos);
  addAuditToBatch(batch, {
    acao: "editar_lancamento",
    entidade: "historico_pontos",
    entidadeId: item.id,
    dados: { atletaId: item.atletaId, atletaNome: item.atletaNome, resumo, motivo: motivo?.trim() || null, antes: { regraId: item.regraId, pontos: item.pontos, dataTreino: item.dataTreino, kmPercorrido: item.kmPercorrido ?? 0 } },
    criadoPor: autor.uid,
    criadoPorNome: autor.nome,
  });
  await batch.commit();
  return { resumo, ranking: await atualizarRankingAutomaticamente([item.atletaId], "edicao_lancamento") };
}

/**
 * Corrige o lançamento inteiro (descrição e data do treino) de uma vez.
 * A descrição vale para todos; a data, só para quem ainda está valendo e não é
 * presença de reunião ou falta justificada (que seguem a própria data).
 */
export async function editarLote(itens: readonly HistoricoPontoDoc[], pedidas: { descricaoLote?: string; dataTreino?: string }, autor: Autor, motivo?: string) {
  const descricao = pedidas.descricaoLote?.trim();
  const partes: string[] = [];
  const titulo = (itens[0]?.descricaoLote ?? "").trim();
  if (descricao && descricao !== titulo) partes.push(`Descrição: ${titulo || "sem descrição"} → ${descricao}`);
  const mudaData = (l: HistoricoPontoDoc) =>
    !!pedidas.dataTreino && pedidas.dataTreino !== l.dataTreino && !l.estornado && l.tipoLancamento !== "reuniao" && l.regraId !== "falta_justificada";
  const comData = itens.filter(mudaData);
  if (comData.length) {
    const datas = [...new Set(comData.map((l) => l.dataTreino))].map((d) => d.split("-").reverse().slice(0, 2).join("/"));
    partes.push(`Data: ${datas.join(", ")} → ${pedidas.dataTreino!.split("-").reverse().slice(0, 2).join("/")}`);
  }
  if (partes.length === 0) return null;
  const resumo = partes.join(" · ");
  const edicao = registroDeEdicao(autor, resumo, motivo);
  const afetados = itens.filter((l) => (descricao && descricao !== titulo) || mudaData(l));
  await emLotes(
    afetados,
    (batch, l) =>
      batch.update(doc(db, "historico_pontos", l.id), {
        ...(descricao && descricao !== titulo ? { descricaoLote: descricao } : {}),
        ...(mudaData(l) ? { dataTreino: pedidas.dataTreino, dataAproximada: deleteField() } : {}),
        editadoEm: serverTimestamp(),
        editadoPor: autor.uid,
        editadoPorNome: autor.nome,
        edicoes: arrayUnion(edicao),
      }),
    (batch) =>
      addAuditToBatch(batch, {
        acao: "editar_lote",
        entidade: "historico_pontos",
        entidadeId: itens[0]?.loteId || itens[0]?.id || "",
        dados: { resumo, motivo: motivo?.trim() || null, quantidade: afetados.length },
        criadoPor: autor.uid,
        criadoPorNome: autor.nome,
      }),
  );
  // Só a data muda o ranking (mês e trimestre); a descrição não.
  if (!comData.length) invalidarLancamentos();
  const ranking = comData.length ? await atualizarRankingAutomaticamente(idsDosAtletas(comData), "edicao_lote") : true;
  return { resumo, ranking };
}
