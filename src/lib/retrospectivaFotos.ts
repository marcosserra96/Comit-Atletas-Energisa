"use client";

import { useSyncExternalStore } from "react";
import { capituloDoCaminho, ehMusica, tamanhoReduzido, tipoDoArquivo, type ItemRetro } from "@/lib/retrospectiva";

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
  const [data, bmp] = await Promise.all([dataDaFoto(arquivo), bitmapDa(arquivo, heic)]);
  const { largura, altura } = tamanhoReduzido(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, largura, altura);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  if (!blob) throw new Error("sem imagem");
  return { url: URL.createObjectURL(blob), data, retrato: altura > largura * 1.05 };
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

/** Recebe a pasta (ou os arquivos) e prepara tudo, de 3 em 3. Uma música na pasta vira a trilha. */
export async function carregarPasta(livreId: string, lista: FileList | File[]) {
  const arquivos = Array.from(lista);
  const versao = (geracao.get(livreId) ?? 0) + 1;
  geracao.set(livreId, versao);
  const aceitos = arquivos.map((a) => ({ a, tipo: tipoDoArquivo(a) })).filter((x): x is { a: File; tipo: NonNullable<typeof x.tipo> } => !!x.tipo);
  const musica = arquivos.find(ehMusica);
  const antigo = estados.get(livreId);
  if (antigo) liberar(antigo.itens);
  mudar(livreId, { itens: [], preparando: { feitos: 0, total: aceitos.length }, ignorados: 0 });
  if (musica) await definirMusica(livreId, musica);

  const itens: ItemRetro[] = [];
  let ignorados = arquivos.length - aceitos.length - (musica ? 1 : 0);
  let feitos = 0;
  let proximo = 0;
  const trabalhar = async () => {
    while (proximo < aceitos.length) {
      const { a, tipo } = aceitos[proximo++];
      try {
        const base = { id: `${a.webkitRelativePath || a.name}:${a.size}`, nome: a.name, capitulo: capituloDoCaminho(a.webkitRelativePath || "") };
        if (tipo === "video") itens.push({ ...base, tipo: "video", ...(await prepararVideo(a)) });
        else itens.push({ ...base, tipo: "foto", ...(await prepararFoto(a, tipo === "heic")) });
      } catch {
        ignorados += 1;
      }
      feitos += 1;
      if (geracao.get(livreId) !== versao) return;
      if (feitos % 4 === 0 || feitos === aceitos.length) mudar(livreId, { preparando: { feitos, total: aceitos.length } });
    }
  };
  await Promise.all([trabalhar(), trabalhar(), trabalhar()]);
  if (geracao.get(livreId) !== versao) {
    liberar(itens);
    return null;
  }
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
