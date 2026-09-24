export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const [{ FieldValue }, { authenticatedFirebaseRequest }] = await Promise.all([
      import("firebase-admin/firestore"),
      import("@/lib/server/firebaseRequest"),
    ]);
    const { decodedToken, db } = await authenticatedFirebaseRequest(request);
    const usuarioRef = db.collection("usuarios").doc(decodedToken.uid);
    const termosRef = db.collection("configuracoes").doc("termos_programa");
    const aceiteRef = db.collection("aceites_termos").doc(decodedToken.uid);

    await db.runTransaction(async (transaction) => {
      const [usuarioSnap, termosSnap] = await Promise.all([
        transaction.get(usuarioRef),
        transaction.get(termosRef),
      ]);
      if (!usuarioSnap.exists) throw new Error("ACCESS_NOT_APPROVED");

      const termos = termosSnap.data();
      if (!termosSnap.exists || termos?.ativo !== true || !termos?.conteudo?.trim()) {
        throw new Error("TERMS_NOT_AVAILABLE");
      }

      const usuario = usuarioSnap.data();
      const atletaId = String(usuario?.atletaId || "");
      const atletaRef = db.collection("atletas").doc(atletaId);
      const atletaSnap = await transaction.get(atletaRef);
      if (!atletaSnap.exists) throw new Error("ATHLETE_NOT_FOUND");

      const atleta = atletaSnap.data();
      const versao = Number(termos.versao) || 1;
      const registro = {
        uid: decodedToken.uid,
        atletaId,
        nome: atleta?.nome || decodedToken.name || "Usuário",
        email: atleta?.email || decodedToken.email || "",
        versao,
        titulo: termos.titulo?.trim() || "Termos do Programa",
        conteudo: termos.conteudo,
        aceitoEm: FieldValue.serverTimestamp(),
      };

      transaction.set(aceiteRef, registro);
      transaction.set(aceiteRef.collection("historico").doc(`v${versao}`), registro);
      transaction.set(db.collection("auditoria").doc(), {
        acao: "termos_programa_aceitos",
        entidade: "aceites_termos",
        entidadeId: decodedToken.uid,
        dados: { atletaId, versao, email: registro.email },
        criadoPor: decodedToken.uid,
        criadoPorNome: registro.nome,
        criadoEm: FieldValue.serverTimestamp(),
      });
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ACCESS_NOT_APPROVED") {
        return Response.json({ error: "Seu acesso ainda não foi liberado." }, { status: 403 });
      }
      if (error.message === "TERMS_NOT_AVAILABLE") {
        return Response.json({ error: "Os termos não estão disponíveis no momento." }, { status: 409 });
      }
      if (error.message === "ATHLETE_NOT_FOUND") {
        return Response.json({ error: "Seu vínculo de atleta não foi encontrado." }, { status: 409 });
      }
    }
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível registrar o aceite agora.");
  }
}
