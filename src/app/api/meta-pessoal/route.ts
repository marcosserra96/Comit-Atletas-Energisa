export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta pessoal do mês (só no servidor, sem regra nova no Firestore).
 * GET → { metas } do próprio atleta; a gestão lê de qualquer um (?atletaId=, ao visualizar como atleta).
 * POST { competencia, tipo, valor } grava; POST { competencia, remover: true } apaga. Só o próprio atleta.
 */
const COLECAO = "metas_pessoais";

function hojeBrasil() {
  return new Date(Date.now() - 3 * 60 * 60_000).toISOString().slice(0, 10);
}

async function quem(request: Request) {
  const { authenticatedFirebaseRequest, ApiAuthError } = await import("@/lib/server/firebaseRequest");
  const { db, decodedToken } = await authenticatedFirebaseRequest(request);
  const usuario = (await db.collection("usuarios").doc(decodedToken.uid).get()).data();
  if (!usuario) throw new ApiAuthError("Seu acesso ainda não foi liberado.", 403);
  return { db, atletaId: String(usuario.atletaId || ""), staff: usuario.role === "administrador" || usuario.role === "comite", ApiAuthError };
}

export async function GET(request: Request) {
  try {
    const { db, atletaId, staff } = await quem(request);
    const pedido = new URL(request.url).searchParams.get("atletaId");
    const id = pedido && staff ? pedido.slice(0, 200) : atletaId;
    if (!id) return Response.json({ metas: {} });
    const dados = (await db.collection(COLECAO).doc(id).get()).data();
    return Response.json({ metas: (dados?.metas as Record<string, unknown> | undefined) ?? {} });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível carregar sua meta.");
  }
}

export async function POST(request: Request) {
  try {
    const { db, atletaId, ApiAuthError } = await quem(request);
    if (!atletaId) throw new ApiAuthError("A meta é para atletas.", 403);
    const { validarMetaPessoal, competenciaPermitida } = await import("@/lib/metaPessoal");
    const { FieldValue } = await import("firebase-admin/firestore");
    const corpo = (await request.json().catch(() => ({}))) as { competencia?: unknown; remover?: unknown };
    const competencia = String(corpo.competencia ?? "");
    if (!competenciaPermitida(competencia, hojeBrasil())) throw new ApiAuthError("A meta pode ser do mês atual ou do próximo.", 400);
    const ref = db.collection(COLECAO).doc(atletaId);
    if (corpo.remover === true) {
      await ref.set({ metas: { [competencia]: FieldValue.delete() }, atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
      return Response.json({ ok: true });
    }
    const r = validarMetaPessoal(corpo);
    if ("erro" in r) throw new ApiAuthError(r.erro, 400);
    await ref.set({ metas: { [competencia]: r.meta }, atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
    return Response.json({ ok: true, meta: r.meta });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível salvar sua meta agora.");
  }
}
