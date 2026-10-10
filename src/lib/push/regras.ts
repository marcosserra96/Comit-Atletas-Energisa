/**
 * Regras das notificações push que valem no servidor e no portal (sem Firebase).
 */

/** "selecionados": pessoas escolhidas uma a uma pelo comitê. */
export type PublicoPush = "todos" | "corrida" | "bicicleta" | "selecionados";

/** Limite de pessoas escolhidas num envio individual. */
export const LIMITE_SELECIONADOS = 300;

/** Para onde a notificação leva ao ser tocada (só rotas do próprio portal). */
export const DESTINOS_PUSH = [
  { href: "/dashboard", label: "Início" },
  { href: "/eventos", label: "Eventos" },
  { href: "/pesquisas", label: "Pesquisas" },
  { href: "/noticias", label: "Notícias" },
  { href: "/ranking", label: "Ranking" },
  { href: "/desempenho", label: "Desempenho" },
] as const;

export const LIMITE_TITULO = 60;
export const LIMITE_CORPO = 180;

export type OrigemPush = "manual" | "noticia" | "pesquisa_abertura" | "pesquisa_lembrete" | "reuniao" | "pontos" | "ranking" | "comite";

export const ORIGEM_PUSH_LABEL: Record<OrigemPush, string> = {
  manual: "Enviada pelo comitê",
  noticia: "Notícia",
  pesquisa_abertura: "Pesquisa aberta",
  pesquisa_lembrete: "Lembrete de pesquisa",
  reuniao: "Reunião",
  pontos: "Pontos lançados",
  ranking: "Ultrapassagem no ranking",
  comite: "Aviso para o comitê",
};

/** Link interno seguro: só caminhos do portal, sem domínio nem protocolo. */
export function linkInternoValido(link: string) {
  return /^\/[a-z0-9\-/]*(\?[a-z0-9=&\-_]*)?$/i.test(link) && !link.startsWith("//");
}

export function validarMensagem(m: { titulo: string; corpo: string; link: string }) {
  const erros: string[] = [];
  if (!m.titulo.trim()) erros.push("Escreva o título.");
  if (m.titulo.trim().length > LIMITE_TITULO) erros.push(`Título com no máximo ${LIMITE_TITULO} caracteres.`);
  if (!m.corpo.trim()) erros.push("Escreva a mensagem.");
  if (m.corpo.trim().length > LIMITE_CORPO) erros.push(`Mensagem com no máximo ${LIMITE_CORPO} caracteres.`);
  if (!linkInternoValido(m.link)) erros.push("Destino inválido.");
  return erros;
}

export function atletaNoPublico(equipe: string | undefined, publico: PublicoPush) {
  if (equipe !== "corrida" && equipe !== "bicicleta") return false;
  return publico === "todos" || publico === equipe;
}

/** Pesquisa: avisa ao abrir (se ainda falta ao menos 1 h para fechar). */
export function pesquisaPrecisaAvisoDeAbertura(p: { abreEm: string; fechaEm: string }, agora: number) {
  return Date.parse(p.abreEm) <= agora && Date.parse(p.fechaEm) - agora > 60 * 60_000;
}

/**
 * Lembrete no último dia: faltando até 24 h, só para pesquisas que ficaram
 * abertas mais de 36 h (as curtas já tiveram o aviso de abertura há pouco).
 */
export function pesquisaPrecisaLembrete(p: { abreEm: string; fechaEm: string }, agora: number) {
  const abre = Date.parse(p.abreEm);
  const fecha = Date.parse(p.fechaEm);
  const falta = fecha - agora;
  return agora >= abre && falta > 0 && falta <= 24 * 60 * 60_000 && fecha - abre > 36 * 60 * 60_000;
}
