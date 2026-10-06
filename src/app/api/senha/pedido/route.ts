export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mesmo pedido de novo antes disso não gera outro (evita repetição e abuso). */
const INTERVALO_MS = 2 * 60_000;

/**
 * Atleta sem acesso ao e-mail pede ao comitê um link de nova senha.
 * Sem login. A resposta é sempre a mesma, exista ou não a conta, para não
 * revelar quais e-mails estão cadastrados.
 */
export async function POST(request: Request) {
  const ok = Response.json({ ok: true });
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Digite um e-mail válido." }, { status: 400 });
    }
    const { getFirebaseAdmin } = await import("@/lib/firebaseAdmin");
    const { FieldValue, Timestamp } = await import("firebase-admin/firestore");
    const { auth, db } = getFirebaseAdmin();

    const usuarioAuth = await auth.getUserByEmail(email).catch(() => null);
    if (!usuarioAuth) return ok;
    const usuario = (await db.collection("usuarios").doc(usuarioAuth.uid).get()).data();
    if (!usuario) return ok;
    const atleta = usuario.atletaId ? (await db.collection("atletas").doc(String(usuario.atletaId)).get()).data() : undefined;

    const ref = db.collection("pedidos_senha").doc(usuarioAuth.uid);
    await db.runTransaction(async (tx) => {
      const atual = (await tx.get(ref)).data();
      const ultimo = (atual?.criadoEm as InstanceType<typeof Timestamp> | undefined)?.toMillis?.() ?? 0;
      if (atual?.status === "pendente" && Date.now() - ultimo < INTERVALO_MS) return;
      tx.set(ref, {
        uid: usuarioAuth.uid,
        email,
        nome: String(atleta?.nome || usuarioAuth.displayName || email.split("@")[0]),
        atletaId: usuario.atletaId ? String(usuario.atletaId) : null,
        equipe: atleta?.equipe ?? null,
        status: "pendente",
        criadoEm: FieldValue.serverTimestamp(),
      });
    });
    return ok;
  } catch (error) {
    console.error("Pedido de nova senha falhou:", error);
    // Mesmo com erro interno não damos pistas; o atleta pode falar direto com o comitê.
    return ok;
  }
}
