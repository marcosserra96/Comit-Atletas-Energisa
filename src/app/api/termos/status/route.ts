import type { DocumentoProgramaDoc } from "@/lib/types";
import {
  DOCUMENTOS_POR_MODALIDADE,
  aceiteDocumentoProgramaId,
  configDocumentoProgramaId,
  documentoProgramaComFallback,
  modalidadeDocumentoDaEquipe,
} from "@/lib/termosPrograma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { authenticatedFirebaseRequest } = await import("@/lib/server/firebaseRequest");
    const { decodedToken, db } = await authenticatedFirebaseRequest(request);
    const usuarioSnap = await db.collection("usuarios").doc(decodedToken.uid).get();
    if (!usuarioSnap.exists) {
      return Response.json({ error: "Seu acesso ainda não foi liberado." }, { status: 403 });
    }

    const atletaId = String(usuarioSnap.data()?.atletaId || "");
    const atletaSnap = await db.collection("atletas").doc(atletaId).get();
    if (!atletaSnap.exists) {
      return Response.json({ error: "Seu vínculo de atleta não foi encontrado." }, { status: 409 });
    }

    const modalidade = modalidadeDocumentoDaEquipe(String(atletaSnap.data()?.equipe || ""));
    if (!modalidade) {
      return Response.json({ exigido: false, documentos: [] });
    }

    const ids = DOCUMENTOS_POR_MODALIDADE[modalidade];
    const [configSnaps, aceiteSnaps] = await Promise.all([
      db.getAll(
        ...ids.map((id) => db.collection("configuracoes").doc(configDocumentoProgramaId(id))),
      ),
      db.getAll(
        ...ids.map((id) =>
          db
            .collection("aceites_documentos_programa")
            .doc(aceiteDocumentoProgramaId(decodedToken.uid, id)),
        ),
      ),
    ]);

    const pendentes = ids
      .map((id, index) =>
        documentoProgramaComFallback(
          id,
          configSnaps[index].exists
            ? (configSnaps[index].data() as Partial<DocumentoProgramaDoc>)
            : undefined,
        ),
      )
      .filter((documento, index) => {
        if (!documento.ativo || !documento.conteudo.trim()) return false;
        const aceite = aceiteSnaps[index].data();
        return !aceiteSnaps[index].exists || Number(aceite?.versao) !== documento.versao;
      });

    return Response.json({
      exigido: pendentes.length > 0,
      modalidade,
      documentos: pendentes,
    });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível verificar os documentos do programa.");
  }
}
