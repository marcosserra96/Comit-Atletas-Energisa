import { dataIsoLocal } from "./date";
import type { NoticiaDoc } from "./types";

/**
 * Uma notícia aparece para os atletas até o fim do dia em `visivelAte` (inclusive).
 * Sem data, ela fica publicada até ser removida.
 */
export function noticiaVisivel(
  noticia: Pick<NoticiaDoc, "visivelAte">,
  hoje: string = dataIsoLocal(),
): boolean {
  return !noticia.visivelAte || noticia.visivelAte >= hoje;
}

/** Texto do corpo só quando ele acrescenta algo ao resumo. */
export function corpoDaNoticia(noticia: Pick<NoticiaDoc, "resumo" | "corpo">): string | null {
  const corpo = noticia.corpo?.trim();
  if (!corpo || corpo === noticia.resumo?.trim()) return null;
  return corpo;
}
