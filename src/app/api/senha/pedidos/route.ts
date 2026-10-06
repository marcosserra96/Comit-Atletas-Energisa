export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pedidos de nova senha ainda pendentes (Início do comitê). */
export async function GET(request: Request) {
  try {
    const { authenticatedPermissionRequest } = await import("@/lib/server/firebaseRequest");
    const { db } = await authenticatedPermissionRequest(request, "atletas");
    const snap = await db.collection("pedidos_senha").where("status", "==", "pendente").get();
    const pedidos = snap.docs
      .map((d) => {
        const p = d.data();
        return {
          uid: d.id,
          email: String(p.email || ""),
          nome: String(p.nome || ""),
          atletaId: p.atletaId ?? null,
          equipe: p.equipe ?? null,
          criadoEm: p.criadoEm?.toDate?.().toISOString() ?? null,
        };
      })
      .sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
    return Response.json({ pedidos });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível carregar os pedidos.");
  }
}

/** Dispensar um pedido (ex.: resolvido pessoalmente). */
export async function DELETE(request: Request) {
  try {
    const { authenticatedPermissionRequest } = await import("@/lib/server/firebaseRequest");
    const { FieldValue } = await import("firebase-admin/firestore");
    const { db, usuario } = await authenticatedPermissionRequest(request, "atletas");
    const body = (await request.json().catch(() => ({}))) as { uid?: unknown };
    if (typeof body.uid !== "string" || !body.uid) return Response.json({ error: "Pedido inválido." }, { status: 400 });
    await db
      .collection("pedidos_senha")
      .doc(body.uid)
      .set({ status: "dispensado", atendidoEm: FieldValue.serverTimestamp(), atendidoPor: usuario.nome ?? null }, { merge: true });
    return Response.json({ ok: true });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível dispensar o pedido.");
  }
}
