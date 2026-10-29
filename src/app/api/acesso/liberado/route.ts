export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { uid } logo depois de liberar um pedido de acesso: manda o aviso
 * "Seu acesso foi liberado" para os aparelhos que a pessoa ativou na tela de
 * espera. O agendador faz o mesmo a cada 5 min (se esta chamada falhar, o
 * aviso sai na próxima rodada); cada aparelho é avisado uma vez só.
 */
export async function POST(request: Request) {
  try {
    const { authenticatedPermissionRequest } = await import("@/lib/server/firebaseRequest");
    const { db } = await authenticatedPermissionRequest(request, "atletas");
    const uid = (await request.json().catch(() => ({})) as { uid?: unknown }).uid;
    if (typeof uid !== "string" || !uid || uid.length > 128) return Response.json({ error: "Pedido não identificado." }, { status: 400 });
    const { avisarAcessosLiberados } = await import("@/lib/server/avisosAutomaticos");
    const avisados = await avisarAcessosLiberados(db, uid);
    return Response.json({ ok: true, avisados });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível avisar agora; o aviso sai na próxima rodada automática.");
  }
}
