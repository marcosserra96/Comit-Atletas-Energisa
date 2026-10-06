export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alcance atual e últimos envios (tela do comitê). */
export async function GET(request: Request) {
  try {
    const { authenticatedPermissionRequest } = await import("@/lib/server/firebaseRequest");
    const { aparelhosDoPublico } = await import("@/lib/server/push");
    const { db } = await authenticatedPermissionRequest(request, "notificacoes");

    const [envios, corrida, bicicleta, ativos] = await Promise.all([
      db.collection("push_envios").orderBy("criadoEm", "desc").limit(40).get(),
      aparelhosDoPublico(db, { publico: "corrida" }),
      aparelhosDoPublico(db, { publico: "bicicleta" }),
      db.collection("atletas").where("ativo", "==", true).where("equipe", "in", ["corrida", "bicicleta"]).count().get(),
    ]);

    return Response.json({
      alcance: { corrida: corrida.atletas, bicicleta: bicicleta.atletas, atletasAtivos: ativos.data().count },
      envios: envios.docs.map((d) => {
        const e = d.data();
        return {
          id: d.id,
          origem: e.origem,
          titulo: e.titulo,
          corpo: e.corpo,
          link: e.link,
          publico: e.publico,
          atletas: e.atletas ?? 0,
          enviados: e.enviados ?? 0,
          falhas: e.falhas ?? 0,
          autorNome: e.autorNome ?? null,
          destinatarios: Array.isArray(e.destinatarios) ? e.destinatarios : null,
          criadoEm: e.criadoEm?.toDate?.().toISOString() ?? null,
        };
      }),
    });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível carregar as notificações.");
  }
}
