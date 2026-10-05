"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Gera o QR code (PNG em data URL) do conteúdo; "" enquanto gera. */
export function useQrDataUrl(conteudo: string, tamanho: number) {
  const [url, setUrl] = useState<{ conteudo: string; dataUrl: string } | null>(null);
  useEffect(() => {
    if (!conteudo) return;
    let ativo = true;
    QRCode.toDataURL(conteudo, { width: tamanho, margin: 2, errorCorrectionLevel: "M", color: { dark: "#07192d", light: "#ffffff" } })
      .then((dataUrl) => ativo && setUrl({ conteudo, dataUrl }))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [conteudo, tamanho]);
  return url?.conteudo === conteudo ? url.dataUrl : "";
}
