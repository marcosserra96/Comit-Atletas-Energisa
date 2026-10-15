/**
 * Enquete ao vivo na reunião: uma pergunta de escolha única, publicada como
 * pesquisa (os atletas votam pelo app) e contada em tempo real no telão.
 */
import type { PesquisaDoc, RespostaPesquisaDoc } from "@/lib/pesquisas";

export const ID_PERGUNTA_ENQUETE = "p1";
export const MAX_OPCOES_ENQUETE = 6;
/** Fica aberta por 2 h, a não ser que o apresentador encerre antes. */
export const DURACAO_ENQUETE_MS = 2 * 3600_000;

export function opcoesDaEnquete(texto: string) {
  const vistas = new Set<string>();
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !vistas.has(l.toLowerCase()) && vistas.add(l.toLowerCase()))
    .slice(0, MAX_OPCOES_ENQUETE);
}

/** Documento da pesquisa que representa a enquete. */
export function pesquisaDaEnquete(params: { id: string; pergunta: string; opcoes: string[]; agora: Date; uid: string; nome: string }): Omit<PesquisaDoc, "abreEmTs" | "fechaEmTs"> {
  // Um minuto antes: relógios de celulares e do servidor nunca batem exatos.
  const abre = new Date(params.agora.getTime() - 60_000);
  const fecha = new Date(params.agora.getTime() + DURACAO_ENQUETE_MS);
  return {
    id: params.id,
    titulo: params.pergunta.trim().slice(0, 140) || "Enquete da reunião",
    descricao: "Enquete da reunião de resultados. Vote: o resultado aparece no telão na hora.",
    perguntas: [{ id: ID_PERGUNTA_ENQUETE, tipo: "unica", enunciado: params.pergunta.trim().slice(0, 300) || "Qual a sua opinião?", opcoes: params.opcoes, obrigatoria: true }],
    publico: "todos",
    abreEm: abre.toISOString(),
    fechaEm: fecha.toISOString(),
    publicada: true,
    semAviso: true,
    origem: "reuniao",
    criadoPor: params.uid,
    criadoPorNome: params.nome,
  };
}

export interface VotosEnquete {
  /** Votos por opção, na ordem das opções do slide. */
  votos: number[];
  total: number;
}

/** Conta os votos pelas opções do slide (uma opção trocada depois perde os votos antigos). */
export function contarVotos(opcoes: readonly string[], respostas: readonly Pick<RespostaPesquisaDoc, "respostas">[]): VotosEnquete {
  const indice = new Map(opcoes.map((o, i) => [o.toLowerCase(), i]));
  const votos = opcoes.map(() => 0);
  let total = 0;
  for (const r of respostas) {
    const v = r.respostas?.[ID_PERGUNTA_ENQUETE];
    if (typeof v !== "string") continue;
    total += 1;
    const i = indice.get(v.toLowerCase());
    if (i !== undefined) votos[i] += 1;
  }
  return { votos, total };
}

/** Percentuais inteiros que somam 100 (maiores restos). */
export function percentuais(votos: readonly number[]) {
  const total = votos.reduce((a, b) => a + b, 0);
  if (!total) return votos.map(() => 0);
  const brutos = votos.map((v) => (v * 100) / total);
  const base = brutos.map(Math.floor);
  let falta = 100 - base.reduce((a, b) => a + b, 0);
  const ordem = brutos.map((b, i) => [b - Math.floor(b), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of ordem) {
    if (falta <= 0) break;
    base[i] += 1;
    falta -= 1;
  }
  return base;
}
