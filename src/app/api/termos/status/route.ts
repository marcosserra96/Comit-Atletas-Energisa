export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { authenticatedFirebaseRequest } = await import("@/lib/server/firebaseRequest");
    const { decodedToken, db } = await authenticatedFirebaseRequest(request);
    const [usuarioSnap, termosSnap] = await Promise.all([
      db.collection("usuarios").doc(decodedToken.uid).get(),
      db.collection("configuracoes").doc("termos_programa").get(),
    ]);
    if (!usuarioSnap.exists) {
      return Response.json({ error: "Seu acesso ainda não foi liberado." }, { status: 403 });
    }
    const termos = termosSnap.data();

    if (!termosSnap.exists || termos?.ativo !== true || !termos?.conteudo?.trim()) {
      return Response.json({ exigido: false });
    }

    const versao = Number(termos.versao) || 1;
    const aceiteSnap = await db.collection("aceites_termos").doc(decodedToken.uid).get();
    const aceite = aceiteSnap.data();

    if (aceiteSnap.exists && Number(aceite?.versao) === versao) {
      return Response.json({ exigido: false });
    }

    return Response.json({
      exigido: true,
      termos: {
        titulo: termos.titulo?.trim() || "Termos do Programa",
        conteudo: termos.conteudo,
        versao,
      },
    });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível verificar os termos do programa.");
  }
}
