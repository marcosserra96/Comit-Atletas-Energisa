"use client";

import { useSyncExternalStore } from "react";

/**
 * Fotos da retrospectiva: escolhidas de uma pasta do computador e mantidas só
 * na memória desta aba (endereços blob:). Nada é enviado ao portal; ao fechar
 * ou recarregar a página, é preciso escolher a pasta de novo.
 */

export interface FotoRetrospectiva {
  url: string;
  nome: string;
}

const fotos = new Map<string, FotoRetrospectiva[]>();
const ouvintes = new Set<() => void>();
const VAZIO: FotoRetrospectiva[] = [];

/** Formatos que o navegador mostra (HEIC do iPhone fica de fora: precisa converter antes). */
export function ehFotoExibivel(arquivo: Pick<File, "type" | "name">) {
  if (/^image\/(jpeg|png|webp|gif|avif)$/.test(arquivo.type)) return true;
  return !arquivo.type && /\.(jpe?g|png|webp|gif|avif)$/i.test(arquivo.name);
}

/** Ordem das fotos: pela data do arquivo (a ordem em que foram tiradas, quase sempre) e, empatando, pelo nome. */
export function ordenarArquivos<T extends Pick<File, "name" | "lastModified">>(arquivos: readonly T[]) {
  return [...arquivos].sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
}

export function definirFotos(livreId: string, arquivos: FileList | File[]) {
  const lista = ordenarArquivos(Array.from(arquivos).filter(ehFotoExibivel));
  fotos.get(livreId)?.forEach((f) => URL.revokeObjectURL(f.url));
  fotos.set(
    livreId,
    lista.map((a) => ({ url: URL.createObjectURL(a), nome: a.name })),
  );
  ouvintes.forEach((o) => o());
  return { aceitas: lista.length, ignoradas: Array.from(arquivos).length - lista.length };
}

export function limparFotos(livreId: string) {
  fotos.get(livreId)?.forEach((f) => URL.revokeObjectURL(f.url));
  fotos.delete(livreId);
  ouvintes.forEach((o) => o());
}

function assinar(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function useFotosRetrospectiva(livreId: string) {
  return useSyncExternalStore(
    assinar,
    () => fotos.get(livreId) ?? VAZIO,
    () => VAZIO,
  );
}
