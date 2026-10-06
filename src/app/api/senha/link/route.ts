export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Comitê (permissão Atletas) gera um link de nova senha para um atleta e o
 * envia por WhatsApp. Usa o link oficial do Firebase (vale 1 hora, uso único),
 * apontando para a página de redefinição do próprio portal. Nada é enviado
 * por e-mail.
 */
export async function POST(request: Request) {
  try {
    const { authenticatedPermissionRequest } = await import("@/lib/server/firebaseRequest");
    const { getFirebaseAdmin } = await import("@/lib/firebaseAdmin");
    const { FieldValue } = await import("firebase-admin/firestore");
    const { db, decodedToken, usuario } = await authenticatedPermissionRequest(request, "atletas");
    const { auth } = getFirebaseAdmin();

    const body = (await request.json().catch(() => ({}))) as { atletaId?: unknown; uid?: unknown };
    let uid = typeof body.uid === "string" ? body.uid : "";
    let nome = "";
    if (!uid && typeof body.atletaId === "string") {
      const atleta = (await db.collection("atletas").doc(body.atletaId).get()).data();
      uid = String(atleta?.authUid || "");
      nome = String(atleta?.nome || "");
    }
    if (!uid) return Response.json({ error: "Este atleta ainda não tem acesso ao portal." }, { status: 404 });

    const conta = await auth.getUser(uid).catch(() => null);
    if (!conta?.email) return Response.json({ error: "Conta de acesso não encontrada." }, { status: 404 });

    // Não deixa o comitê trocar a senha de administradores (só um administrador pode).
    const alvo = (await db.collection("usuarios").doc(uid).get()).data();
    if (alvo?.role === "administrador" && usuario.role !== "administrador") {
      return Response.json({ error: "Só um administrador pode gerar o link para outro administrador." }, { status: 403 });
    }

    const linkFirebase = await auth.generatePasswordResetLink(conta.email);
    const oobCode = new URL(linkFirebase).searchParams.get("oobCode");
    if (!oobCode) throw new Error("Link sem código.");
    const origem = new URL(request.url).origin;
    const link = `${origem}/redefinir-senha?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`;

    if (!nome && alvo?.atletaId) {
      nome = String((await db.collection("atletas").doc(String(alvo.atletaId)).get()).data()?.nome || "");
    }

    const batch = db.batch();
    const pedido = db.collection("pedidos_senha").doc(uid);
    if ((await pedido.get()).exists) {
      batch.set(
        pedido,
        { status: "atendido", atendidoEm: FieldValue.serverTimestamp(), atendidoPor: usuario.nome ?? decodedToken.uid },
        { merge: true },
      );
    }
    batch.set(db.collection("auditoria").doc(), {
      acao: "gerar_link_senha",
      entidade: "atletas",
      entidadeId: String(alvo?.atletaId || uid),
      dados: { email: conta.email },
      criadoPor: decodedToken.uid,
      criadoPorNome: usuario.nome ?? null,
      criadoEm: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return Response.json({
      link,
      email: conta.email,
      nome: nome || conta.displayName || conta.email,
      expiraEm: new Date(Date.now() + 60 * 60_000).toISOString(),
    });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível gerar o link agora.");
  }
}
