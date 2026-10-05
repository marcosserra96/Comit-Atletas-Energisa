"use client";

import { useSyncExternalStore } from "react";

/**
 * Tudo o que o portal sabe sobre instalar o app neste aparelho, num lugar só:
 * o aviso flutuante, a página /instalar e o item do menu leem daqui.
 */

export type Aparelho = "iphone" | "android" | "computador";

/**
 * - safari / chrome / outro: navegador comum.
 * - interno: navegador embutido de outro app (WhatsApp, Instagram, Facebook,
 *   LinkedIn...). Ali não existe "instalar": é preciso abrir no navegador.
 */
export type Navegador = "safari" | "chrome" | "outro" | "interno";

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface EstadoInstalacao {
  pronto: boolean;
  aparelho: Aparelho;
  navegador: Navegador;
  /** Aberto pelo ícone na tela inicial (já instalado). */
  instalado: boolean;
  /** Android/Chrome/Edge: dá para instalar com um toque. */
  podeInstalarDireto: boolean;
}

export function detectarAparelho(ua: string, plataforma = "", toques = 0): Aparelho {
  if (/iphone|ipad|ipod/i.test(ua) || (plataforma === "MacIntel" && toques > 1)) return "iphone";
  if (/android/i.test(ua)) return "android";
  return "computador";
}

export function detectarNavegador(ua: string, aparelho: Aparelho): Navegador {
  if (/FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|WhatsApp|Line\/|Snapchat|TikTok|musical_ly|GSA\//i.test(ua)) {
    return "interno";
  }
  // WebView do Android (apps que abrem links por dentro) marca "; wv)".
  if (aparelho === "android" && /;\s*wv\)/i.test(ua)) return "interno";
  if (aparelho === "iphone") {
    if (/CriOS/i.test(ua)) return "chrome";
    if (/FxiOS|EdgiOS|OPiOS/i.test(ua)) return "outro";
    // Safari de verdade traz "Safari/"; WebViews de apps no iPhone não.
    return /Safari\//i.test(ua) ? "safari" : "interno";
  }
  if (/Edg\/|OPR\/|SamsungBrowser|Firefox/i.test(ua)) return "outro";
  if (/Chrome\//i.test(ua)) return "chrome";
  if (/Safari\//i.test(ua)) return "safari";
  return "outro";
}

let eventoGuardado: EventoInstalar | null = null;
let instaladoAgora = false;
let estado: EstadoInstalacao = {
  pronto: false,
  aparelho: "computador",
  navegador: "outro",
  instalado: false,
  podeInstalarDireto: false,
};
const ouvintes = new Set<() => void>();

function recalcular() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const aparelho = detectarAparelho(nav.userAgent, nav.platform, nav.maxTouchPoints);
  estado = {
    pronto: true,
    aparelho,
    navegador: detectarNavegador(nav.userAgent, aparelho),
    instalado:
      instaladoAgora ||
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean(nav.standalone),
    podeInstalarDireto: eventoGuardado !== null,
  };
  ouvintes.forEach((f) => f());
}

let iniciado = false;
/** Chamado uma vez, cedo (PwaRegister), para não perder o evento do navegador. */
export function iniciarInstalacao() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoGuardado = e as EventoInstalar;
    recalcular();
  });
  window.addEventListener("appinstalled", () => {
    eventoGuardado = null;
    instaladoAgora = true;
    recalcular();
  });
  recalcular();
}

/** Abre o diálogo do navegador. true = a pessoa aceitou. */
export async function instalarAgora() {
  if (!eventoGuardado) return false;
  const evento = eventoGuardado;
  await evento.prompt();
  const escolha = await evento.userChoice;
  eventoGuardado = null;
  if (escolha.outcome === "accepted") instaladoAgora = true;
  recalcular();
  return escolha.outcome === "accepted";
}

function assinar(f: () => void) {
  iniciarInstalacao();
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

const ESTADO_SERVIDOR: EstadoInstalacao = { ...estado };

export function useInstalacao(): EstadoInstalacao {
  return useSyncExternalStore(
    assinar,
    () => estado,
    () => ESTADO_SERVIDOR,
  );
}
