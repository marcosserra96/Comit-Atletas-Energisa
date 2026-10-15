/**
 * Controle da apresentação pelo celular. O notebook abre uma sessão; o celular
 * (de alguém do comitê) manda comandos e lê o estado. Tudo passa pelo servidor
 * (coleção só do servidor), sem regra nova no Firestore.
 */
export type ComandoRemoto = "proximo" | "anterior" | "acao" | "ola";

export interface EstadoRemoto {
  indice: number;
  total: number;
  rotulo: string;
  proximo: string;
  nota: string;
  /** Botão extra do slide atual (ex.: "Sortear"). */
  acao: { rotulo: string; desabilitado: boolean } | null;
}

export interface RespostaControle {
  seq: number;
  comandos: { seq: number; comando: ComandoRemoto }[];
  estado: EstadoRemoto | null;
  /** Sessão encerrada ou vencida. */
  encerrada: boolean;
}

export const COMANDOS: readonly ComandoRemoto[] = ["proximo", "anterior", "acao", "ola"];
export const VALIDADE_SESSAO_MS = 6 * 3600_000;

/** Limpa o estado vindo do notebook antes de gravar. */
export function validarEstado(e: unknown): EstadoRemoto | null {
  if (!e || typeof e !== "object") return null;
  const v = e as Partial<EstadoRemoto>;
  const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
  const txt = (t: unknown, max: number) => (typeof t === "string" ? t.slice(0, max) : "");
  return {
    indice: num(v.indice),
    total: num(v.total),
    rotulo: txt(v.rotulo, 120),
    proximo: txt(v.proximo, 120),
    nota: txt(v.nota, 2000),
    acao: v.acao && typeof v.acao === "object" ? { rotulo: txt(v.acao.rotulo, 40), desabilitado: v.acao.desabilitado === true } : null,
  };
}

/** Comandos novos (depois de `depois`), na ordem. */
export function comandosDepois(lista: readonly { seq: number; comando: ComandoRemoto }[], depois: number) {
  return lista.filter((c) => c.seq > depois).sort((a, b) => a.seq - b.seq);
}
