"use client";

import { auth } from "@/lib/firebase";
import type { OrigemPush, PublicoPush } from "@/lib/push/regras";

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

export interface ResultadoEnvio {
  atletas: number;
  aparelhos: number;
  enviados: number;
  falhas: number;
}

export interface EnvioPush {
  id: string;
  origem: OrigemPush;
  titulo: string;
  corpo: string;
  link: string;
  publico: PublicoPush;
  atletas: number;
  enviados: number;
  falhas: number;
  autorNome: string | null;
  criadoEm: string | null;
  /** Envio individual: nomes de quem foi escolhido. */
  destinatarios: string[] | null;
}

export interface PessoaPush {
  id: string;
  nome: string;
  equipe: string;
  /** Aparelhos com as notificações ativas (0 = não recebe). */
  aparelhos: number;
}

export const carregarDestinatarios = () =>
  api<{ pessoas: PessoaPush[] }>("/api/push/destinatarios").then((r) => r.pessoas);

export interface PainelPush {
  alcance: { corrida: number; bicicleta: number; atletasAtivos: number };
  envios: EnvioPush[];
}

export const carregarPainelPush = () => api<PainelPush>("/api/push/historico");

export const alcancePush = (publico: PublicoPush, atletaIds?: string[]) =>
  api<{ atletas: number; aparelhos: number }>("/api/push/enviar", {
    method: "POST",
    body: JSON.stringify({ tipo: "manual", publico, atletaIds, simular: true }),
  });

export const enviarPushManual = (dados: {
  titulo: string;
  corpo: string;
  publico: PublicoPush;
  link: string;
  atletaIds?: string[];
}) =>
  api<ResultadoEnvio>("/api/push/enviar", { method: "POST", body: JSON.stringify({ tipo: "manual", ...dados }) });

export const enviarPushDeNoticia = (noticiaId: string) =>
  api<ResultadoEnvio>("/api/push/enviar", { method: "POST", body: JSON.stringify({ tipo: "noticia", noticiaId }) });

/**
 * Logo depois de publicar uma pesquisa ou ativar uma reunião: processa os
 * avisos automáticos na hora, sem esperar o agendador. Falha aqui não importa
 * (o agendador cobre).
 */
export function dispararAvisosAgora() {
  void api("/api/push/processar", { method: "POST" }).catch(() => undefined);
}
