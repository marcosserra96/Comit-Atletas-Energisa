"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { instalarAgora, useInstalacao } from "@/lib/pwa/instalacao";

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function dispensadoRecentemente() {
  try {
    const em = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(em) && Date.now() - em < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Convite discreto para instalar, no celular. Android com Chrome instala com
 * um toque; nos demais casos leva ao passo a passo em /instalar (que também
 * trata links abertos por dentro do WhatsApp/Instagram). Fechar esconde por
 * 14 dias; o item "Instalar o app" do menu continua disponível. Só aparece na
 * área do atleta, com a sessão ativa (nunca por cima do login ou dos termos).
 */
export function PwaInstallPrompt() {
  const { pronto, instalado, aparelho, navegador, podeInstalarDireto } = useInstalacao();
  const pathname = usePathname();
  const [fechado, setFechado] = useState(false);

  // Fica fora de telas onde atrapalha (confirmação de presença, respondendo pesquisa).
  const paginaCerta = !pathname.startsWith("/presenca") && !/^\/pesquisas\/./.test(pathname);
  if (!pronto || instalado || aparelho === "computador" || fechado || !paginaCerta || dispensadoRecentemente()) {
    return null;
  }

  function dispensar() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Sem armazenamento: some só nesta visita.
    }
    setFechado(true);
  }

  const umToque = podeInstalarDireto && navegador !== "interno";

  return (
    <aside
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-[70] ml-auto max-w-md rounded-[var(--radius-lg)] border border-primary/20 bg-bg-card p-4 shadow-[var(--shadow-elevated)] lg:bottom-6 lg:left-auto lg:right-6"
      aria-label="Instalar aplicativo"
    >
      <button
        type="button"
        onClick={dispensar}
        aria-label="Fechar"
        className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg hover:text-text"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-center gap-3 pr-8">
        <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-[12px]" />
        <div>
          <p className="font-bold text-text">Tenha o app na tela inicial</p>
          <p className="text-sm text-text-light">Abre com um toque, como um aplicativo.</p>
        </div>
      </div>

      {umToque ? (
        <button
          type="button"
          onClick={() => void instalarAgora()}
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
        >
          <Download className="size-4" />
          Instalar agora
        </button>
      ) : (
        <Link
          href="/instalar"
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
        >
          Ver como instalar
        </Link>
      )}
    </aside>
  );
}
