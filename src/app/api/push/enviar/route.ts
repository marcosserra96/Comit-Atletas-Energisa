import type { PublicoPush } from "@/lib/push/regras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Envio feito pelo comitê:
 * - { tipo: "manual", titulo, corpo, publico, link } — permissão "Notificações";
 * - { tipo: "noticia", noticiaId } — permissão "Notícias", texto vem da notícia.
 * Com { simular: true } só devolve o alcance, sem enviar.
 */
export async function POST(request: Request) {
  try {
    const { authenticatedPermissionRequest } = await import("@/lib/server/firebaseRequest");
    const { enviarPush, registrarEnvio, aparelhosDoPublico } = await import("@/lib/server/push");
    const { validarMensagem, LIMITE_CORPO, LIMITE_TITULO } = await import("@/lib/push/regras");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const publicoValido = (v: unknown): PublicoPush => (v === "corrida" || v === "bicicleta" ? v : "todos");

    if (body.tipo === "noticia") {
      const { db, decodedToken, usuario } = await authenticatedPermissionRequest(request, "noticias");
      const noticiaId = typeof body.noticiaId === "string" ? body.noticiaId : "";
      const noticia = noticiaId ? (await db.collection("noticias").doc(noticiaId).get()).data() : undefined;
      if (!noticia) return Response.json({ error: "Notícia não encontrada." }, { status: 404 });
      const corte = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
      const resumo = String(noticia.resumo || noticia.corpo || "Toque para ler no portal.")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const mensagem = {
        titulo: corte(`Notícia: ${String(noticia.titulo || "Novidade no portal")}`, LIMITE_TITULO),
        corpo: corte(resumo, LIMITE_CORPO),
        link: `/noticias/${noticiaId}`,
        tag: `noticia-${noticiaId}`,
      };
      const publico: PublicoPush = "todos";
      const resultado = await enviarPush(db, { publico }, mensagem);
      await registrarEnvio(db, {
        origem: "noticia",
        mensagem,
        publico,
        resultado,
        autorUid: decodedToken.uid,
        autorNome: usuario.nome,
      });
      return Response.json(resultado);
    }

    const { db, decodedToken, usuario } = await authenticatedPermissionRequest(request, "notificacoes");
    const publico = publicoValido(body.publico);
    if (body.simular === true) {
      const { atletas, aparelhos } = await aparelhosDoPublico(db, { publico });
      return Response.json({ atletas, aparelhos: aparelhos.length });
    }
    const mensagem = {
      titulo: String(body.titulo ?? "").trim(),
      corpo: String(body.corpo ?? "").trim(),
      link: String(body.link ?? "/dashboard"),
    };
    const erros = validarMensagem(mensagem);
    if (erros.length) return Response.json({ error: erros[0] }, { status: 400 });
    const resultado = await enviarPush(db, { publico }, mensagem);
    await registrarEnvio(db, {
      origem: "manual",
      mensagem,
      publico,
      resultado,
      autorUid: decodedToken.uid,
      autorNome: usuario.nome,
    });
    return Response.json(resultado);
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível enviar a notificação agora.");
  }
}
