import type { Firestore } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Execuções anônimas (agendador) no máximo a cada 4 min: a rota é pública. */
const INTERVALO_MINIMO_MS = 4 * 60_000;

async function podeRodar(db: Firestore) {
  const ref = db.collection("push_controle").doc("_calendario_premiacao");
  return db.runTransaction(async (tx) => {
    const ultima = Number((await tx.get(ref)).data()?.em ?? 0);
    if (Date.now() - ultima < INTERVALO_MINIMO_MS) return false;
    tx.set(ref, { em: Date.now() });
    return true;
  });
}

/**
 * Aplica o calendário de premiação (trimestre do ranking e ocultação).
 * GET: agendador, sem login (a rota não recebe dados e só aplica o que o
 * administrador salvou). POST: administrador, logo depois de salvar.
 */
export async function GET() {
  try {
    const { getFirebaseAdmin } = await import("@/lib/firebaseAdmin");
    const { sincronizarCalendario } = await import("@/lib/server/calendarioSync");
    const { db } = getFirebaseAdmin();
    if (!(await podeRodar(db))) return Response.json({ ok: true, pulado: true });
    const r = await sincronizarCalendario(db, { uid: "sistema", nome: "Calendário de premiação" });
    return Response.json({ ok: true, ...(r.aplicado ? { alteracoes: r.alteracoes } : { motivo: r.motivo }) });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível aplicar o calendário de premiação.");
  }
}

export async function POST(request: Request) {
  try {
    const { authenticatedAdminRequest } = await import("@/lib/server/firebaseRequest");
    const { sincronizarCalendario } = await import("@/lib/server/calendarioSync");
    const { db, decodedToken } = await authenticatedAdminRequest(request);
    const r = await sincronizarCalendario(db, {
      uid: decodedToken.uid,
      nome: decodedToken.name || decodedToken.email || "Administrador",
    });
    return Response.json(r.aplicado ? { ok: true, alteracoes: r.alteracoes } : { ok: true, motivo: r.motivo });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível aplicar o calendário de premiação.");
  }
}
