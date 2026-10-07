import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { ApiAuthError, apiErrorResponse, authenticatedPermissionRequest } from "@/lib/server/firebaseRequest";
import { validarReuniao, type ReuniaoResultadosDoc } from "@/lib/reuniaoResultados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLECAO = "reunioes_resultados";

function paraApi(id: string, d: FirebaseFirestore.DocumentData): ReuniaoResultadosDoc {
  const em = d.atualizadoEm as Timestamp | undefined;
  return {
    id,
    titulo: d.titulo,
    periodo: d.periodo,
    eventoId: d.eventoId ?? null,
    secoes: d.secoes ?? [],
    livres: d.livres ?? [],
    novosIncluir: d.novosIncluir ?? [],
    novosExcluir: d.novosExcluir ?? [],
    atualizadoEm: em?.toDate ? em.toDate().toISOString() : null,
    atualizadoPorNome: d.atualizadoPorNome ?? null,
  };
}

/** GET → reuniões salvas (mais recentes primeiro). GET ?id= → uma reunião. */
export async function GET(request: Request) {
  try {
    const { db } = await authenticatedPermissionRequest(request, "informativo");
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const snap = await db.collection(COLECAO).doc(id).get();
      if (!snap.exists) throw new ApiAuthError("Reunião não encontrada.", 404);
      return Response.json({ reuniao: paraApi(snap.id, snap.data()!) });
    }
    const snap = await db.collection(COLECAO).orderBy("atualizadoEm", "desc").limit(30).get();
    return Response.json({ reunioes: snap.docs.map((d) => paraApi(d.id, d.data())) });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível carregar as reuniões.");
  }
}

/** POST { id?, ...reunião } → cria ou atualiza. */
export async function POST(request: Request) {
  try {
    const { db, decodedToken, usuario } = await authenticatedPermissionRequest(request, "informativo");
    const corpo = (await request.json().catch(() => ({}))) as { id?: unknown };
    const r = validarReuniao(corpo);
    if ("erro" in r) throw new ApiAuthError(r.erro, 400);
    const ref = typeof corpo.id === "string" && corpo.id ? db.collection(COLECAO).doc(corpo.id.slice(0, 60)) : db.collection(COLECAO).doc();
    await ref.set(
      {
        ...r.dados,
        atualizadoEm: FieldValue.serverTimestamp(),
        atualizadoPor: decodedToken.uid,
        atualizadoPorNome: usuario.nome ?? null,
      },
      { merge: false },
    );
    return Response.json({ id: ref.id });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível salvar a reunião agora.");
  }
}

/** DELETE { id } → apaga a reunião e as imagens dos slides livres dela. */
export async function DELETE(request: Request) {
  try {
    const { db } = await authenticatedPermissionRequest(request, "informativo");
    const corpo = (await request.json().catch(() => ({}))) as { id?: unknown };
    if (typeof corpo.id !== "string" || !corpo.id) throw new ApiAuthError("Reunião inválida.", 400);
    const ref = db.collection(COLECAO).doc(corpo.id);
    const snap = await ref.get();
    const imagens = ((snap.data()?.livres ?? []) as { imagemId?: string | null }[])
      .map((l) => l.imagemId)
      .filter((x): x is string => !!x);
    const batch = db.batch();
    batch.delete(ref);
    for (const id of imagens) batch.delete(db.collection("reunioes_imagens").doc(id));
    await batch.commit();
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível apagar a reunião agora.");
  }
}
