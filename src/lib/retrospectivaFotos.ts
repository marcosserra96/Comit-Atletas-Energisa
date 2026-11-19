"use client";

import { useSyncExternalStore } from "react";
import { capituloDoCaminho, ehMusica, ordenarItens, tamanhoReduzido, tipoDoArquivo, type ItemRetro } from "@/lib/retrospectiva";

/**
 * Fotos, vídeos e música da retrospectiva: escolhidos no computador e
 * mantidos só na memória desta aba (endereços blob:). Nada é enviado ao
 * portal; ao fechar ou recarregar a página, é preciso escolher de novo.
 *
 * Cada foto é preparada uma vez: data em que foi tirada (EXIF), HEIC do
 * iPhone convertido, girada certo e reduzida ao tamanho da tela, para o
 * telão não engasgar com arquivos de 10 MB.
 */

export interface MusicaRetro {
  url: string;
  nome: string;
  duracao: number;
}

export interface EstadoRetro {
  itens: ItemRetro[];
  musica: MusicaRetro | null;
  /** Enquanto prepara a pasta. */
  preparando: { feitos: number; total: number } | null;
  /** Arquivos que não deu para usar (formato ou vídeo que o navegador não toca). */
  ignorados: number;
}

const VAZIO: EstadoRetro = { itens: [], musica: null, preparando: null, ignorados: 0 };
const estados = new Map<string, EstadoRetro>();
const ouvintes = new Set<() => void>();
/** Cada nova escolha cancela a preparação anterior do mesmo slide. */
const geracao = new Map<string, number>();

function mudar(livreId: string, campos: Partial<EstadoRetro>) {
  estados.set(livreId, { ...(estados.get(livreId) ?? VAZIO), ...campos });
  ouvintes.forEach((o) => o());
}

function liberar(itens: readonly ItemRetro[]) {
  itens.forEach((i) => URL.revokeObjectURL(i.url));
}

async function dataDaFoto(arquivo: File) {
  try {
    const exifr = (await import("exifr")).default;
    const r = (await exifr.parse(arquivo, { pick: ["DateTimeOriginal", "CreateDate"] })) as { DateTimeOriginal?: Date; CreateDate?: Date } | undefined;
    const d = r?.DateTimeOriginal ?? r?.CreateDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getTime();
  } catch {
    /* sem EXIF: fica a data do arquivo */
  }
  return arquivo.lastModified;
}

async function bitmapDa(arquivo: File, heic: boolean): Promise<ImageBitmap> {
  try {
    // O Safari abre HEIC direto; os outros navegadores precisam converter.
    return await createImageBitmap(arquivo);
  } catch (e) {
    if (!heic) throw e;
    const heic2any = (await import("heic2any")).default;
    const convertido = await heic2any({ blob: arquivo, toType: "image/jpeg", quality: 0.9 });
    return createImageBitmap(Array.isArray(convertido) ? convertido[0] : convertido);
  }
}

async function prepararFoto(arquivo: File, heic: boolean) {
  const bmp = await bitmapDa(arquivo, heic);
  const { largura, altura } = tamanhoReduzido(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, largura, altura);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("sem imagem");
  return { url: URL.createObjectURL(blob), retrato: altura > largura * 1.05 };
}

/** Lê duração e formato de um vídeo; falha se o navegador não toca (ex.: HEVC no Chrome). */
function prepararVideo(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  return new Promise<{ url: string; data: number; retrato: boolean; duracao: number }>((ok, falha) => {
    const v = document.createElement("video");
    const fim = window.setTimeout(() => erro(), 8000);
    const erro = () => {
      window.clearTimeout(fim);
      URL.revokeObjectURL(url);
      falha(new Error("vídeo"));
    };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      window.clearTimeout(fim);
      if (!v.videoWidth || !Number.isFinite(v.duration)) return erro();
      ok({ url, data: arquivo.lastModified, retrato: v.videoHeight > v.videoWidth * 1.05, duracao: v.duration });
    };
    v.onerror = erro;
    v.src = url;
  });
}

