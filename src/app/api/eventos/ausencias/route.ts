import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import {
  ApiAuthError,
  apiErrorResponse,
  authenticatedFirebaseRequest,
  authenticatedPermissionRequest,
} from "@/lib/server/firebaseRequest";
import { idAusenciaEvento, validarAusenciaEvento, type AusenciaEvento } from "@/lib/ausenciasEvento";
import type { EventoDoc, UsuarioDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLECAO = "ausencias_eventos";

function hojeBrasil() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function paraApi(dados: FirebaseFirestore.DocumentData): AusenciaEvento {
  const em = dados.atualizadoEm as Timestamp | undefined;
  return {
    eventoId: String(dados.eventoId || ""),
    atletaId: String(dados.atletaId || ""),
    motivo: dados.motivo,
    detalhe: String(dados.detalhe || ""),
    em: em?.toDate ? em.toDate().toISOString() : null,
  };
}

/** Atleta logado (a ausência é sempre do próprio cadastro). */
async function atletaDaSessao(request: Request) {
  const ctx = await authenticatedFirebaseRequest(request);
  const snap = await ctx.db.collection("usuarios").doc(ctx.decodedToken.uid).get();
  const usuario = snap.data() as UsuarioDoc | undefined;
  if (!usuario?.atletaId) throw new ApiAuthError("Seu cadastro de atleta não foi encontrado.", 409);
  return { ...ctx, atletaId: usuario.atletaId };
}

async function eventoAberto(db: FirebaseFirestore.Firestore, eventoId: unknown) {
  if (typeof eventoId !== "string" || !eventoId || eventoId.length > 200) {
    throw new ApiAuthError("Evento inválido.", 400);
  }
  const ref = db.collection("agenda_eventos").doc(eventoId);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiAuthError("Este evento não está mais na agenda.", 404);
  const evento = snap.data() as EventoDoc;
  if (evento.data < hojeBrasil()) throw new ApiAuthError("Este evento já passou.", 409);
  return { ref, evento };
}

/**
 * GET              → avisos do próprio atleta (para a tela mostrar "você avisou que não vai").
 * GET ?evento=ID   → quem avisou que não vai, com o motivo (comitê com permissão de eventos).
 */
export async function GET(request: Request) {
  try {
    const eventoId = new URL(request.url).searchParams.get("evento");
    if (eventoId) {
      const { db } = await authenticatedPermissionRequest(request, "eventos");
      const snap = await db.collection(COLECAO).where("eventoId", "==", eventoId).limit(500).get();
      return Response.json({ ausencias: snap.docs.map((d) => paraApi(d.data())) });
    }
    const { db, atletaId } = await atletaDaSessao(request);
    const snap = await db.collection(COLECAO).where("atletaId", "==", atletaId).limit(300).get();
    const hoje = hojeBrasil();
    const ausencias = snap.docs
      .map((d) => d.data())
      .filter((d) => typeof d.dataEvento !== "string" || d.dataEvento >= hoje)
      .map(paraApi);
    return Response.json({ ausencias });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível carregar os avisos de ausência.");
  }
}

/** Atleta avisa que não vai: grava o motivo e tira a confirmação, se havia. */
export async function POST(request: Request) {
  try {
    const { db, atletaId } = await atletaDaSessao(request);
    const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const dados = validarAusenciaEvento(corpo);
    if ("erro" in dados) throw new ApiAuthError(dados.erro, 400);
    const { ref, evento } = await eventoAberto(db, corpo.eventoId);

    const batch = db.batch();
    batch.set(db.collection(COLECAO).doc(idAusenciaEvento(ref.id, atletaId)), {
      eventoId: ref.id,
      atletaId,
      dataEvento: evento.data,
      motivo: dados.motivo,
      detalhe: dados.detalhe,
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    batch.update(ref, { inscritos: FieldValue.arrayRemove(atletaId) });
    await batch.commit();
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível registrar seu aviso agora.");
  }
}

/** Mudou de ideia: apaga o aviso (a confirmação é feita pelo app em seguida). */
export async function DELETE(request: Request) {
  try {
    const { db, atletaId } = await atletaDaSessao(request);
    const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof corpo.eventoId !== "string" || !corpo.eventoId) throw new ApiAuthError("Evento inválido.", 400);
    await db.collection(COLECAO).doc(idAusenciaEvento(corpo.eventoId, atletaId)).delete();
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível atualizar seu aviso agora.");
  }
}
