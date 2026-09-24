export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RecalcularBody {
  modo?: "automatico" | "completo";
  atletaIds?: unknown;
  origem?: unknown;
  trimestre?: unknown;
}

function trimestreValido(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const trimestre = {
    ativo: item.ativo === true,
    nome: typeof item.nome === "string" ? item.nome.trim() : "",
    inicio: typeof item.inicio === "string" ? item.inicio : "",
    fim: typeof item.fim === "string" ? item.fim : "",
  };
  if (
    trimestre.ativo &&
    (!trimestre.nome || !trimestre.inicio || !trimestre.fim || trimestre.inicio > trimestre.fim)
  ) {
    return null;
  }
  return trimestre;
}

export async function POST(request: Request) {
  try {
    const [{ authenticatedFirebaseRequest, ApiAuthError }, rankingModule] = await Promise.all([
      import("@/lib/server/firebaseRequest"),
      import("@/lib/server/rankingPublisher"),
    ]);
    const { decodedToken, db } = await authenticatedFirebaseRequest(request);
    const usuarioSnap = await db.collection("usuarios").doc(decodedToken.uid).get();
    const usuario = usuarioSnap.data();
    const body = (await request.json()) as RecalcularBody;
    const modo = body.modo === "completo" ? "completo" : "automatico";
    const isAdmin = usuarioSnap.exists && usuario?.role === "administrador";
    const podeRegistrar =
      usuarioSnap.exists &&
      usuario?.role === "comite" &&
      Array.isArray(usuario.permissoes) &&
      usuario.permissoes.includes("registrar");

    if (!isAdmin && (!podeRegistrar || modo === "completo")) {
      throw new ApiAuthError("Você não tem permissão para atualizar o ranking.", 403);
    }

    const autorNome = decodedToken.name || decodedToken.email || "Equipe do programa";
    if (modo === "completo") {
      const trimestre = trimestreValido(body.trimestre);
      if (!trimestre) {
        return Response.json({ error: "A configuração do período é inválida." }, { status: 400 });
      }
      const resultado = await rankingModule.publicarRankingCompleto({
        db,
        uid: decodedToken.uid,
        autorNome,
        configOverride: trimestre,
      });
      return Response.json({ ...resultado, atualizadoEm: new Date().toISOString() });
    }

    const atletaIds = Array.isArray(body.atletaIds)
      ? [...new Set(body.atletaIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
      : [];
    if (atletaIds.length === 0 || atletaIds.length > 2000) {
      return Response.json({ error: "Informe os atletas alterados." }, { status: 400 });
    }
    const resultado = await rankingModule.atualizarRankingDosAtletas({
      db,
      uid: decodedToken.uid,
      autorNome,
      atletaIds,
      origem:
        typeof body.origem === "string"
          ? body.origem.trim().slice(0, 60)
          : "alteracao_pontuacao",
    });
    return Response.json({ ...resultado, atualizadoEm: new Date().toISOString() });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Os dados enviados são inválidos." }, { status: 400 });
    }
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível atualizar o ranking agora.");
  }
}
