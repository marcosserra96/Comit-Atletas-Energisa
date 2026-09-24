export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMOS_PADRAO = {
  titulo: "Termos do Programa",
  conteudo: "",
  ativo: false,
  versao: 0,
};

function dataIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate: () => Date }).toDate;
    return toDate.call(value).toISOString();
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { authenticatedAdminRequest } = await import("@/lib/server/firebaseRequest");
    const { db } = await authenticatedAdminRequest(request);
    const [termosSnap, aceitesSnap] = await Promise.all([
      db.collection("configuracoes").doc("termos_programa").get(),
      db.collection("aceites_termos").orderBy("aceitoEm", "desc").limit(500).get(),
    ]);
    const termos = termosSnap.data();

    return Response.json({
      termos: termosSnap.exists
        ? {
            titulo: termos?.titulo || TERMOS_PADRAO.titulo,
            conteudo: termos?.conteudo || "",
            ativo: termos?.ativo === true,
            versao: Number(termos?.versao) || 0,
            atualizadoEm: dataIso(termos?.atualizadoEm),
          }
        : TERMOS_PADRAO,
      aceites: aceitesSnap.docs.map((documento) => {
        const aceite = documento.data();
        return {
          uid: documento.id,
          atletaId: aceite.atletaId || "",
          nome: aceite.nome || "Usuário",
          email: aceite.email || "",
          versao: Number(aceite.versao) || 0,
          aceitoEm: dataIso(aceite.aceitoEm),
        };
      }),
    });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível carregar os termos do programa.");
  }
}

export async function PUT(request: Request) {
  try {
    const [{ FieldValue }, { authenticatedAdminRequest }] = await Promise.all([
      import("firebase-admin/firestore"),
      import("@/lib/server/firebaseRequest"),
    ]);
    const { decodedToken, db } = await authenticatedAdminRequest(request);
    const body = (await request.json()) as {
      titulo?: unknown;
      conteudo?: unknown;
      ativo?: unknown;
    };
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    const conteudo = typeof body.conteudo === "string" ? body.conteudo.trim() : "";
    const ativo = body.ativo === true;

    if (!titulo || titulo.length > 120) {
      return Response.json(
        { error: "Informe um título com até 120 caracteres." },
        { status: 400 },
      );
    }
    if (conteudo.length > 50000) {
      return Response.json(
        { error: "O texto dos termos deve ter no máximo 50.000 caracteres." },
        { status: 400 },
      );
    }
    if (ativo && conteudo.length < 20) {
      return Response.json(
        { error: "Inclua o texto completo dos termos antes de ativá-los." },
        { status: 400 },
      );
    }

    const termosRef = db.collection("configuracoes").doc("termos_programa");
    const resultado = await db.runTransaction(async (transaction) => {
      const atualSnap = await transaction.get(termosRef);
      const atual = atualSnap.data();
      const textoAlterado = !atualSnap.exists || atual?.titulo !== titulo || atual?.conteudo !== conteudo;
      const versaoAtual = Number(atual?.versao) || 0;
      const versao = textoAlterado ? Math.max(1, versaoAtual + 1) : versaoAtual;

      transaction.set(termosRef, {
        titulo,
        conteudo,
        ativo,
        versao,
        atualizadoEm: FieldValue.serverTimestamp(),
        atualizadoPor: decodedToken.uid,
      });
      transaction.set(db.collection("auditoria").doc(), {
        acao: textoAlterado ? "termos_programa_nova_versao" : "termos_programa_status_alterado",
        entidade: "configuracoes",
        entidadeId: "termos_programa",
        dados: { ativo, versao },
        criadoPor: decodedToken.uid,
        criadoPorNome: decodedToken.name || decodedToken.email || "Administrador",
        criadoEm: FieldValue.serverTimestamp(),
      });

      return { versao, textoAlterado };
    });

    return Response.json({
      ok: true,
      versao: resultado.versao,
      novaVersao: resultado.textoAlterado,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Os dados enviados são inválidos." }, { status: 400 });
    }
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível salvar os termos do programa.");
  }
}
