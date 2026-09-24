export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VisibilidadeBody {
  atletaId?: unknown;
  visivelNasListas?: unknown;
}

export async function PUT(request: Request) {
  try {
    const [{ FieldValue }, { authenticatedAdminRequest }, rankingModule, visibilityModule] =
      await Promise.all([
        import("firebase-admin/firestore"),
        import("@/lib/server/firebaseRequest"),
        import("@/lib/server/rankingPublisher"),
        import("@/lib/athleteVisibility"),
      ]);
    const { decodedToken, db } = await authenticatedAdminRequest(request);
    const body = (await request.json()) as VisibilidadeBody;
    const atletaId = typeof body.atletaId === "string" ? body.atletaId.trim() : "";

    if (!atletaId || atletaId.length > 200 || typeof body.visivelNasListas !== "boolean") {
      return Response.json({ error: "Os dados de visibilidade são inválidos." }, { status: 400 });
    }

    const atletaRef = db.collection("atletas").doc(atletaId);
    const atletaSnap = await atletaRef.get();
    if (!atletaSnap.exists) {
      return Response.json({ error: "O perfil de atleta não foi encontrado." }, { status: 404 });
    }

    const atleta = { id: atletaSnap.id, ...atletaSnap.data() } as import("@/lib/types").AtletaDoc;
    const visivelNasListas = body.visivelNasListas;
    const autorNome = decodedToken.name || decodedToken.email || "Administrador";
    const batch = db.batch();

    batch.update(atletaRef, {
      visivelNasListas,
      atualizadoEm: FieldValue.serverTimestamp(),
      ...(visivelNasListas
        ? {
            ocultadoEm: FieldValue.delete(),
            ocultadoPor: FieldValue.delete(),
          }
        : {
            ocultadoEm: FieldValue.serverTimestamp(),
            ocultadoPor: decodedToken.uid,
          }),
    });

    const publicoRef = db.collection("atletas_publicos").doc(atletaId);
    if (visivelNasListas) {
      batch.set(
        publicoRef,
        visibilityModule.dadosAtletaPublico({ ...atleta, visivelNasListas: true }),
      );
    } else {
      batch.delete(publicoRef);
    }

    batch.set(db.collection("auditoria").doc(), {
      acao: visivelNasListas ? "reativar_visibilidade_atleta" : "ocultar_visibilidade_atleta",
      entidade: "atletas",
      entidadeId: atletaId,
      dados: { nome: atleta.nome, visivelNasListas },
      criadoPor: decodedToken.uid,
      criadoPorNome: autorNome,
      criadoEm: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    let rankingAtualizado = true;
    try {
      await rankingModule.atualizarRankingDosAtletas({
        db,
        uid: decodedToken.uid,
        autorNome,
        atletaIds: [atletaId],
        origem: visivelNasListas ? "perfil_reativado" : "perfil_ocultado",
      });
    } catch (error) {
      rankingAtualizado = false;
      console.error("Perfil atualizado, mas o ranking não foi sincronizado:", error);
    }

    return Response.json({ ok: true, visivelNasListas, rankingAtualizado });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Os dados enviados são inválidos." }, { status: 400 });
    }
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível alterar a visibilidade deste perfil.");
  }
}
