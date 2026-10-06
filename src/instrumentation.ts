import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const { opcoesBase } = await import("@/lib/monitoramento");
    Sentry.init(opcoesBase);
  }
}

/** Erros de renderização no servidor e de rotas que não foram tratados. */
export const onRequestError = Sentry.captureRequestError;
