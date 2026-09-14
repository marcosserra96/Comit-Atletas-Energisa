"use client";

import { useEffect, useState } from "react";
import { Download, Share2, SquarePlus, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const navigatorWithStandalone = navigator as NavigatorStandalone;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean(navigatorWithStandalone.standalone);
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari =
      ios &&
      /safari/i.test(navigator.userAgent) &&
      !/crios|fxios|edgios|opios/i.test(navigator.userAgent);
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY));
    const recentlyDismissed =
      Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS;

    if (!recentlyDismissed) localStorage.removeItem(DISMISS_KEY);

    const animationFrame = window.requestAnimationFrame(() => {
      setIsStandalone(standalone);
      setIsIos(ios);
      setIsSafari(safari);
      setDismissed(recentlyDismissed);
    });

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setIsStandalone(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setIsStandalone(true);
    } else {
      dismiss();
    }
  }

  if (isStandalone || dismissed || (!installPrompt && !isIos)) return null;

  return (
    <aside
      className="fixed bottom-20 left-4 right-4 z-[70] ml-auto max-w-md rounded-[var(--radius-lg)] border border-primary/20 bg-bg-card p-4 shadow-[var(--shadow-elevated)] lg:bottom-6 lg:left-auto lg:right-6"
      aria-label="Instalar aplicativo"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg hover:text-text"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3 pr-7">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
          <Download className="size-5" />
        </span>
        <div>
          <p className="font-bold text-text">Instale o Atletas Energisa</p>
          <p className="mt-1 text-sm leading-relaxed text-text-light">
            Acesse o portal pela tela inicial do celular, como um aplicativo.
          </p>
        </div>
      </div>

      {installPrompt ? (
        <button
          type="button"
          onClick={install}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
        >
          <Download className="size-4" />
          Instalar aplicativo
        </button>
      ) : isSafari ? (
        <div className="mt-4 rounded-[var(--radius)] bg-bg p-3 text-sm text-text-light">
          <p className="flex items-start gap-2">
            <Share2 className="mt-0.5 size-4 shrink-0 text-primary" />
            No Safari, toque em <strong className="text-text">Compartilhar</strong>.
          </p>
          <p className="mt-2 flex items-start gap-2">
            <SquarePlus className="mt-0.5 size-4 shrink-0 text-primary" />
            Depois selecione <strong className="text-text">Adicionar à Tela de Início</strong>.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-[var(--radius)] bg-bg p-3 text-sm text-text-light">
          Para instalar no iPhone ou iPad, abra esta página no Safari.
        </div>
      )}
    </aside>
  );
}
