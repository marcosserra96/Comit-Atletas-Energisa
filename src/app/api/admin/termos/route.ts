import type { DocumentoProgramaDoc, DocumentoProgramaId } from "@/lib/types";
import {
  DOCUMENTO_PROGRAMA_IDS,
  configDocumentoProgramaId,
  documentoProgramaComFallback,
  documentoProgramaValido,
} from "@/lib/termosPrograma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const configRefs = DOCUMENTO_PROGRAMA_IDS.map((id) =>
      db.collection("configuracoes").doc(configDocumentoProgramaId(id)),
    );
    const [configSnaps, aceitesSnap] = await Promise.all([
      db.getAll(...configRefs),
      db.collection("aceites_documentos_programa").orderBy("aceitoEm", "desc").limit(1000).get(),
    ]);

    const documentos = configSnaps.map((snapshot, index) => {
      const documento = documentoProgramaComFallback(
        DOCUMENTO_PROGRAMA_IDS[index],
        snapshot.exists ? (snapshot.data() as Partial<DocumentoProgramaDoc>) : undefined,
      );
      return { ...documento, atualizadoEm: dataIso(documento.atualizadoEm) };
    });

    return Response.json({
      documentos,
      aceites: aceitesSnap.docs.map((snapshot) => {
        const aceite = snapshot.data();
        return {
          uid: aceite.uid || "",
          atletaId: aceite.atletaId || "",
          nome: aceite.nome || "Usuário",
          email: aceite.email || "",
          documentoId: aceite.documentoId || "",
          modalidade: aceite.modalidade || "",
          tipo: aceite.tipo || "",
          titulo: aceite.titulo || "Documento do programa",
          versao: Number(aceite.versao) || 0,
          aceitoEm: dataIso(aceite.aceitoEm),
        };
      }),
    });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível carregar os documentos do programa.");
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
      id?: unknown;
      titulo?: unknown;
      conteudo?: unknown;
      ativo?: unknown;
    };
    if (!documentoProgramaValido(body.id)) {
      return Response.json({ error: "Documento inválido." }, { status: 400 });
    }

    const documentoId: DocumentoProgramaId = body.id;
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    const conteudo = typeof body.conteudo === "string" ? body.conteudo.trim() : "";
    const ativo = body.ativo === true;

    if (!titulo || titulo.length > 160) {
      return Response.json(
        { error: "Informe um título com até 160 caracteres." },
        { status: 400 },
      );
    }
    if (conteudo.length > 50000) {
      return Response.json(
        { error: "O texto do documento deve ter no máximo 50.000 caracteres." },
        { status: 400 },
      );
    }
    if (ativo && conteudo.length < 20) {
      return Response.json(
        { error: "Inclua o texto completo antes de ativar o documento." },
        { status: 400 },
      );
    }

    const configRef = db.collection("configuracoes").doc(configDocumentoProgramaId(documentoId));
    const resultado = await db.runTransaction(async (transaction) => {
      const atualSnap = await transaction.get(configRef);
      const atual = documentoProgramaComFallback(
        documentoId,
        atualSnap.exists ? (atualSnap.data() as Partial<DocumentoProgramaDoc>) : undefined,
      );
      const textoAlterado = atual.titulo !== titulo || atual.conteudo !== conteudo;
      const versao = textoAlterado ? atual.versao + 1 : atual.versao;
      const atualizado = {
        id: documentoId,
        modalidade: atual.modalidade,
        tipo: atual.tipo,
        titulo,
        conteudo,
        ativo,
        versao,
        atualizadoEm: FieldValue.serverTimestamp(),
        atualizadoPor: decodedToken.uid,
      };

      transaction.set(configRef, atualizado);
      transaction.set(db.collection("auditoria").doc(), {
        acao: textoAlterado
          ? "documento_programa_nova_versao"
          : "documento_programa_status_alterado",
        entidade: "configuracoes",
        entidadeId: configDocumentoProgramaId(documentoId),
        dados: {
          documentoId,
          modalidade: atual.modalidade,
          tipo: atual.tipo,
          ativo,
          versao,
        },
        criadoPor: decodedToken.uid,
        criadoPorNome: decodedToken.name || decodedToken.email || "Administrador",
        criadoEm: FieldValue.serverTimestamp(),
      });

      return { versao, textoAlterado, atual };
    });

    return Response.json({
      ok: true,
      novaVersao: resultado.textoAlterado,
      documento: {
        id: documentoId,
        modalidade: resultado.atual.modalidade,
        tipo: resultado.atual.tipo,
        titulo,
        conteudo,
        ativo,
        versao: resultado.versao,
        atualizadoEm: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Os dados enviados são inválidos." }, { status: 400 });
    }
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível salvar o documento do programa.");
  }
}
