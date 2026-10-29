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
    const plataforma = String((body as { plataforma?: unknown }).plataforma ?? "").slice(0, 20);
    const ref = db.collection("push_tokens").doc(idDoToken(token));

    if (!atletaId) {
      // Quem pediu acesso e ainda espera a liberação: o aparelho fica guardado só
      // para o aviso "acesso liberado" (sem atleta, não recebe mais nada).
      const solicitacao = (await db.collection("solicitacoes_acesso").doc(decodedToken.uid).get()).data();
      if (solicitacao?.status !== "pendente") return Response.json({ error: "Notificações são para atletas." }, { status: 403 });
      await ref.set({ token, uid: decodedToken.uid, aguardandoAcesso: true, plataforma, atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
      return Response.json({ ok: true, aguardando: true });
    }

    await ref.set(
      {
        token,
        uid: decodedToken.uid,
        atletaId,
        aguardandoAcesso: FieldValue.delete(),
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
