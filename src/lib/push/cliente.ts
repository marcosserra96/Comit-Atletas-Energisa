"use client";

import { useCallback, useEffect, useState } from "react";
import { app, auth, usandoEmulador } from "@/lib/firebase";
import { useInstalacao } from "@/lib/pwa/instalacao";

/** Chave pública de Web Push do projeto (pública por natureza; pode ser trocada por variável). */
const VAPID =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  "BGStH9i9iSeycwlFBjNLk45nozXFKetTCLMfIX-TViXAq_l0n7bJbiWBQgu9An7xW4ykI6PkRvVPW8wrOqoTRUU";

const CHAVE_TOKEN = "push-token";
const CHAVE_UID = "push-uid";
const CHAVE_SINCRONIA = "push-sincronizado-em";
const UM_DIA = 24 * 60 * 60 * 1000;

export type EstadoPush =
  | "carregando"
  /** Navegador sem suporte (ou dentro do WhatsApp/Instagram). */
  | "indisponivel"
  /** iPhone: só funciona com o app na Tela de Início. */
  | "precisa_instalar"
  | "desligado"
  /** A pessoa bloqueou: só nas configurações do aparelho. */
  | "negado"
  | "ativo";

function ler(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: só perde o atalho de não repetir a sincronização
  }
}

async function chamarApi(metodo: "POST" | "DELETE", token: string, plataforma = "") {
  const user = auth.currentUser;
  if (!user) throw new Error("Sessão expirada.");
  const resposta = await fetch("/api/push/inscricao", {
    method: metodo,
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ token, plataforma }),
  });
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
    throw new Error(corpo.error || "Não foi possível falar com o servidor.");
  }
}

export async function pushSuportado() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (usandoEmulador) return true;
  const { isSupported } = await import("firebase/messaging");
  return isSupported().catch(() => false);
}

async function obterToken() {
  if (usandoEmulador) {
    // Local: não há FCM. Um token falso por usuário exercita o resto do fluxo.
    return `dev-${auth.currentUser?.uid ?? "anonimo"}-token-de-teste-local`;
  }
  const registro = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const { getMessaging, getToken } = await import("firebase/messaging");
  return getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: registro });
}

function plataformaAtual() {
  const ua = navigator.userAgent;
  return /iphone|ipad/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "web";
}

async function registrarAparelho() {
  const token = await obterToken();
  if (!token) throw new Error("O navegador não liberou as notificações.");
  await chamarApi("POST", token, plataformaAtual());
  gravar(CHAVE_TOKEN, token);
  gravar(CHAVE_UID, auth.currentUser?.uid ?? "");
  gravar(CHAVE_SINCRONIA, String(Date.now()));
}

/** Pede a permissão e inscreve este aparelho. */
export async function ativarPush() {
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao;
  await registrarAparelho();
  return permissao;
}

export async function desativarPush() {
  const token = ler(CHAVE_TOKEN);
  if (token) await chamarApi("DELETE", token).catch(() => undefined);
  if (!usandoEmulador) {
    const { getMessaging, deleteToken } = await import("firebase/messaging");
    await deleteToken(getMessaging(app)).catch(() => undefined);
  }
  gravar(CHAVE_TOKEN, null);
  gravar(CHAVE_UID, null);
  gravar(CHAVE_SINCRONIA, null);
}

/** Ao sair da conta: o aparelho para de receber avisos desta pessoa. */
export async function removerAparelhoAoSair() {
  const token = ler(CHAVE_TOKEN);
  if (!token) return;
  await chamarApi("DELETE", token).catch(() => undefined);
  gravar(CHAVE_UID, null);
  gravar(CHAVE_SINCRONIA, null);
}

/**
 * Com a permissão já dada, mantém o aparelho inscrito: renova o token uma vez
 * por dia e reinscreve quando outra pessoa entrou neste aparelho.
 */
export async function sincronizarPush() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (!(await pushSuportado())) return;
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const recente = Date.now() - Number(ler(CHAVE_SINCRONIA) ?? 0) < UM_DIA;
  if (recente && ler(CHAVE_UID) === uid && ler(CHAVE_TOKEN)) return;
  await registrarAparelho().catch(() => undefined);
}

/** Estado e ações para a interface. */
export function usePush() {
  const instalacao = useInstalacao();
  const [suportado, setSuportado] = useState<boolean | null>(null);
  const [permissao, setPermissao] = useState<NotificationPermission | null>(null);
  const [inscrito, setInscrito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void pushSuportado().then((ok) => {
      if (!ativo) return;
      setSuportado(ok);
      if (ok) {
        setPermissao(Notification.permission);
        setInscrito(Boolean(ler(CHAVE_TOKEN)) && ler(CHAVE_UID) === auth.currentUser?.uid);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  let estado: EstadoPush = "carregando";
  if (instalacao.pronto && instalacao.aparelho === "iphone" && !instalacao.instalado) estado = "precisa_instalar";
  else if (suportado === false || (instalacao.pronto && instalacao.navegador === "interno")) estado = "indisponivel";
  else if (suportado && permissao === "denied") estado = "negado";
  else if (suportado && permissao === "granted" && inscrito) estado = "ativo";
  else if (suportado && permissao !== null) estado = "desligado";

  const ativar = useCallback(async () => {
    setOcupado(true);
    setErro("");
    try {
      const resultado = await ativarPush();
      setPermissao(resultado);
      setInscrito(resultado === "granted");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ativar agora.");
    } finally {
      setOcupado(false);
    }
  }, []);

  const desativar = useCallback(async () => {
    setOcupado(true);
    try {
      await desativarPush();
      setInscrito(false);
    } finally {
      setOcupado(false);
    }
  }, []);

  return { estado, ativar, desativar, ocupado, erro };
}
