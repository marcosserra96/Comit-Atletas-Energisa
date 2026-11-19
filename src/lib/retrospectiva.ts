/**
 * Retrospectiva: regras puras (sem navegador) para transformar as fotos e
 * vídeos de uma pasta num roteiro de cenas: capítulos por subpasta, ordem
 * pela data em que a foto foi tirada, duplas de fotos em pé, mosaicos de vez
 * em quando, legenda do mês e o tempo de cada cena (inclusive ajustado à música).
 */

export type TipoArquivo = "foto" | "heic" | "video";

export interface ItemRetro {
  id: string;
  nome: string;
  url: string;
  tipo: "foto" | "video";
  /** Quando foi tirada (EXIF) ou, sem isso, a data do arquivo (ms). */
  data: number;
  /** Subpasta de primeiro nível ("" = fotos soltas na pasta escolhida). */
  capitulo: string;
  retrato: boolean;
  /** Vídeo: duração em segundos. */
  duracao?: number;
  favorita?: boolean;
  oculta?: boolean;
}

export interface OpcoesRetro {
  /** Segundos de cada foto. */
  segundos: number;
  repetir: boolean;
  embaralhar: boolean;
  legendas: boolean;
  /** Ajusta o tempo das fotos para acabar junto com a música. */
  ajustarMusica: boolean;
}

export const OPCOES_PADRAO: OpcoesRetro = { segundos: 5, repetir: false, embaralhar: false, legendas: true, ajustarMusica: false };

export type Cena =
  | { tipo: "capitulo"; titulo: string; quantidade: number; fotos: ItemRetro[]; duracao: number }
  | { tipo: "foto"; item: ItemRetro; legenda: string | null; duracao: number }
  | { tipo: "dupla"; itens: [ItemRetro, ItemRetro]; legenda: string | null; duracao: number }
  | { tipo: "mosaico"; itens: ItemRetro[]; legenda: string | null; duracao: number }
  | { tipo: "video"; item: ItemRetro; legenda: string | null; duracao: number }
  | { tipo: "encerramento"; total: number; duracao: number };

export const SEGUNDOS_ABERTURA = 4;
export const SEGUNDOS_CAPITULO = 3.5;
/** Vídeos longos são cortados: a retrospectiva é de momentos. */
export const MAX_SEGUNDOS_VIDEO = 20;

const FOTO = /^image\/(jpeg|png|webp|gif|avif)$/;
const HEIC = /^image\/(heic|heif)(-sequence)?$/;
const VIDEO = /^video\/(mp4|webm|quicktime)$/;

export function tipoDoArquivo(arquivo: Pick<File, "type" | "name">): TipoArquivo | null {
  const t = arquivo.type.toLowerCase();
  const n = arquivo.name.toLowerCase();
  if (n.startsWith(".")) return null;
  if (FOTO.test(t) || (!t && /\.(jpe?g|png|webp|gif|avif)$/.test(n))) return "foto";
  if (HEIC.test(t) || /\.(heic|heif)$/.test(n)) return "heic";
  if (VIDEO.test(t) || (!t && /\.(mp4|webm|mov|m4v)$/.test(n))) return "video";
  return null;
}

export function ehMusica(arquivo: Pick<File, "type" | "name">) {
  return /^audio\//.test(arquivo.type) || /\.(mp3|m4a|aac|wav|ogg|oga|flac)$/i.test(arquivo.name);
}

/** "Retro/Corrida de março/IMG_1.jpg" → "Corrida de março". Fotos soltas → "". */
export function capituloDoCaminho(caminho: string) {
  const partes = caminho.split("/").filter(Boolean);
  return partes.length > 2 ? partes[1].trim() : "";
}

/** Nome do capítulo sem o número que só serve para ordenar: "01 - Largada" → "Largada". */
export function tituloDoCapitulo(nome: string) {
  return nome.replace(/^\s*\d+\s*[-_.)–]?\s*/, "").trim() || nome;
}

const porNome = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

/**
 * Ordem: fotos soltas primeiro; depois os capítulos. Se todos começam com
 * número ("01 - …"), vale o número; senão, a data da primeira foto de cada um.
 * Dentro do capítulo: data e, empatando, nome.
 */
