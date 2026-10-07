import { FieldValue } from "firebase-admin/firestore";
import { ApiAuthError, apiErrorResponse, authenticatedFirebaseRequest } from "@/lib/server/firebaseRequest";
import { FOTO_TAMANHO_MAXIMO, fotoValida } from "@/lib/fotoRegras";
import type { UsuarioDoc } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLECAO = "fotos_atletas";

/** GET ?ids=a,b,c → { fotos: { id: dataUrl } }. Qualquer pessoa logada (fotos aparecem no pódio). */
export async function GET(request: Request) {
  try {
    const { db, decodedToken } = await authenticatedFirebaseRequest(request);
    const usuario = (await db.collection("usuarios").doc(decodedToken.uid).get()).data();
    if (!usuario) throw new ApiAuthError("Seu acesso ainda não foi liberado.", 403);
    const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(Boolean))].slice(0, 150);
    if (ids.length === 0) return Response.json({ fotos: {} });
    const docs = await db.getAll(...ids.map((id) => db.collection(COLECAO).doc(id)));
    const fotos: Record<string, string> = {};
    for (const d of docs) {
      const url = d.data()?.dataUrl;
      if (typeof url === "string") fotos[d.id] = url;
    }
    return Response.json(
      { fotos },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível carregar as fotos.");
  }
}

/** POST { atletaId, dataUrl | null }: o comitê (Atletas) ou o próprio atleta troca ou tira a foto. */
export async function POST(request: Request) {
  try {
    const { db, decodedToken } = await authenticatedFirebaseRequest(request);
    const usuario = (await db.collection("usuarios").doc(decodedToken.uid).get()).data() as
      | (UsuarioDoc & { permissoes?: string[] })
      | undefined;
    const corpo = (await request.json().catch(() => ({}))) as { atletaId?: unknown; dataUrl?: unknown };
    const atletaId = typeof corpo.atletaId === "string" ? corpo.atletaId : "";
    if (!atletaId || atletaId.length > 200) throw new ApiAuthError("Atleta inválido.", 400);

    const { temPermissao } = await import("@/lib/permissoes");
    const daGestao =
      !!usuario &&
      (usuario.role === "administrador" || usuario.role === "comite") &&
      temPermissao(usuario as { role: "administrador" | "comite"; permissoes?: string[] }, "atletas");
    if (!usuario || (!daGestao && usuario.atletaId !== atletaId)) {
      throw new ApiAuthError("Você não pode alterar esta foto.", 403);
    }

    const atletaRef = db.collection("atletas").doc(atletaId);
    if (!(await atletaRef.get()).exists) throw new ApiAuthError("Atleta não encontrado.", 404);
    // Cópia pública (ranking da equipe): leva a versão da foto para os colegas também verem.
    const publicoRef = db.collection("atletas_publicos").doc(atletaId);
    const temPublico = (await publicoRef.get()).exists;

    const batch = db.batch();
    if (corpo.dataUrl === null) {
      batch.delete(db.collection(COLECAO).doc(atletaId));
      batch.update(atletaRef, { fotoVersao: FieldValue.delete() });
      if (temPublico) batch.update(publicoRef, { fotoVersao: FieldValue.delete() });
    } else {
      if (!fotoValida(corpo.dataUrl)) {
        throw new ApiAuthError(`Foto inválida ou grande demais (até ${Math.round(FOTO_TAMANHO_MAXIMO / 1000)} KB).`, 400);
      }
      const versao = Date.now();
      batch.set(db.collection(COLECAO).doc(atletaId), { dataUrl: corpo.dataUrl, atualizadoEm: FieldValue.serverTimestamp(), atualizadoPor: decodedToken.uid });
      batch.update(atletaRef, { fotoVersao: versao });
      if (temPublico) batch.update(publicoRef, { fotoVersao: versao });
    }
    await batch.commit();
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível salvar a foto agora.");
  }
}
