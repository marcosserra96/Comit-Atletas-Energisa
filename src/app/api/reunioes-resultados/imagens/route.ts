import { FieldValue } from "firebase-admin/firestore";
import { ApiAuthError, apiErrorResponse, authenticatedPermissionRequest } from "@/lib/server/firebaseRequest";
import { IMAGEM_SLIDE_TAMANHO_MAXIMO, imagemSlideValida } from "@/lib/fotoRegras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLECAO = "reunioes_imagens";

/** GET ?ids=a,b → { imagens: { id: dataUrl } } */
export async function GET(request: Request) {
  try {
    const { db } = await authenticatedPermissionRequest(request, "informativo");
    const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean))].slice(0, 30);
    if (ids.length === 0) return Response.json({ imagens: {} });
    const docs = await db.getAll(...ids.map((id) => db.collection(COLECAO).doc(id)));
    const imagens: Record<string, string> = {};
    for (const d of docs) if (typeof d.data()?.dataUrl === "string") imagens[d.id] = d.data()!.dataUrl;
    return Response.json({ imagens }, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível carregar as imagens.");
  }
}

/** POST { dataUrl } → { id }. A imagem já chega reduzida pelo navegador. */
export async function POST(request: Request) {
  try {
    const { db, decodedToken } = await authenticatedPermissionRequest(request, "informativo");
    const corpo = (await request.json().catch(() => ({}))) as { dataUrl?: unknown };
    if (!imagemSlideValida(corpo.dataUrl)) {
      throw new ApiAuthError(`Imagem inválida ou grande demais (até ${Math.round(IMAGEM_SLIDE_TAMANHO_MAXIMO / 1000)} KB).`, 400);
    }
    const ref = db.collection(COLECAO).doc();
    await ref.set({ dataUrl: corpo.dataUrl, criadoEm: FieldValue.serverTimestamp(), criadoPor: decodedToken.uid });
    return Response.json({ id: ref.id });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível enviar a imagem agora.");
  }
}
