import { createHash } from "node:crypto";
import type { DocumentoProgramaDoc, DocumentoProgramaId } from "@/lib/types";
import {
  DOCUMENTOS_POR_MODALIDADE,
  aceiteDocumentoProgramaId,
  configDocumentoProgramaId,
  documentoProgramaComFallback,
  documentoProgramaValido,
  modalidadeDocumentoDaEquipe,
} from "@/lib/termosPrograma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const [{ FieldValue }, { authenticatedFirebaseRequest }] = await Promise.all([
      import("firebase-admin/firestore"),
      import("@/lib/server/firebaseRequest"),
    ]);
    const { decodedToken, db } = await authenticatedFirebaseRequest(request);
    const body = (await request.json()) as { documentos?: unknown };
    if (!Array.isArray(body.documentos) || body.documentos.length === 0) {
      return Response.json({ error: "Informe os documentos que foram lidos." }, { status: 400 });
    }
    const versoesLidas = new Map<DocumentoProgramaId, number>();
    for (const item of body.documentos) {
      if (!item || typeof item !== "object") {
        return Response.json({ error: "Documento informado é inválido." }, { status: 400 });
      }
      const registro = item as Record<string, unknown>;
      if (!documentoProgramaValido(registro.id) || !Number.isInteger(Number(registro.versao))) {
        return Response.json({ error: "Documento informado é inválido." }, { status: 400 });
      }
      versoesLidas.set(registro.id, Number(registro.versao));
    }
    const usuarioRef = db.collection("usuarios").doc(decodedToken.uid);

    const aceitos = await db.runTransaction(async (transaction) => {
      const usuarioSnap = await transaction.get(usuarioRef);
      if (!usuarioSnap.exists) throw new Error("ACCESS_NOT_APPROVED");

      const atletaId = String(usuarioSnap.data()?.atletaId || "");
      const atletaRef = db.collection("atletas").doc(atletaId);
      const atletaSnap = await transaction.get(atletaRef);
      if (!atletaSnap.exists) throw new Error("ATHLETE_NOT_FOUND");

      const atleta = atletaSnap.data();
      const modalidade = modalidadeDocumentoDaEquipe(String(atleta?.equipe || ""));
      if (!modalidade) throw new Error("ATHLETE_MODALITY_NOT_FOUND");

      const ids = DOCUMENTOS_POR_MODALIDADE[modalidade];
      const configRefs = ids.map((id) =>
        db.collection("configuracoes").doc(configDocumentoProgramaId(id)),
      );
      const aceiteRefs = ids.map((id) =>
        db
          .collection("aceites_documentos_programa")
          .doc(aceiteDocumentoProgramaId(decodedToken.uid, id)),
      );
      const configSnaps = await Promise.all(configRefs.map((ref) => transaction.get(ref)));
      const aceiteSnaps = await Promise.all(aceiteRefs.map((ref) => transaction.get(ref)));

      const documentos = ids.map((id, index) =>
        documentoProgramaComFallback(
          id,
          configSnaps[index].exists
            ? (configSnaps[index].data() as Partial<DocumentoProgramaDoc>)
            : undefined,
        ),
      );
      const pendentes = documentos.filter((documento, index) => {
        if (!documento.ativo || !documento.conteudo.trim()) return false;
        return Number(aceiteSnaps[index].data()?.versao) !== documento.versao;
      });
      if (
        pendentes.some(
          (documento) => versoesLidas.get(documento.id) !== documento.versao,
        )
      ) {
        throw new Error("DOCUMENTS_CHANGED");
      }

      for (const documento of pendentes) {
        const aceiteRef = db
          .collection("aceites_documentos_programa")
          .doc(aceiteDocumentoProgramaId(decodedToken.uid, documento.id));
        const registro = {
          uid: decodedToken.uid,
          atletaId,
          nome: atleta?.nome || decodedToken.name || "Usuário",
          email: atleta?.email || decodedToken.email || "",
          documentoId: documento.id,
          modalidade: documento.modalidade,
          tipo: documento.tipo,
          titulo: documento.titulo,
          conteudo: documento.conteudo,
          hashConteudo: createHash("sha256").update(documento.conteudo, "utf8").digest("hex"),
          versao: documento.versao,
          aceitoEm: FieldValue.serverTimestamp(),
        };

        transaction.set(aceiteRef, registro);
        transaction.set(aceiteRef.collection("historico").doc(`v${documento.versao}`), registro);
        transaction.set(db.collection("auditoria").doc(), {
          acao: "documento_programa_aceito",
          entidade: "aceites_documentos_programa",
          entidadeId: aceiteRef.id,
          dados: {
            atletaId,
            documentoId: documento.id,
            modalidade: documento.modalidade,
            tipo: documento.tipo,
            versao: documento.versao,
            email: registro.email,
            hashConteudo: registro.hashConteudo,
          },
          criadoPor: decodedToken.uid,
          criadoPorNome: registro.nome,
          criadoEm: FieldValue.serverTimestamp(),
        });
      }

      return pendentes.map((documento) => documento.id);
    });

    return Response.json({ ok: true, documentosAceitos: aceitos });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ACCESS_NOT_APPROVED") {
        return Response.json({ error: "Seu acesso ainda não foi liberado." }, { status: 403 });
      }
      if (error.message === "ATHLETE_NOT_FOUND") {
        return Response.json({ error: "Seu vínculo de atleta não foi encontrado." }, { status: 409 });
      }
      if (error.message === "ATHLETE_MODALITY_NOT_FOUND") {
        return Response.json({ error: "Sua modalidade ainda não foi definida." }, { status: 409 });
      }
      if (error.message === "DOCUMENTS_CHANGED") {
        return Response.json(
          { error: "Os documentos foram atualizados. Leia as novas versões antes de continuar." },
          { status: 409 },
        );
      }
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Os dados enviados são inválidos." }, { status: 400 });
    }
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível registrar os aceites agora.");
  }
}
