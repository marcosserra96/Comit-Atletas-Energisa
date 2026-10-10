import { normalizarPreferencias, PREFERENCIAS_PADRAO, type TipoAviso } from "@/lib/push/automaticos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function meuAtleta(request: Request) {
  const { authenticatedFirebaseRequest, ApiAuthError } = await import("@/lib/server/firebaseRequest");
  const { db, decodedToken } = await authenticatedFirebaseRequest(request);
  const usuario = (await db.collection("usuarios").doc(decodedToken.uid).get()).data();
  const atletaId = String(usuario?.atletaId || "");
  if (!atletaId) throw new ApiAuthError("Seu acesso ainda não foi liberado.", 403);
  return { db, ref: db.collection("push_preferencias").doc(atletaId) };
}

/** O que esta pessoa escolheu receber (padrão: tudo ligado). */
export async function GET(request: Request) {
  try {
    const { ref } = await meuAtleta(request);
    return Response.json({ preferencias: normalizarPreferencias((await ref.get()).data()) });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível carregar suas preferências.");
  }
}

/** POST { tipo, ativo }: liga ou desliga um tipo de aviso. */
export async function POST(request: Request) {
  try {
    const { ref } = await meuAtleta(request);
    const corpo = (await request.json().catch(() => ({}))) as { tipo?: unknown; ativo?: unknown };
    const tipo = String(corpo.tipo) as TipoAviso;
    if (!(tipo in PREFERENCIAS_PADRAO) || typeof corpo.ativo !== "boolean") {
      return Response.json({ error: "Preferência inválida." }, { status: 400 });
    }
    const { FieldValue } = await import("firebase-admin/firestore");
    await ref.set({ [tipo]: corpo.ativo, atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
    return Response.json({ preferencias: normalizarPreferencias((await ref.get()).data()) });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível salvar agora.");
  }
}
