export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fechamento do mês: o comitê confirma que os lançamentos de um mês estão
 * completos, e só então os atletas recebem o resumo (sem confirmação, ele sai
 * sozinho no dia 7). Fica em push_controle/fechamentos, só no servidor.
 * GET → { fechados } (qualquer pessoa logada: o Início do atleta espera o fechamento).
 * POST { competencia } → confirma o mês anterior (permissão "registrar") e já manda o aviso.
 */
const REF = (db: FirebaseFirestore.Firestore) => db.collection("push_controle").doc("fechamentos");

function agoraBrasil() {
  const b = new Date(Date.now() - 3 * 60 * 60_000);
  return { hoje: b.toISOString().slice(0, 10), hora: b.getUTCHours() };
}

export async function GET(request: Request) {
  try {
    const { authenticatedFirebaseRequest, ApiAuthError } = await import("@/lib/server/firebaseRequest");
    const { db, decodedToken } = await authenticatedFirebaseRequest(request);
    if (!(await db.collection("usuarios").doc(decodedToken.uid).get()).exists) throw new ApiAuthError("Seu acesso ainda não foi liberado.", 403);
    const meses = ((await REF(db).get()).data()?.meses ?? {}) as Record<string, { em?: string; porNome?: string | null }>;
    return Response.json({ fechados: meses });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível consultar o fechamento.");
  }
}

export async function POST(request: Request) {
  try {
    const { authenticatedPermissionRequest, ApiAuthError } = await import("@/lib/server/firebaseRequest");
    const { db, decodedToken, usuario } = await authenticatedPermissionRequest(request, "registrar");
    const { competencia } = (await request.json().catch(() => ({}))) as { competencia?: unknown };
    const { periodoDoMes, HORARIO_DO_AVISO_CONFIRMADO } = await import("@/lib/resumoPeriodo");
    const { hoje, hora } = agoraBrasil();
    const anterior = periodoDoMes(hoje, -1).inicio.slice(0, 7);
    if (competencia !== anterior) throw new ApiAuthError("Só dá para fechar o mês que acabou de terminar.", 400);

    const { FieldValue } = await import("firebase-admin/firestore");
    const jaEstava = await db.runTransaction(async (tx) => {
      const snap = await tx.get(REF(db));
      if (snap.data()?.meses?.[anterior]) return true;
      tx.set(REF(db), { meses: { [anterior]: { em: new Date().toISOString(), por: decodedToken.uid, porNome: usuario.nome ?? null } }, atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
      return false;
    });

    // Avisa já, se for horário; senão, o agendador manda na manhã seguinte.
    let avisados = 0;
    const noHorario = hora >= HORARIO_DO_AVISO_CONFIRMADO.de && hora < HORARIO_DO_AVISO_CONFIRMADO.ate;
    if (noHorario) {
      try {
        const { avisarResumoDoPeriodo } = await import("@/lib/server/avisosAutomaticos");
        avisados = await avisarResumoDoPeriodo(db);
      } catch (erro) {
        console.error("Mês fechado, mas o aviso não saiu agora (o agendador tenta de novo):", erro);
      }
    }
    return Response.json({ ok: true, jaEstava, avisados, depois: !noHorario });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível fechar o mês agora.");
  }
}
