import "server-only";

import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { atletaNoPublico, type OrigemPush, type PublicoPush } from "@/lib/push/regras";

export interface MensagemPush {
  titulo: string;
  corpo: string;
  /** Caminho do portal aberto ao tocar (ex.: /pesquisas/abc). */
  link: string;
  /** Mesma tag substitui a notificação anterior no aparelho. */
  tag?: string;
}

export interface DestinoPush {
  publico: PublicoPush;
  /** Quem não deve receber (já respondeu, já confirmou presença...). */
  excluir?: Set<string>;
  /** Só estas pessoas (envio individual): vale para qualquer cadastro escolhido. */
  somente?: Set<string>;
}

export interface ResultadoPush {
  /** Atletas com notificações ativas que entraram no envio. */
  atletas: number;
  aparelhos: number;
  enviados: number;
  falhas: number;
}

export function idDoToken(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 40);
}

const ERROS_TOKEN_MORTO = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/** Aparelhos inscritos de atletas ativos do público, já sem os excluídos. */
export async function aparelhosDoPublico(db: Firestore, destino: DestinoPush) {
  const tokens = await db.collection("push_tokens").get();
  const porAtleta = new Map<string, { id: string; token: string }[]>();
  for (const d of tokens.docs) {
    const { atletaId, token } = d.data() as { atletaId?: string; token?: string };
    if (!atletaId || !token || destino.excluir?.has(atletaId)) continue;
    if (destino.somente && !destino.somente.has(atletaId)) continue;
    porAtleta.set(atletaId, [...(porAtleta.get(atletaId) ?? []), { id: d.id, token }]);
  }
  if (porAtleta.size === 0) return { atletas: 0, aparelhos: [] as { id: string; token: string }[] };

  const atletas = await db.getAll(...[...porAtleta.keys()].map((id) => db.collection("atletas").doc(id)));
  const aparelhos: { id: string; token: string }[] = [];
  let total = 0;
  for (const a of atletas) {
    const dados = a.data() as { ativo?: boolean; equipe?: string } | undefined;
    if (!dados) continue;
    // Escolhidos um a um valem mesmo fora das equipes (ex.: membros do comitê).
    if (!destino.somente && (!dados.ativo || !atletaNoPublico(dados.equipe, destino.publico))) continue;
    total += 1;
    aparelhos.push(...(porAtleta.get(a.id) ?? []));
  }
  return { atletas: total, aparelhos };
}

/**
 * Envia para os aparelhos do público e limpa os que não existem mais.
 * Mensagem só de dados: o service worker do portal monta a notificação.
 */
export async function enviarPush(db: Firestore, destino: DestinoPush, mensagem: MensagemPush): Promise<ResultadoPush> {
  const { atletas, aparelhos } = await aparelhosDoPublico(db, destino);
  const resultado: ResultadoPush = { atletas, aparelhos: aparelhos.length, enviados: 0, falhas: 0 };
  if (aparelhos.length === 0) return resultado;

  const { getFirebaseMessaging } = await import("@/lib/firebaseAdmin");
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    // Emulador local: não há FCM. Conta como enviado para testar o fluxo.
    console.info(`[push simulado] ${mensagem.titulo} → ${aparelhos.length} aparelho(s)`);
    resultado.enviados = aparelhos.length;
    return resultado;
  }

  const mortos: string[] = [];
  for (let i = 0; i < aparelhos.length; i += 500) {
    const lote = aparelhos.slice(i, i + 500);
    const resposta = await messaging.sendEach(
      lote.map(({ token }) => ({
        token,
        webpush: {
          headers: { Urgency: "high", TTL: String(24 * 60 * 60) },
          data: {
            titulo: mensagem.titulo,
            corpo: mensagem.corpo,
            link: mensagem.link,
            tag: mensagem.tag ?? "",
          },
        },
      })),
    );
    resposta.responses.forEach((r, j) => {
      if (r.success) resultado.enviados += 1;
      else {
        resultado.falhas += 1;
        if (r.error && ERROS_TOKEN_MORTO.has(r.error.code)) mortos.push(lote[j].id);
      }
    });
  }
  if (mortos.length) {
    const batch = db.batch();
    mortos.forEach((id) => batch.delete(db.collection("push_tokens").doc(id)));
    await batch.commit();
  }
  return resultado;
}

/** Histórico do que foi enviado (tela do comitê). */
export async function registrarEnvio(
  db: Firestore,
  dados: {
    origem: OrigemPush;
    mensagem: MensagemPush;
    publico: PublicoPush;
    resultado: ResultadoPush;
    /** Envio individual: nomes de quem foi escolhido (para o histórico). */
    destinatarios?: string[];
    autorUid?: string;
    autorNome?: string;
  },
) {
  const { FieldValue } = await import("firebase-admin/firestore");
  await db.collection("push_envios").add({
    origem: dados.origem,
    titulo: dados.mensagem.titulo,
    corpo: dados.mensagem.corpo,
    link: dados.mensagem.link,
    publico: dados.publico,
    atletas: dados.resultado.atletas,
    aparelhos: dados.resultado.aparelhos,
    enviados: dados.resultado.enviados,
    falhas: dados.resultado.falhas,
    destinatarios: dados.destinatarios?.slice(0, 50) ?? null,
    autorUid: dados.autorUid ?? null,
    autorNome: dados.autorNome ?? null,
    criadoEm: FieldValue.serverTimestamp(),
  });
}

/**
 * Garante que um aviso automático saia uma vez só, mesmo com duas execuções ao
 * mesmo tempo: quem cria o documento de controle primeiro envia.
 */
export async function reservarAviso(db: Firestore, chave: string) {
  const { FieldValue } = await import("firebase-admin/firestore");
  try {
    await db.collection("push_controle").doc(chave).create({ em: FieldValue.serverTimestamp() });
    return true;
  } catch {
    return false;
  }
}
