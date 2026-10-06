"use client";

import { auth } from "@/lib/firebase";

async function api<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sua sessão expirou. Entre novamente.");
  const resposta = await fetch(caminho, {
    ...init,
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" },
  });
  const corpo = (await resposta.json().catch(() => ({}))) as T & { error?: string };
  if (!resposta.ok) throw new Error(corpo.error || "Não foi possível concluir agora.");
  return corpo;
}

export interface PedidoSenha {
  uid: string;
  email: string;
  nome: string;
  atletaId: string | null;
  equipe: string | null;
  criadoEm: string | null;
}

export interface LinkSenha {
  link: string;
  email: string;
  nome: string;
  expiraEm: string;
}

export const listarPedidosSenha = () => api<{ pedidos: PedidoSenha[] }>("/api/senha/pedidos").then((r) => r.pedidos);

export const dispensarPedidoSenha = (uid: string) =>
  api("/api/senha/pedidos", { method: "DELETE", body: JSON.stringify({ uid }) });

export const gerarLinkSenha = (alvo: { uid?: string; atletaId?: string }) =>
  api<LinkSenha>("/api/senha/link", { method: "POST", body: JSON.stringify(alvo) });

export function mensagemDoLink(l: LinkSenha) {
  const primeiro = l.nome.split(" ")[0];
  return `Oi, ${primeiro}! Aqui está o link para criar sua nova senha no portal Atletas Energisa. Ele vale por 1 hora e só funciona uma vez:\n\n${l.link}\n\nDepois é só entrar com ${l.email} e a senha nova.`;
}
