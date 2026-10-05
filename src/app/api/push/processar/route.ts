import type { Firestore } from "firebase-admin/firestore";
import type { EventoDoc } from "@/lib/types";
import type { PesquisaDoc } from "@/lib/pesquisas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Execuções anônimas (agendador) no máximo a cada 45 s: a rota é pública. */
const INTERVALO_MINIMO_MS = 45_000;

function diaBrasil(deslocamentoDias = 0) {
  const d = new Date(Date.now() - 3 * 60 * 60_000 + deslocamentoDias * 24 * 60 * 60_000);
  return d.toISOString().slice(0, 10);
}

async function podeRodar(db: Firestore) {
  const ref = db.collection("push_controle").doc("_ultima_execucao");
  return db.runTransaction(async (tx) => {
    const ultima = Number((await tx.get(ref)).data()?.em ?? 0);
    if (Date.now() - ultima < INTERVALO_MINIMO_MS) return false;
    tx.set(ref, { em: Date.now() });
    return true;
  });
}

/**
 * Avisos automáticos, idempotentes (cada aviso sai uma vez):
 * - pesquisa aberta e lembrete no último dia (só para quem não respondeu);
 * - reunião com a confirmação de presença aberta (só para quem não confirmou).
 * Chamado pelo agendador a cada poucos minutos (GET, sem login) e pelo portal
 * logo depois que o comitê publica uma pesquisa ou ativa uma reunião (POST).
 */
async function processar(request: Request, autenticado: boolean) {
  const { getFirebaseAdmin } = await import("@/lib/firebaseAdmin");
  const { enviarPush, registrarEnvio, reservarAviso } = await import("@/lib/server/push");
  const { pesquisaPrecisaAvisoDeAbertura, pesquisaPrecisaLembrete } = await import("@/lib/push/regras");
  const { situacaoCheckin, idPresencaReuniao } = await import("@/lib/reunioes");
  const { formatarDataHora } = await import("@/lib/pesquisas");
  const { horarioDoEvento } = await import("@/lib/eventos");

  let db: Firestore;
  if (autenticado) {
    const { authenticatedFirebaseRequest } = await import("@/lib/server/firebaseRequest");
    ({ db } = await authenticatedFirebaseRequest(request));
  } else {
    db = getFirebaseAdmin().db;
    if (!(await podeRodar(db))) return Response.json({ ok: true, pulado: true });
  }

  const agora = Date.now();
  const enviados: string[] = [];

  // Pesquisas
  const pesquisas = await db.collection("pesquisas").where("publicada", "==", true).get();
  for (const doc of pesquisas.docs) {
    const p = { ...(doc.data() as PesquisaDoc), id: doc.id };
    const abertura = pesquisaPrecisaAvisoDeAbertura(p, agora);
    const lembrete = pesquisaPrecisaLembrete(p, agora);
    if (!abertura && !lembrete) continue;

    const chave = lembrete ? `pesquisa_lembrete_${p.id}` : `pesquisa_abertura_${p.id}`;
    // Abertura já avisada e ainda não é hora do lembrete: nada a fazer.
    if (!(await reservarAviso(db, chave))) continue;
    if (lembrete) await reservarAviso(db, `pesquisa_abertura_${p.id}`); // não manda os dois juntos

    const respostas = await db.collection("pesquisas").doc(p.id).collection("respostas").select().get();
    const excluir = new Set(respostas.docs.map((r) => r.id));
    const mensagem = lembrete
      ? {
          titulo: "Último dia para responder",
          corpo: `${p.titulo} · fecha ${formatarDataHora(p.fechaEm)}. Leva poucos minutos.`,
          link: `/pesquisas/${p.id}`,
          tag: `pesquisa-${p.id}`,
        }
      : {
          titulo: "Nova pesquisa para você",
          corpo: `${p.titulo} · responda até ${formatarDataHora(p.fechaEm)}.`,
          link: `/pesquisas/${p.id}`,
          tag: `pesquisa-${p.id}`,
        };
    const resultado = await enviarPush(db, { publico: p.publico, excluir }, mensagem);
    await registrarEnvio(db, {
      origem: lembrete ? "pesquisa_lembrete" : "pesquisa_abertura",
      mensagem,
      publico: p.publico,
      resultado,
    });
    enviados.push(chave);
  }

  // Reuniões de ontem e hoje (a janela pode passar da meia-noite).
  const eventos = await db.collection("agenda_eventos").where("data", "in", [diaBrasil(-1), diaBrasil(0)]).get();
  for (const doc of eventos.docs) {
    const e = { ...(doc.data() as EventoDoc), id: doc.id };
    if (e.tipo !== "reuniao" || situacaoCheckin(e, new Date(agora)) !== "aberto") continue;
    const chave = `reuniao_${e.id}`;
    if (!(await reservarAviso(db, chave))) continue;

    const presencas = await db.collection("historico_pontos").where("eventoId", "==", e.id).select("atletaId").get();
    const excluir = new Set(
      presencas.docs.filter((d) => d.id === idPresencaReuniao(e.id, String(d.data().atletaId))).map((d) => String(d.data().atletaId)),
    );
    const publico = e.modalidade === "ambas" ? "todos" : e.modalidade;
    const mensagem = {
      titulo: "Reunião começando",
      corpo: `${e.titulo} · ${horarioDoEvento(e)}. Toque para registrar sua presença.`,
      link: `/presenca/${e.id}`,
      tag: `reuniao-${e.id}`,
    };
    const resultado = await enviarPush(db, { publico, excluir }, mensagem);
    await registrarEnvio(db, { origem: "reuniao", mensagem, publico, resultado });
    enviados.push(chave);
  }

  return Response.json({ ok: true, enviados });
}

export async function GET(request: Request) {
  try {
    return await processar(request, false);
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Falha ao processar os avisos.");
  }
}

export async function POST(request: Request) {
  try {
    return await processar(request, true);
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Falha ao processar os avisos.");
  }
}
