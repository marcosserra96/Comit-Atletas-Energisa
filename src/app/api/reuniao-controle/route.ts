import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { ApiAuthError, apiErrorResponse, authenticatedPermissionRequest } from "@/lib/server/firebaseRequest";
import { COMANDOS, VALIDADE_SESSAO_MS, comandosDepois, validarEstado, type ComandoRemoto, type RespostaControle } from "@/lib/controleRemoto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLECAO = "reunioes_controle";

function sessaoValida(id: unknown): string {
  if (typeof id !== "string" || !/^[a-z0-9]{12,40}$/i.test(id)) throw new ApiAuthError("Sessão de controle inválida.", 400);
  return id;
}

/** GET ?sessao=X&depois=N → comandos novos e o estado atual. */
export async function GET(request: Request) {
  try {
    const { db } = await authenticatedPermissionRequest(request, "informativo");
    const url = new URL(request.url);
    const sessao = sessaoValida(url.searchParams.get("sessao"));
    const depois = Number(url.searchParams.get("depois") ?? 0) || 0;
    const snap = await db.collection(COLECAO).doc(sessao).get();
    const d = snap.data();
    const encerrada = !d || d.encerrada === true || Number(d.expiraEm ?? 0) < Date.now();
    const resposta: RespostaControle = {
      seq: Number(d?.seq ?? 0),
      comandos: encerrada ? [] : comandosDepois(d?.comandos ?? [], depois),
      estado: d?.estado ?? null,
      encerrada,
    };
    return Response.json(resposta);
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível ler o controle agora.");
  }
}

/** POST { acao: "abrir" | "comando" | "estado" | "fechar", ... } */
export async function POST(request: Request) {
  try {
    const { db, decodedToken } = await authenticatedPermissionRequest(request, "informativo");
    const corpo = (await request.json().catch(() => ({}))) as { acao?: string; sessao?: string; comando?: string; estado?: unknown };
    const col = db.collection(COLECAO);

    if (corpo.acao === "abrir") {
      const sessao = randomBytes(12).toString("hex");
      await col.doc(sessao).set({ dono: decodedToken.uid, criadoEm: FieldValue.serverTimestamp(), expiraEm: Date.now() + VALIDADE_SESSAO_MS, seq: 0, comandos: [], estado: null, encerrada: false });
      return Response.json({ sessao });
    }

    const sessao = sessaoValida(corpo.sessao);
    const ref = col.doc(sessao);

    if (corpo.acao === "comando") {
      const comando = corpo.comando as ComandoRemoto;
      if (!COMANDOS.includes(comando)) throw new ApiAuthError("Comando desconhecido.", 400);
      const seq = await db.runTransaction(async (tx) => {
        const d = (await tx.get(ref)).data();
        if (!d || d.encerrada || Number(d.expiraEm ?? 0) < Date.now()) throw new ApiAuthError("A apresentação não está mais conectada.", 410);
        const proximo = Number(d.seq ?? 0) + 1;
        const comandos = [...(d.comandos ?? []), { seq: proximo, comando }].slice(-30);
        tx.update(ref, { seq: proximo, comandos });
        return proximo;
      });
      return Response.json({ seq });
    }

    const d = (await ref.get()).data();
    if (!d) throw new ApiAuthError("Sessão de controle não encontrada.", 404);
    if (d.dono !== decodedToken.uid) throw new ApiAuthError("Só quem está apresentando pode fazer isso.", 403);

    if (corpo.acao === "estado") {
      await ref.update({ estado: validarEstado(corpo.estado), estadoEm: Date.now() });
      return Response.json({ ok: true });
    }
    if (corpo.acao === "fechar") {
      await ref.update({ encerrada: true });
      return Response.json({ ok: true });
    }
    throw new ApiAuthError("Ação desconhecida.", 400);
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível falar com a apresentação agora.");
  }
}
