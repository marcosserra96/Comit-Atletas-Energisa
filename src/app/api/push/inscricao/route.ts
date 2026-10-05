export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function lerToken(body: unknown) {
  const token = (body as { token?: unknown })?.token;
  return typeof token === "string" && token.length > 20 && token.length < 4096 ? token : "";
}

/** Atleta ativa as notificações neste aparelho (ou renova o token). */
export async function POST(request: Request) {
  try {
    const { authenticatedFirebaseRequest } = await import("@/lib/server/firebaseRequest");
    const { idDoToken } = await import("@/lib/server/push");
    const { FieldValue } = await import("firebase-admin/firestore");
    const { decodedToken, db } = await authenticatedFirebaseRequest(request);
    const body = await request.json().catch(() => ({}));
    const token = lerToken(body);
    if (!token) return Response.json({ error: "Aparelho não identificado." }, { status: 400 });

    const usuario = (await db.collection("usuarios").doc(decodedToken.uid).get()).data();
    const atletaId = String(usuario?.atletaId || "");
    if (!atletaId) return Response.json({ error: "Notificações são para atletas." }, { status: 403 });

    const plataforma = String((body as { plataforma?: unknown }).plataforma ?? "").slice(0, 20);
    const ref = db.collection("push_tokens").doc(idDoToken(token));
    await ref.set(
      {
        token,
        uid: decodedToken.uid,
        atletaId,
        plataforma,
        atualizadoEm: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return Response.json({ ok: true });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível ativar as notificações agora.");
  }
}

/** Sair ou desativar: este aparelho para de receber. */
export async function DELETE(request: Request) {
  try {
    const { authenticatedFirebaseRequest } = await import("@/lib/server/firebaseRequest");
    const { idDoToken } = await import("@/lib/server/push");
    const { decodedToken, db } = await authenticatedFirebaseRequest(request);
    const token = lerToken(await request.json().catch(() => ({})));
    if (!token) return Response.json({ ok: true });
    const ref = db.collection("push_tokens").doc(idDoToken(token));
    const atual = await ref.get();
    if (atual.exists && atual.data()?.uid === decodedToken.uid) await ref.delete();
    return Response.json({ ok: true });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível desativar agora.");
  }
}
