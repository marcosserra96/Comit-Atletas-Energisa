import { FieldValue } from "firebase-admin/firestore";
import { ApiAuthError, apiErrorResponse, authenticatedFirebaseRequest, authenticatedPermissionRequest } from "@/lib/server/firebaseRequest";
import { mensagemDeDesafioNovo, modalidadesDoDesafio, statusDoDesafio, validarDesafio, type DesafioDoc } from "@/lib/desafios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Desafios do comitê. Ficam só no servidor (sem regra nova no Firestore):
 * todo mundo logado lê; quem edita critérios cria, altera e exclui.
 */
const COLECAO = "desafios";

function paraApi(id: string, d: FirebaseFirestore.DocumentData): DesafioDoc {
  return {
    id,
    titulo: String(d.titulo ?? ""),
    modalidade: d.modalidade ?? "todas",
    tipo: d.tipo ?? "treinos",
    metas: d.metas ?? {},
    inicio: String(d.inicio ?? ""),
    fim: String(d.fim ?? ""),
    icone: d.icone ?? "bandeira",
    nivel: d.nivel ?? 3,
    atualizadoPorNome: d.atualizadoPorNome ?? null,
  };
}

function hojeBrasil() {
  return new Date(Date.now() - 3 * 60 * 60_000).toISOString().slice(0, 10);
}

/** GET → { desafios } (os mais recentes primeiro). */
export async function GET(request: Request) {
  try {
    const { db, decodedToken } = await authenticatedFirebaseRequest(request);
    const usuario = (await db.collection("usuarios").doc(decodedToken.uid).get()).data();
    if (!usuario) throw new ApiAuthError("Seu acesso ainda não foi liberado.", 403);
    const snap = await db.collection(COLECAO).orderBy("inicio", "desc").limit(100).get();
    return Response.json({ desafios: snap.docs.map((d) => paraApi(d.id, d.data())) });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível carregar os desafios.");
  }
}

/** POST { id?, ...desafio, avisar? } → cria ou altera. `avisar` manda o aviso de desafio novo (uma vez por desafio). */
export async function POST(request: Request) {
  try {
    const { db, decodedToken, usuario } = await authenticatedPermissionRequest(request, "regras");
    const corpo = (await request.json().catch(() => ({}))) as { id?: unknown; avisar?: unknown };
    const r = validarDesafio(corpo);
    if ("erro" in r) throw new ApiAuthError(r.erro, 400);
    const editando = typeof corpo.id === "string" && corpo.id.length > 0;
    const ref = editando ? db.collection(COLECAO).doc(String(corpo.id).slice(0, 60)) : db.collection(COLECAO).doc();
    if (editando && !(await ref.get()).exists) throw new ApiAuthError("Este desafio foi excluído.", 404);
    await ref.set(
      {
        ...r.dados,
        ...(editando ? {} : { criadoEm: FieldValue.serverTimestamp(), criadoPor: decodedToken.uid }),
        atualizadoEm: FieldValue.serverTimestamp(),
        atualizadoPor: decodedToken.uid,
        atualizadoPorNome: usuario.nome ?? null,
      },
      { merge: true },
    );

    let avisados = 0;
    const desafio: DesafioDoc = { ...r.dados, id: ref.id };
    const hoje = hojeBrasil();
    if (corpo.avisar === true && statusDoDesafio(desafio, hoje) !== "encerrado") {
      const { enviarPush, registrarEnvio, reservarAviso } = await import("@/lib/server/push");
      if (await reservarAviso(db, `desafio_novo_${ref.id}`)) {
        // Uma mensagem por modalidade: a meta de km costuma ser diferente.
        for (const modalidade of modalidadesDoDesafio(desafio)) {
          const mensagem = { ...mensagemDeDesafioNovo(desafio, modalidade, hoje), link: "/dashboard#desafios", tag: `desafio-${ref.id}` };
          const resultado = await enviarPush(db, { publico: modalidade }, mensagem);
          avisados += resultado.atletas;
          await registrarEnvio(db, { origem: "desafio", mensagem, publico: modalidade, resultado, autorUid: decodedToken.uid, autorNome: usuario.nome });
        }
      }
    }
    return Response.json({ id: ref.id, avisados });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível salvar o desafio.");
  }
}

/** DELETE { id } → exclui. As medalhas desse desafio deixam de aparecer. */
export async function DELETE(request: Request) {
  try {
    const { db } = await authenticatedPermissionRequest(request, "regras");
    const { id } = (await request.json().catch(() => ({}))) as { id?: unknown };
    if (typeof id !== "string" || !id) throw new ApiAuthError("Desafio não informado.", 400);
    await db.collection(COLECAO).doc(id.slice(0, 60)).delete();
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível excluir o desafio.");
  }
}
