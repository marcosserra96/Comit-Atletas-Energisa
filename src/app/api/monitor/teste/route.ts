import * as Sentry from "@sentry/nextjs";
import { apiErrorResponse, authenticatedAdminRequest } from "@/lib/server/firebaseRequest";
import { ambienteMonitor, monitorLigado } from "@/lib/monitoramento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST → manda um erro de teste do servidor para o monitor (só administrador)
 * e devolve o id do evento, para conferir no Sentry que o caminho funciona.
 */
export async function POST(request: Request) {
  try {
    await authenticatedAdminRequest(request);
    if (!monitorLigado) return Response.json({ ligado: false, ambiente: ambienteMonitor, eventId: null });
    const eventId = Sentry.captureException(new Error("Teste do monitor de erros (servidor)"), { tags: { teste_monitor: "sim" }, level: "error" });
    const enviado = await Sentry.flush(4000);
    return Response.json({ ligado: true, ambiente: ambienteMonitor, eventId, enviado });
  } catch (error) {
    return apiErrorResponse(error, "Não foi possível enviar o teste agora.");
  }
}
