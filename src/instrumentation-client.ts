import * as Sentry from "@sentry/nextjs";
import { opcoesBase, URLS_IGNORADAS } from "@/lib/monitoramento";

try {
  Sentry.init({
    ...opcoesBase,
    // Sem gravação de tela (Replay): privacidade em primeiro lugar.
    denyUrls: URLS_IGNORADAS,
  });
} catch {
  // O monitor nunca pode derrubar o app.
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
