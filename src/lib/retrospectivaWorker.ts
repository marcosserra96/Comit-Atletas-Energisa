/// <reference lib="webworker" />
import { tamanhoReduzido } from "@/lib/retrospectiva";

/*
 * Prepara uma foto fora da tela principal: abre (já girada pelo EXIF),
 * reduz ao tamanho da tela e devolve um JPEG leve. Vários destes rodam ao
 * mesmo tempo, um por núcleo do processador. Nada sai do computador.
 */

export interface PedidoFoto {
  id: number;
  arquivo: File;
}

export type RespostaFoto = { id: number; ok: true; blob: Blob; retrato: boolean } | { id: number; ok: false };

const escopo = self as unknown as DedicatedWorkerGlobalScope;

escopo.onmessage = async (e: MessageEvent<PedidoFoto>) => {
  const { id, arquivo } = e.data;
  try {
    const bmp = await createImageBitmap(arquivo);
    const { largura, altura } = tamanhoReduzido(bmp.width, bmp.height);
    const tela = new OffscreenCanvas(largura, altura);
    const ctx = tela.getContext("2d");
    if (!ctx) throw new Error("sem canvas");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, largura, altura);
    bmp.close();
    const blob = await tela.convertToBlob({ type: "image/jpeg", quality: 0.85 });
    escopo.postMessage({ id, ok: true, blob, retrato: altura > largura * 1.05 } satisfies RespostaFoto);
  } catch {
    escopo.postMessage({ id, ok: false } satisfies RespostaFoto);
  }
};
