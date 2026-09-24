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

function dataIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate: () => Date }).toDate;
    return toDate.call(value).toISOString();
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { authenticatedFirebaseRequest, ApiAuthError } = await import(
      "@/lib/server/firebaseRequest"
    );
    const { decodedToken, db } = await authenticatedFirebaseRequest(request);
    const usuarioSnap = await db.collection("usuarios").doc(decodedToken.uid).get();
    if (!usuarioSnap.exists) throw new ApiAuthError("Seu acesso ainda não foi liberado.", 403);

    const usuario = usuarioSnap.data();
    const meuAtletaId = String(usuario?.atletaId || "");
    const url = new URL(request.url);
    const atletaIdSolicitado = url.searchParams.get("atletaId")?.trim();
    const atletaId = atletaIdSolicitado || meuAtletaId;
    if (atletaId !== meuAtletaId && usuario?.role !== "administrador") {
      throw new ApiAuthError("Você não pode consultar os documentos deste atleta.", 403);
    }

    const atletaSnap = await db.collection("atletas").doc(atletaId).get();
    if (!atletaSnap.exists) throw new ApiAuthError("Atleta não encontrado.", 404);
    const atleta = atletaSnap.data();
    const modalidade = modalidadeDocumentoDaEquipe(String(atleta?.equipe || ""));
    if (!modalidade) {
      return Response.json({ modalidade: null, documentos: [] });
    }

    const uidAceite = atletaId === meuAtletaId ? decodedToken.uid : String(atleta?.authUid || "");
    const ids = DOCUMENTOS_POR_MODALIDADE[modalidade];
    const configSnaps = await db.getAll(
      ...ids.map((id) => db.collection("configuracoes").doc(configDocumentoProgramaId(id))),
    );
    const aceiteSnaps = uidAceite
      ? await db.getAll(
          ...ids.map((id) =>
            db
              .collection("aceites_documentos_programa")
              .doc(aceiteDocumentoProgramaId(uidAceite, id)),
          ),
        )
      : [];

    const documentos = ids
      .map((id, index) =>
        documentoProgramaComFallback(
          id,
          configSnaps[index].exists
            ? (configSnaps[index].data() as Partial<DocumentoProgramaDoc>)
            : undefined,
        ),
      )
      .filter((documento) => documento.ativo && documento.conteudo.trim())
      .map((documento) => {
        const index = ids.indexOf(documento.id);
        const aceite = aceiteSnaps[index]?.data();
        const versaoAceita = Number(aceite?.versao) || 0;
        return {
          ...documento,
          atualizadoEm: undefined,
          atualizadoPor: undefined,
          aceite: aceite
            ? {
                versao: versaoAceita,
                aceitoEm: dataIso(aceite.aceitoEm),
                atual: versaoAceita === documento.versao,
              }
            : null,
        };
      });

    return Response.json({ modalidade, documentos });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível carregar os documentos do programa.");
  }
}
