import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { HistoricoPontoDoc } from "@/lib/types";

/**
 * Leitura compartilhada de `historico_pontos`.
 *
 * Cada documento lido conta na cota diária do Firestore. Várias telas da gestão
 * (Início, Consolidado, Atletas, Apresentação) precisam do histórico completo;
 * sem esta memória, cada troca de tela relia a coleção inteira e a cota
 * gratuita (50 mil leituras/dia) se esgotava em poucas horas de uso.
 *
 * A cópia vale por alguns minutos e é descartada sempre que esta aba grava
 * lançamentos (`invalidarLancamentos`). Lançamentos feitos por outra pessoa
 * aparecem em até `VALIDADE_MS`.
 */
const VALIDADE_MS = 5 * 60_000;

let cache: { promessa: Promise<HistoricoPontoDoc[]>; carregadoEm: number } | null = null;

function mapear(docs: { id: string; data: () => unknown }[]) {
  return docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as HistoricoPontoDoc);
}

/** Todos os lançamentos, reaproveitando a leitura recente quando houver. */
export function carregarTodosLancamentos(): Promise<HistoricoPontoDoc[]> {
  if (cache && Date.now() - cache.carregadoEm < VALIDADE_MS) return cache.promessa;
  const promessa = getDocs(collection(db, "historico_pontos")).then((snap) => mapear(snap.docs));
  const entrada = { promessa, carregadoEm: Date.now() };
  cache = entrada;
  // Falhou: não guarda o erro, a próxima tela tenta de novo.
  promessa.catch(() => {
    if (cache === entrada) cache = null;
  });
  return promessa;
}

/**
 * Lançamentos com data de treino entre `de` e `ate` (YYYY-MM-DD, inclusive).
 * Lê só o período; se o histórico completo já estiver em memória, filtra dele.
 */
export async function carregarLancamentosDoPeriodo(de: string, ate: string): Promise<HistoricoPontoDoc[]> {
  if (cache && Date.now() - cache.carregadoEm < VALIDADE_MS) {
    const todos = await cache.promessa.catch(() => null);
    if (todos) return todos.filter((l) => l.dataTreino >= de && l.dataTreino <= ate);
  }
  const snap = await getDocs(
    query(collection(db, "historico_pontos"), where("dataTreino", ">=", de), where("dataTreino", "<=", ate)),
  );
  return mapear(snap.docs);
}

/** Chamar depois de criar, editar, estornar ou excluir lançamentos. */
export function invalidarLancamentos() {
  cache = null;
}