// ---------- várias fotos ao mesmo tempo ----------

type Trabalhador = { worker: Worker; livre: boolean };
let trabalhadores: Trabalhador[] | null = null;
let pedidos = 0;

/** Um "trabalhador" por núcleo (de 2 a 6), criados uma vez e reaproveitados. */
function equipe(): Trabalhador[] {
  if (trabalhadores) return trabalhadores;
  trabalhadores = [];
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return trabalhadores;
  const n = Math.min(6, Math.max(2, (navigator.hardwareConcurrency || 4) - 1));
  try {
    for (let k = 0; k < n; k++) trabalhadores.push({ worker: new Worker(new URL("./retrospectivaWorker.ts", import.meta.url), { type: "module" }), livre: true });
  } catch {
    trabalhadores = [];
  }
  return trabalhadores;
}

/** Prepara no trabalhador indicado; se ele falhar (ex.: HEIC no Chrome), cai na tela principal. */
function prepararNoTrabalhador(t: Trabalhador, arquivo: File) {
  const id = ++pedidos;
  return new Promise<{ blob: Blob; retrato: boolean } | null>((ok) => {
    const ouvir = (e: MessageEvent<{ id: number; ok: boolean; blob?: Blob; retrato?: boolean }>) => {
      if (e.data.id !== id) return;
      t.worker.removeEventListener("message", ouvir);
      ok(e.data.ok && e.data.blob ? { blob: e.data.blob, retrato: !!e.data.retrato } : null);
    };
    t.worker.addEventListener("message", ouvir);
    t.worker.postMessage({ id, arquivo });
  });
}

/**
 * Recebe a pasta (ou os arquivos) e prepara tudo. Primeiro lê só as datas
 * (rápido) para saber a ordem; depois reduz as fotos em paralelo, uma por
 * núcleo, e libera para a apresentação na ordem certa, conforme ficam
 * prontas: dá para começar antes de terminar. Uma música na pasta vira a trilha.
 */
