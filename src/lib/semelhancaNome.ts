/**
 * Semelhança entre o nome de quem pediu acesso e os cadastros existentes,
 * para sugerir o vínculo certo. Sem acento, sem "de/da/dos", tolerante a
 * abreviações ("Marco A. Sousa") e ao e-mail (wagner.lp.rezende@...).
 */

const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

export function normalizarNome(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function partesDoNome(texto: string) {
  return normalizarNome(texto)
    .split(" ")
    .filter((p) => p && !LIGACOES.has(p));
}

/** Pedaços úteis do e-mail: "wagner.lp.rezende@gmail.com" → wagner, rezende. */
export function partesDoEmail(email: string) {
  const local = (email.split("@")[0] ?? "").toLowerCase();
  return local
    .split(/[._\-+0-9]+/)
    .filter((p) => p.length >= 3 && !LIGACOES.has(p));
}

function combina(a: string, b: string) {
  if (a === b) return true;
  // Abreviação: "a" ↔ "aurelio" vale pouco; prefixo com 3+ letras vale.
  const [curta, longa] = a.length <= b.length ? [a, b] : [b, a];
  return curta.length >= 3 && longa.startsWith(curta);
}

/**
 * 0 a 1. Parte do nome do pedido que aparece no cadastro, com peso extra
 * para o primeiro nome igual e para o sobrenome final igual.
 */
export function semelhanca(referencia: { nome: string; email?: string | null }, candidato: string) {
  const ref = partesDoNome(referencia.nome);
  const cand = partesDoNome(candidato);
  if (ref.length === 0 || cand.length === 0) return 0;

  const usados = new Set<number>();
  let acertos = 0;
  for (const p of ref) {
    const i = cand.findIndex((c, idx) => !usados.has(idx) && combina(p, c));
    if (i >= 0) {
      usados.add(i);
      acertos += 1;
    }
  }
  // Partes do e-mail que confirmam (não contam duas vezes o que o nome já achou).
  let doEmail = 0;
  for (const p of partesDoEmail(referencia.email ?? "")) {
    const i = cand.findIndex((c, idx) => !usados.has(idx) && combina(p, c));
    if (i >= 0) {
      usados.add(i);
      doEmail += 1;
    }
  }

  const base = acertos / ref.length;
  const primeiro = ref[0] === cand[0] ? 0.25 : 0;
  const ultimo = ref.length > 1 && ref[ref.length - 1] === cand[cand.length - 1] ? 0.15 : 0;
  const email = Math.min(0.2, doEmail * 0.1);
  if (acertos === 0 && doEmail === 0) return 0;
  return Math.min(1, base * 0.6 + primeiro + ultimo + email);
}

export interface Sugestao<T> {
  item: T;
  pontuacao: number;
}

/** As melhores sugestões (até `limite`), só as que valem a pena mostrar. */
export function sugerirPorNome<T>(
  referencia: { nome: string; email?: string | null },
  itens: T[],
  nomeDe: (item: T) => string,
  limite = 3,
): Sugestao<T>[] {
  return itens
    .map((item) => ({ item, pontuacao: semelhanca(referencia, nomeDe(item)) }))
    .filter((s) => s.pontuacao >= 0.45) // só sobrenome igual (0,35) não basta
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .slice(0, limite);
}

/** Busca por texto: todas as palavras digitadas precisam aparecer (sem acento). */
export function buscaCombina(termo: string, nome: string) {
  const partes = normalizarNome(termo).split(" ").filter(Boolean);
  if (partes.length === 0) return true;
  const alvo = normalizarNome(nome);
  return partes.every((p) => alvo.includes(p));
}