export function ordenarItens(itens: readonly ItemRetro[]) {
  const grupos = new Map<string, ItemRetro[]>();
  for (const i of itens) grupos.set(i.capitulo, [...(grupos.get(i.capitulo) ?? []), i]);
  for (const lista of grupos.values()) lista.sort((a, b) => a.data - b.data || porNome(a.nome, b.nome));
  const nomes = [...grupos.keys()].filter(Boolean);
  const numerados = nomes.length > 0 && nomes.every((n) => /^\s*\d/.test(n));
  const inicio = (n: string) => grupos.get(n)![0].data;
  nomes.sort((a, b) => (numerados ? porNome(a, b) : inicio(a) - inicio(b) || porNome(a, b)));
  return [...(grupos.get("") ?? []), ...nomes.flatMap((n) => grupos.get(n)!)];
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "Março 2026" (no fuso de Brasília). */
export function rotuloDoMes(ms: number) {
  const d = new Date(ms - 3 * 3600 * 1000);
  return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Embaralha de um jeito repetível (a mesma pasta dá a mesma ordem na prévia e ao vivo). */
function embaralharLista<T>(lista: readonly T[], semente: number) {
  let s = semente >>> 0 || 1;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...lista];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A cada quantas cenas simples entra um mosaico. */
const RITMO_MOSAICO = 7;

/**
 * Monta as cenas, na ordem. Fotos ocultas ficam de fora; favoritas ficam
 * mais tempo e sempre sozinhas. Com música e "ajustar", o tempo das fotos
 * (não dos vídeos) é esticado ou encolhido para acabar junto com ela.
 */
export function montarCenas(todos: readonly ItemRetro[], opcoes: OpcoesRetro, duracaoMusica?: number | null): { cenas: Cena[]; total: number } {
  const ordenados = ordenarItens(todos.filter((i) => !i.oculta));
  // Embaralhar mexe dentro de cada capítulo: os capítulos continuam na ordem.
  const itens = opcoes.embaralhar
    ? [...new Set(ordenados.map((i) => i.capitulo))].flatMap((c) =>
        embaralharLista(
          ordenados.filter((i) => i.capitulo === c),
          ordenados.length * 31 + c.length,
        ),
      )
    : ordenados;
  const temCapitulos = new Set(itens.map((i) => i.capitulo)).size > 1 || (itens[0]?.capitulo ?? "") !== "";
  const s = opcoes.segundos;
  const cenas: Cena[] = [];
  let mesAnterior = "";
  let simples = 0;
  const legendaDe = (i: ItemRetro) => {
    if (!opcoes.legendas || opcoes.embaralhar) return null;
    const mes = rotuloDoMes(i.data);
    if (mes === mesAnterior) return null;
    mesAnterior = mes;
    return mes;
  };
  const livre = (i: ItemRetro | undefined, capitulo: string) => !!i && i.tipo === "foto" && !i.favorita && i.capitulo === capitulo;

  for (let k = 0; k < itens.length; ) {
    const i = itens[k];
    const anterior = itens[k - 1];
    if (temCapitulos && i.capitulo && (!anterior || anterior.capitulo !== i.capitulo)) {
      const doCapitulo = itens.filter((x) => x.capitulo === i.capitulo);
      cenas.push({ tipo: "capitulo", titulo: tituloDoCapitulo(i.capitulo), quantidade: doCapitulo.length, fotos: doCapitulo.filter((x) => x.tipo === "foto").slice(0, 3), duracao: SEGUNDOS_CAPITULO });
      mesAnterior = "";
    }
    if (i.tipo === "video") {
      // Vídeo não tem a data em que foi gravado (só a do arquivo): não puxa legenda.
      cenas.push({ tipo: "video", item: i, legenda: null, duracao: Math.min(MAX_SEGUNDOS_VIDEO, Math.max(2, i.duracao ?? s)) });
      simples += 1;
      k += 1;
      continue;
    }
    // Mosaico de 3: de vez em quando, com três fotos comuns seguidas do mesmo capítulo.
    if (simples >= RITMO_MOSAICO && livre(i, i.capitulo) && livre(itens[k + 1], i.capitulo) && livre(itens[k + 2], i.capitulo)) {
      const grupo = itens.slice(k, k + 3);
      cenas.push({ tipo: "mosaico", itens: grupo, legenda: legendaDe(i), duracao: s * 1.6 });
      simples = 0;
      k += 3;
      continue;
    }
    // Duas fotos em pé seguidas viram uma dupla, lado a lado.
    const prox = itens[k + 1];
    if (i.retrato && livre(i, i.capitulo) && livre(prox, i.capitulo) && prox!.retrato) {
      cenas.push({ tipo: "dupla", itens: [i, prox!], legenda: legendaDe(i), duracao: s * 1.3 });
      simples += 1;
      k += 2;
      continue;
    }
    cenas.push({ tipo: "foto", item: i, legenda: legendaDe(i), duracao: i.favorita ? s * 1.6 : s });
    simples += 1;
    k += 1;
  }
  if (!opcoes.repetir && itens.length > 0) cenas.push({ tipo: "encerramento", total: itens.length, duracao: 0 });

  // Ajuste à música: só as cenas de foto mudam (vídeo tem o tempo dele).
  if (opcoes.ajustarMusica && duracaoMusica && duracaoMusica > 0) {
    const fixo = SEGUNDOS_ABERTURA + cenas.reduce((t, c) => t + (c.tipo === "video" || c.tipo === "capitulo" ? c.duracao : 0), 0);
    const variavel = cenas.reduce((t, c) => t + (c.tipo === "foto" || c.tipo === "dupla" || c.tipo === "mosaico" ? c.duracao : 0), 0);
    if (variavel > 0) {
      const fator = Math.max(0.4, (duracaoMusica - fixo) / variavel);
      for (const c of cenas) {
        if (c.tipo === "foto" || c.tipo === "dupla" || c.tipo === "mosaico") c.duracao = Math.min(20, Math.max(1.5, Math.round(c.duracao * fator * 10) / 10));
      }
    }
  }
  const total = SEGUNDOS_ABERTURA + cenas.reduce((t, c) => t + c.duracao, 0);
  return { cenas, total };
}

/** "3 min 20 s", "45 s". */
export function duracaoLegivel(segundos: number) {
  const s = Math.round(segundos);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

/** Lado maior da foto preparada: o tamanho do telão (Full HD). Mais que isso só pesa. */
export const LADO_MAXIMO_FOTO = 1920;

export function tamanhoReduzido(largura: number, altura: number, lado = LADO_MAXIMO_FOTO) {
  const f = Math.min(1, lado / Math.max(largura, altura));
  return { largura: Math.round(largura * f), altura: Math.round(altura * f) };
}