export async function carregarPasta(livreId: string, lista: FileList | File[]) {
  const arquivos = Array.from(lista);
  const versao = (geracao.get(livreId) ?? 0) + 1;
  geracao.set(livreId, versao);
  const vale = () => geracao.get(livreId) === versao;
  const aceitos = arquivos.map((a) => ({ a, tipo: tipoDoArquivo(a) })).filter((x): x is { a: File; tipo: NonNullable<typeof x.tipo> } => !!x.tipo);
  const musica = arquivos.find(ehMusica);
  const antigo = estados.get(livreId);
  if (antigo) liberar(antigo.itens);
  mudar(livreId, { itens: [], preparando: { feitos: 0, total: aceitos.length }, ignorados: 0 });
  if (musica) await definirMusica(livreId, musica);

  // 1) Datas (EXIF) de todas, 8 por vez: decidem a ordem.
  const datas: number[] = new Array(aceitos.length);
  let prox = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (prox < aceitos.length) {
        const k = prox++;
        const { a, tipo } = aceitos[k];
        datas[k] = tipo === "video" ? a.lastModified : await dataDaFoto(a);
      }
    }),
  );
  if (!vale()) return null;
  const ordem = ordenarItens(
    aceitos.map(({ a }, k) => ({ id: String(k), nome: a.name, url: "", tipo: "foto" as const, data: datas[k], capitulo: capituloDoCaminho(a.webkitRelativePath || ""), retrato: false })),
  ).map((i) => Number(i.id));

  // 2) Fotos em paralelo; a lista publicada é sempre o começo já pronto, na ordem.
  const prontos: (ItemRetro | null | undefined)[] = new Array(aceitos.length);
  let ignorados = arquivos.length - aceitos.length - (musica ? 1 : 0);
  let feitos = 0;
  let publicados = 0;
  const publicar = () => {
    let n = publicados;
    while (n < ordem.length && prontos[ordem[n]] !== undefined) n++;
    if (n === publicados && feitos % 6 !== 0 && feitos !== aceitos.length) return;
    publicados = n;
    const itens = ordem.slice(0, n).flatMap((k) => (prontos[k] ? [prontos[k]!] : []));
    mudar(livreId, { itens, preparando: feitos < aceitos.length ? { feitos, total: aceitos.length } : null });
  };
  const preparar = async (k: number, t: Trabalhador | null) => {
    const { a, tipo } = aceitos[k];
    const base = { id: `${a.webkitRelativePath || a.name}:${a.size}`, nome: a.name, capitulo: capituloDoCaminho(a.webkitRelativePath || ""), data: datas[k] };
    try {
      if (tipo === "video") {
        const v = await prepararVideo(a);
        prontos[k] = { ...base, tipo: "video", url: v.url, retrato: v.retrato, duracao: v.duracao };
      } else {
        // HEIC também tenta no trabalhador (o Safari abre direto); no Chrome, converte na tela principal.
        const r = t ? await prepararNoTrabalhador(t, a) : null;
        if (r) prontos[k] = { ...base, tipo: "foto", url: URL.createObjectURL(r.blob), retrato: r.retrato };
        else {
          const f = await prepararFoto(a, tipo === "heic");
          prontos[k] = { ...base, tipo: "foto", url: f.url, retrato: f.retrato };
        }
      }
    } catch {
      prontos[k] = null;
      ignorados += 1;
    }
    feitos += 1;
    if (vale()) publicar();
  };
  const fila = [...ordem];
  const ts = equipe();
  // Sem trabalhadores (navegador antigo), 3 por vez na tela principal.
  const vagas: (Trabalhador | null)[] = ts.length ? ts : [null, null, null];
  await Promise.all(
    vagas.map(async (t) => {
      while (fila.length && vale()) await preparar(fila.shift()!, t);
    }),
  );
  if (!vale()) {
    liberar(prontos.filter((x): x is ItemRetro => !!x));
    return null;
  }
  const itens = ordem.flatMap((k) => (prontos[k] ? [prontos[k]!] : []));
  mudar(livreId, { itens, preparando: null, ignorados });
  return { aceitas: itens.length, ignoradas: ignorados, musica: !!musica };
}

export function definirMusica(livreId: string, arquivo: File) {
  const anterior = estados.get(livreId)?.musica;
  if (anterior) URL.revokeObjectURL(anterior.url);
  const url = URL.createObjectURL(arquivo);
  return new Promise<boolean>((ok) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      mudar(livreId, { musica: { url, nome: arquivo.name, duracao: Number.isFinite(a.duration) ? a.duration : 0 } });
      ok(true);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      ok(false);
    };
    a.src = url;
  });
}

export function tirarMusica(livreId: string) {
  const m = estados.get(livreId)?.musica;
  if (m) URL.revokeObjectURL(m.url);
  mudar(livreId, { musica: null });
}

/** Favorita (fica mais tempo) ou oculta (sai da retrospectiva). */
export function marcarItem(livreId: string, id: string, campo: "favorita" | "oculta") {
  const e = estados.get(livreId);
  if (!e) return;
  mudar(livreId, { itens: e.itens.map((i) => (i.id === id ? { ...i, [campo]: !i[campo] } : i)) });
}

export function limparFotos(livreId: string) {
  geracao.set(livreId, (geracao.get(livreId) ?? 0) + 1);
  const e = estados.get(livreId);
  if (e) {
    liberar(e.itens);
    if (e.musica) URL.revokeObjectURL(e.musica.url);
  }
  estados.delete(livreId);
  ouvintes.forEach((o) => o());
}

function assinar(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function useRetrospectiva(livreId: string): EstadoRetro {
  return useSyncExternalStore(
    assinar,
    () => estados.get(livreId) ?? VAZIO,
    () => VAZIO,
  );
}
