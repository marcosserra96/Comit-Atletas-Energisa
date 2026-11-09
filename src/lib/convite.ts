import type { EventoDoc } from "@/lib/types";

/**
 * Convite de evento para divulgação (imagem). Tudo aqui é texto editável: a
 * agenda só sugere o começo, o comitê ajusta o que quiser antes de baixar.
 */

export type LayoutConvite = "celebracao" | "largada" | "peito" | "podio" | "foto";
export type FormatoConvite = "feed" | "story";
export type FaixaConvite = "" | "amanha" | "hoje" | "vagas" | "confirmado";

export interface TextosConvite {
  chamada: string;
  titulo: string;
  selo: string;
  texto: string;
  data: string;
  diaSemana: string;
  hora: string;
  local: string;
  texto2: string;
  assinatura: string;
  rodape: string;
}

export const DIMENSOES_CONVITE: Record<FormatoConvite, { largura: number; altura: number; rotulo: string; uso: string }> = {
  feed: { largura: 1080, altura: 1350, rotulo: "Feed 4:5", uso: "1080 × 1350, para WhatsApp, e-mail e feed." },
  story: { largura: 1080, altura: 1920, rotulo: "Status 9:16", uso: "1080 × 1920, para status e stories." },
};

export const LAYOUTS: { id: LayoutConvite; nome: string; descricao: string }[] = [
  { id: "celebracao", nome: "Celebração", descricao: "Claro, com os atletas e as curvas da marca" },
  { id: "largada", nome: "Largada", descricao: "Azul-escuro, com a data em destaque" },
  { id: "peito", nome: "Número de peito", descricao: "A data num número de peito de corrida" },
  { id: "podio", nome: "Pódio", descricao: "Dourado, para fechamentos e premiações" },
  { id: "foto", nome: "Sua foto", descricao: "Uma foto do time de fundo" },
];

export const FAIXAS: Record<Exclude<FaixaConvite, "">, string> = {
  amanha: "É amanhã!",
  hoje: "É hoje!",
  vagas: "Últimas vagas",
  confirmado: "Data confirmada",
};

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function diaDaSemana(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [a, m, d] = iso.split("-").map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/** "18:00" → "18h"; "18:30" → "18h30". */
export function horaCurta(hhmm?: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return "";
  const [h, m] = hhmm.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}

/** "2026-09-23" → "23/09". */
export function dataCurta(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
}

export function mesPorExtenso(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? MESES[Number(iso.slice(5, 7)) - 1] : "";
}

export const TEXTOS_PADRAO: TextosConvite = {
  chamada: "Movimento que nos conecta",
  titulo: "Atletas Energisa",
  selo: "Encontro do programa",
  texto: "Queremos reunir o time para *celebrar as conquistas* e olhar para os próximos passos do programa.",
  data: "",
  diaSemana: "",
  hora: "",
  local: "",
  texto2: "Um momento para *reconhecer destaques*, *compartilhar experiências* e fortalecer a conexão do nosso time.",
  assinatura: "Contamos com a sua participação.",
  rodape: "Mais movimento para um amanhã melhor",
};

/** Começo do convite a partir de um evento da agenda. */
export function textosDoEvento(evento: Pick<EventoDoc, "titulo" | "data" | "local" | "tipo" | "horaInicio" | "online" | "km" | "modalidade">): TextosConvite {
  const reuniao = evento.tipo === "reuniao";
  const modalidade = evento.modalidade === "corrida" ? "corrida" : evento.modalidade === "bicicleta" ? "pedal" : "evento";
  return {
    ...TEXTOS_PADRAO,
    selo: evento.titulo,
    data: dataCurta(evento.data),
    diaSemana: diaDaSemana(evento.data),
    hora: horaCurta(evento.horaInicio),
    local: evento.online ? "Online" : evento.local,
    ...(reuniao
      ? {}
      : {
          texto: `Bora juntos? Vem viver esse ${modalidade} com o time e *representar os Atletas Energisa*${evento.km ? ` nos *${String(evento.km).replace(".", ",")} km*` : ""}.`,
          texto2: "Confirme sua presença pelo portal e *chame quem treina com você*.",
          assinatura: "Te esperamos na largada!",
        }),
  };
}

export interface Trecho {
  texto: string;
  destaque: boolean;
}

/** "Para *celebrar* juntos" → [Para ][celebrar*][ juntos]. Asterisco sem par fica como texto. */
export function trechos(texto: string): Trecho[] {
  const partes: Trecho[] = [];
  const re = /\*([^*\n]+)\*/g;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    if (m.index! > ultimo) partes.push({ texto: texto.slice(ultimo, m.index), destaque: false });
    partes.push({ texto: m[1], destaque: true });
    ultimo = m.index! + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo), destaque: false });
  return partes;
}

/** Nome do arquivo: "convite-fechamento-junho-a-agosto-feed.png". */
export function nomeDoArquivo(selo: string, formato: FormatoConvite) {
  const base = selo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `convite-${base || "evento"}-${formato}.png`;
}
