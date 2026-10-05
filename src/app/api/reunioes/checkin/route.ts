import type { AtletaDoc, EventoDoc, RegraPontuacaoDoc } from "@/lib/types";
import {
  codigoValido,
  idPresencaReuniao,
  janelaDoCheckin,
  loteDaReuniao,
  situacaoCheckin,
  type SegredoCheckinDoc,
} from "@/lib/reunioes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tentativas erradas permitidas por atleta e reunião (evita "chutar" o código). */
const LIMITE_TENTATIVAS = 10;

function resposta(status: number, corpo: Record<string, unknown>) {
  return Response.json(corpo, { status });
}

/**
 * Confirmação de presença em reunião pelo app do atleta. Tudo é conferido aqui
 * no servidor: horário, código (fixo ou que muda a cada 30 s), modalidade e se
 * a presença já existe. O lançamento usa o mesmo id da marcação manual.
 */
export async function POST(request: Request) {
  try {
    const { authenticatedFirebaseRequest } = await import("@/lib/server/firebaseRequest");
    const { decodedToken, db } = await authenticatedFirebaseRequest(request);
    const { FieldValue } = await import("firebase-admin/firestore");

    const body = (await request.json().catch(() => ({}))) as { eventoId?: unknown; codigo?: unknown };
    const eventoId = typeof body.eventoId === "string" ? body.eventoId : "";
    const codigo = typeof body.codigo === "string" ? body.codigo.slice(0, 20) : "";
    if (!eventoId || !codigo) return resposta(400, { error: "Informe o código da reunião." });

    const usuarioSnap = await db.collection("usuarios").doc(decodedToken.uid).get();
    const atletaId = String(usuarioSnap.data()?.atletaId || "");
    if (!usuarioSnap.exists || !atletaId) return resposta(403, { error: "Seu acesso ainda não foi liberado." });

    const [eventoSnap, atletaSnap, segredoSnap] = await Promise.all([
      db.collection("agenda_eventos").doc(eventoId).get(),
      db.collection("atletas").doc(atletaId).get(),
      db.collection("reunioes_checkin").doc(eventoId).get(),
    ]);
    const evento = eventoSnap.data() as EventoDoc | undefined;
    const atleta = atletaSnap.data() as AtletaDoc | undefined;
    if (!evento || evento.tipo !== "reuniao") return resposta(404, { error: "Reunião não encontrada." });
    if (!atleta || !atleta.ativo || (atleta.equipe !== "corrida" && atleta.equipe !== "bicicleta")) {
      return resposta(403, { error: "Seu cadastro não está ativo no programa." });
    }
    if (evento.modalidade !== "ambas" && evento.modalidade !== atleta.equipe) {
      return resposta(403, { error: "Esta reunião não é da sua modalidade." });
    }

    const situacao = situacaoCheckin(evento);
    if (situacao === "desligado") return resposta(409, { error: "A confirmação pelo app não está ativa nesta reunião." });
    const { abre, fecha } = janelaDoCheckin(evento);
    const hora = (d: Date) =>
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    if (situacao === "antes") return resposta(409, { error: `A confirmação abre às ${hora(abre)}.` });
    if (situacao === "encerrado") return resposta(409, { error: `A confirmação encerrou às ${hora(fecha)}.` });

    const presencaRef = db.collection("historico_pontos").doc(idPresencaReuniao(eventoId, atletaId));
    const existente = await presencaRef.get();
    if (existente.exists) {
      return existente.data()?.estornado
        ? resposta(409, { error: "Sua presença nesta reunião foi removida pelo comitê. Fale com o comitê." })
        : resposta(200, { status: "ja_confirmada", titulo: evento.titulo });
    }

    const tentativasRef = db.collection("reunioes_checkin").doc(eventoId).collection("tentativas").doc(atletaId);
    const tentativas = Number((await tentativasRef.get()).data()?.erros || 0);
    if (tentativas >= LIMITE_TENTATIVAS) {
      return resposta(429, { error: "Muitas tentativas com código errado. Peça ao comitê para registrar sua presença." });
    }

    const segredo = segredoSnap.data() as SegredoCheckinDoc | undefined;
    const valido =
      segredo !== undefined &&
      (await codigoValido({ codigo, dinamico: evento.checkin?.dinamico === true, segredo }));
    if (!valido) {
      await tentativasRef.set({ erros: FieldValue.increment(1), ultimaEm: FieldValue.serverTimestamp() }, { merge: true });
      return resposta(400, {
        error: evento.checkin?.dinamico
          ? "Código inválido ou expirado. Escaneie o QR code da tela de novo."
          : "Código inválido. Confira o QR code ou o código da reunião.",
      });
    }

    // Critério de reunião compatível com a modalidade do atleta.
    const regrasSnap = await db.collection("regras_pontuacao").where("tiposLancamento", "array-contains", "reuniao").get();
    const regra = regrasSnap.docs
      .map((d) => ({ ...(d.data() as RegraPontuacaoDoc), id: d.id }))
      .find((r) => r.modalidade === "ambas" || r.modalidade === atleta.equipe);
    if (!regra) return resposta(409, { error: "O comitê ainda não cadastrou o critério de reunião. Avise o comitê." });

    const autorNome = atleta.nome;
    let jaExistia = false;
    await db.runTransaction(async (tx) => {
      const atual = await tx.get(presencaRef);
      if (atual.exists) {
        jaExistia = true;
        return;
      }
      tx.create(presencaRef, {
        id: presencaRef.id,
        atletaId,
        atletaNome: atleta.nome,
        equipe: atleta.equipe,
        regraId: regra.id,
        regraDesc: regra.descricao,
        pontos: regra.pontos,
        tipoLancamento: "reuniao",
        dataTreino: evento.data,
        loteId: loteDaReuniao(eventoId),
        descricaoLote: evento.titulo,
        eventoId,
        origemPresenca: "qrcode",
        criadoPor: decodedToken.uid,
        criadoPorNome: autorNome,
        criadoEm: FieldValue.serverTimestamp(),
        estornado: false,
      });
      if (regra.pontos > 0) {
        tx.update(db.collection("atletas").doc(atletaId), {
          pontuacaoTotal: FieldValue.increment(regra.pontos),
          atualizadoEm: FieldValue.serverTimestamp(),
        });
        tx.set(
          db.collection("atletas_publicos").doc(atletaId),
          { pontuacaoTotal: FieldValue.increment(regra.pontos) },
          { merge: true },
        );
      }
    });
    if (jaExistia) return resposta(200, { status: "ja_confirmada", titulo: evento.titulo });

    // Ranking publicado: atualiza só este atleta. Falha aqui não desfaz a presença.
    try {
      const { atualizarRankingDosAtletas } = await import("@/lib/server/rankingPublisher");
      await atualizarRankingDosAtletas({ db, uid: decodedToken.uid, autorNome, atletaIds: [atletaId], origem: "presenca_qrcode" });
    } catch (erro) {
      console.error("Presença registrada, mas o ranking não atualizou:", erro);
    }

    return resposta(200, { status: "confirmada", titulo: evento.titulo, pontos: regra.pontos });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível confirmar a presença agora.");
  }
}
