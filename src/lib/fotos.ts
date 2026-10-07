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

// Cache da sessão: id → { versão, foto }. A versão vem do cadastro (fotoVersao).
const cache = new Map<string, { versao: number; url: string }>();
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export async function salvarFotoAtleta(atletaId: string, dataUrl: string | null) {
  await api("/api/fotos/atletas", { method: "POST", body: JSON.stringify({ atletaId, dataUrl }) });
  if (dataUrl) cache.set(atletaId, { versao: Date.now(), url: dataUrl });
  else cache.delete(atletaId);
  avisar();
}

/**
 * Fotos de uma lista de atletas. Só busca quem tem `fotoVersao` e ainda não
 * está no cache com essa versão. Devolve id → data URL.
 */
export function useFotosAtletas(atletas: readonly { id: string; fotoVersao?: number | null }[]) {
  const [, forcar] = useState(0);
  const chave = atletas
    .filter((a) => a.fotoVersao)
    .map((a) => `${a.id}:${a.fotoVersao}`)
    .sort()
    .join(",");

  useEffect(() => {
    const f = () => forcar((n) => n + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);

  useEffect(() => {
    if (!chave) return;
    const faltam = chave
      .split(",")
      .map((p) => {
        const [id, v] = p.split(":");
        return { id, versao: Number(v) };
      })
      .filter(({ id, versao }) => (cache.get(id)?.versao ?? 0) < versao);
    if (faltam.length === 0) return;
    const versaoDe = new Map(faltam.map((f) => [f.id, f.versao]));
    (async () => {
      for (let i = 0; i < faltam.length; i += 150) {
        const lote = faltam.slice(i, i + 150).map((f) => f.id);
        try {
          const { fotos } = await api<{ fotos: Record<string, string> }>(`/api/fotos/atletas?ids=${lote.join(",")}`);
          for (const [id, url] of Object.entries(fotos)) cache.set(id, { versao: versaoDe.get(id) ?? Date.now(), url });
        } catch {
          // Sem foto, o avatar mostra as iniciais.
        }
      }
      avisar();
    })();
  }, [chave]);

  // Calculado a cada render (barato): o cache muda fora do React e `avisar` re-renderiza.
  const out: Record<string, string> = {};
  for (const a of atletas) {
    const c = cache.get(a.id);
    if (c && a.fotoVersao) out[a.id] = c.url;
  }
  return out;
}

export { FOTO_LADO };
