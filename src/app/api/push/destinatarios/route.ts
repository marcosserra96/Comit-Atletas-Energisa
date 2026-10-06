export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pessoas que o comitê pode escolher num envio individual: atletas das equipes
 * e membros do comitê, com quantos aparelhos têm as notificações ativas.
 */
export async function GET(request: Request) {
  try {
    const { authenticatedPermissionRequest } = await import("@/lib/server/firebaseRequest");
    const { perfilAtletaVisivel } = await import("@/lib/athleteVisibility");
    const { db } = await authenticatedPermissionRequest(request, "notificacoes");

    const [atletas, tokens] = await Promise.all([
      db.collection("atletas").where("equipe", "in", ["corrida", "bicicleta", "comite"]).get(),
      db.collection("push_tokens").select("atletaId").get(),
    ]);
    const aparelhos = new Map<string, number>();
    for (const t of tokens.docs) {
      const id = t.data().atletaId;
      if (typeof id === "string") aparelhos.set(id, (aparelhos.get(id) ?? 0) + 1);
    }

    const pessoas = atletas.docs
      .map((d) => ({ id: d.id, ...(d.data() as { nome?: string; equipe?: string; ativo?: boolean; visivelNasListas?: boolean }) }))
      .filter((a) => perfilAtletaVisivel(a as never) && (a.ativo || a.equipe === "comite"))
      .map((a) => ({ id: a.id, nome: String(a.nome || "Sem nome"), equipe: String(a.equipe), aparelhos: aparelhos.get(a.id) ?? 0 }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return Response.json({ pessoas });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível carregar a lista de pessoas.");
  }
}
