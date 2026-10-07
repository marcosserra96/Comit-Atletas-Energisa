"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { FOTO_LADO } from "@/lib/fotoRegras";

/**
 * Reduz a imagem no próprio aparelho antes de enviar: corrige a rotação da
 * câmera, recorta no centro quando `quadrada` e devolve um JPEG em data URL.
 */
export async function reduzirImagem(
  arquivo: File,
  { lado, quadrada = false, qualidade = 0.82 }: { lado: number; quadrada?: boolean; qualidade?: number },
): Promise<string> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha uma imagem (JPG ou PNG).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Não foi possível abrir esta imagem. Tente outra foto.");
  }
  const { width: w, height: h } = bitmap;
  let sx = 0, sy = 0, sw = w, sh = h;
  if (quadrada) {
    const m = Math.min(w, h);
    sx = (w - m) / 2;
    sy = (h - m) / 2;
    sw = sh = m;
  }
  const escala = Math.min(1, lado / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * escala);
  canvas.height = Math.round(sh * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu preparar a imagem.");
  ctx.fillStyle = "#ffffff"; // PNG transparente vira fundo branco no JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", qualidade);
}

async function api<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sua sessão expirou. Entre novamente.");
  const resposta = await fetch(caminho, {
    ...init,
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json", ...init.headers },
  });
  const corpo = (await resposta.json().catch(() => ({}))) as T & { error?: string };
  if (!resposta.ok) throw new Error(corpo.error || "Não foi possível concluir agora.");
  return corpo;
}

// Cache da sessão: id → { versão, foto ou null (sem foto) }. A versão vem do cadastro (fotoVersao).
const cache = new Map<string, { versao: number; url: string | null }>();
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

// Pedidos de várias telas/linhas no mesmo instante viram uma chamada só.
const fila = new Map<string, number>();
const emVoo = new Set<string>();
let agendado: ReturnType<typeof setTimeout> | null = null;

function pedir(id: string, versao: number) {
  if (emVoo.has(id)) return; // já está sendo buscada; a resposta avisa todas as telas
  fila.set(id, Math.max(versao, fila.get(id) ?? 0));
  if (agendado) return;
  agendado = setTimeout(() => void buscarFila(), 25);
}

async function buscarFila() {
  agendado = null;
  const itens = [...fila.entries()];
  fila.clear();
  itens.forEach(([id]) => emVoo.add(id));
  for (let i = 0; i < itens.length; i += 150) {
    const lote = itens.slice(i, i + 150);
    // A versão vai na URL: trocar a foto muda o endereço e o navegador não reaproveita a antiga do cache.
    const versoes = lote.map(([, v]) => v).join(".");
    try {
      const { fotos } = await api<{ fotos: Record<string, string> }>(`/api/fotos/atletas?ids=${lote.map(([id]) => id).join(",")}&v=${versoes}`);
      for (const [id, versao] of lote) cache.set(id, { versao, url: fotos[id] ?? null });
    } catch {
      // Sem foto, o avatar mostra as iniciais (tenta de novo na próxima vez que a tela pedir).
    }
    lote.forEach(([id]) => emVoo.delete(id));
  }
  avisar();
}

export async function salvarFotoAtleta(atletaId: string, dataUrl: string | null) {
  await api("/api/fotos/atletas", { method: "POST", body: JSON.stringify({ atletaId, dataUrl }) });
  cache.set(atletaId, { versao: Date.now(), url: dataUrl });
  avisar();
}

function useAvisos() {
  const [, forcar] = useState(0);
  useEffect(() => {
    const f = () => forcar((n) => n + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);
}

/**
 * Pessoa para buscar foto:
 * - com `fotoVersao` (cadastro completo): busca quando a versão é nova; sem o campo, não tem foto;
 * - `porId: true` (lista que só conhece o id, ex.: confirmados de evento): busca uma vez pelo id.
 */
export type PessoaComFoto = { id: string; fotoVersao?: number | null; porId?: boolean };

const precisa = (p: PessoaComFoto) => {
  if (p.porId) return !cache.has(p.id);
  return !!p.fotoVersao && (cache.get(p.id)?.versao ?? 0) < p.fotoVersao;
};

/** Fotos de uma lista de pessoas: id → data URL (só de quem tem foto). */
export function useFotosAtletas(pessoas: readonly PessoaComFoto[]) {
  useAvisos();
  const chave = pessoas
    .filter((p) => p.porId || p.fotoVersao)
    .map((p) => `${p.id}:${p.porId ? "id" : p.fotoVersao}`)
    .sort()
    .join(",");
  useEffect(() => {
    if (!chave) return;
    for (const p of pessoas) if (precisa(p)) pedir(p.id, p.porId ? 0 : (p.fotoVersao ?? 0));
    // `pessoas` muda de identidade a cada render; a chave resume o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  // Calculado a cada render (barato): o cache muda fora do React e `avisar` re-renderiza.
  const out: Record<string, string> = {};
  for (const p of pessoas) {
    const c = cache.get(p.id);
    if (c?.url && (p.porId || p.fotoVersao)) out[p.id] = c.url;
  }
  return out;
}

/** Foto de uma pessoa só (barra do topo, menu, ficha, linha de lista). */
export function useFotoAtleta(pessoa: PessoaComFoto | null | undefined) {
  const fotos = useFotosAtletas(pessoa ? [pessoa] : []);
  return pessoa ? fotos[pessoa.id] : undefined;
}

export { FOTO_LADO };
