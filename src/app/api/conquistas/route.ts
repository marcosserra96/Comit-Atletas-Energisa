export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET → { medalhas: { id: "YYYY-MM-DD" } } registradas pelo servidor (pódio,
 * liderança e as já avisadas). O atleta lê as próprias; a gestão pode ler de
 * qualquer atleta (?atletaId=, ao visualizar como atleta).
 */
export async function GET(request: Request) {
  try {
    const { authenticatedFirebaseRequest, ApiAuthError } = await import("@/lib/server/firebaseRequest");
    const { db, decodedToken } = await authenticatedFirebaseRequest(request);
    const usuario = (await db.collection("usuarios").doc(decodedToken.uid).get()).data();
    if (!usuario) throw new ApiAuthError("Seu acesso ainda não foi liberado.", 403);
    const pedido = new URL(request.url).searchParams.get("atletaId");
    const staff = usuario.role === "administrador" || usuario.role === "comite";
    const atletaId = pedido && staff ? pedido : String(usuario.atletaId || "");
    if (!atletaId) return Response.json({ medalhas: {} });
    const dados = (await db.collection("conquistas").doc(atletaId).get()).data();
    return Response.json({ medalhas: (dados?.medalhas as Record<string, string> | undefined) ?? {} });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível carregar as conquistas.");
  }
}
