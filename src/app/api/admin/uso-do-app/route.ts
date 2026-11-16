export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Uso do portal por pessoa (só administradores): cruza os cadastros com as
 * contas do Firebase Auth (último login e última renovação de sessão) e com
 * os aparelhos que recebem notificações. Não grava nada.
 */
export async function GET(request: Request) {
  try {
    const { authenticatedAdminRequest } = await import("@/lib/server/firebaseRequest");
    const { db } = await authenticatedAdminRequest(request);
    const { getFirebaseAdmin } = await import("@/lib/firebaseAdmin");
    const { auth } = getFirebaseAdmin();

    const contas = new Map<string, { ultimoUso: string | null; criadaEm: string | null; desativada: boolean }>();
    let pagina: string | undefined;
    do {
      const r = await auth.listUsers(1000, pagina);
      for (const u of r.users) {
        const datas = [u.metadata.lastRefreshTime, u.metadata.lastSignInTime]
          .filter((d): d is string => !!d)
          .map((d) => new Date(d).getTime())
          .filter(Number.isFinite);
        contas.set(u.uid, {
          ultimoUso: datas.length ? new Date(Math.max(...datas)).toISOString() : null,
          criadaEm: u.metadata.creationTime ? new Date(u.metadata.creationTime).toISOString() : null,
          desativada: u.disabled,
        });
      }
      pagina = r.pageToken;
    } while (pagina);

    const [atletasSnap, tokensSnap] = await Promise.all([db.collection("atletas").get(), db.collection("push_tokens").get()]);
    const comNotificacao = new Set(tokensSnap.docs.map((d) => String(d.data().atletaId ?? "")).filter(Boolean));

    const pessoas = atletasSnap.docs
      .map((d) => ({ ...(d.data() as Partial<import("@/lib/types").AtletaDoc>), id: d.id }))
      .filter((a) => a.visivelNasListas !== false)
      .map((a) => {
        const conta = a.authUid ? contas.get(String(a.authUid)) : undefined;
        return {
          atletaId: a.id,
          nome: String(a.nome ?? ""),
          email: a.email ?? null,
          equipe: a.equipe,
          ativo: a.ativo !== false,
          temConta: !!conta && !conta.desativada,
          ultimoUso: conta?.ultimoUso ?? null,
          contaCriadaEm: conta?.criadaEm ?? null,
          notificacoes: comNotificacao.has(a.id),
          fotoVersao: a.fotoVersao ?? null,
        };
      });

    return Response.json({ pessoas, geradoEm: new Date().toISOString() });
  } catch (error) {
    const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
    return apiErrorResponse(error, "Não foi possível consultar o uso do portal.");
  }
}
