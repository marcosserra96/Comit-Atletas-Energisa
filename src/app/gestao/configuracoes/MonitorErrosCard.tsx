"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { Activity, CheckCircle2, ExternalLink } from "lucide-react";
import { apiAutenticada } from "@/lib/apiCliente";
import { ambienteMonitor, monitorLigado } from "@/lib/monitoramento";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const NOME_AMBIENTE: Record<string, string> = { production: "produção", preview: "prévia", development: "desenvolvimento" };

/**
 * Confere de ponta a ponta se o monitor de erros (Sentry) recebe o que o
 * portal manda: um erro de teste do navegador e um do servidor.
 */
export function MonitorErrosCard() {
  const { show } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ navegador: string; servidor: string | null } | null>(null);

  async function testar() {
    setEnviando(true);
    try {
      const navegador = Sentry.captureException(new Error("Teste do monitor de erros (navegador)"), { tags: { teste_monitor: "sim" } });
      await Sentry.flush(4000);
      const servidor = await apiAutenticada<{ eventId: string | null }>("/api/monitor/teste", { method: "POST" });
      setResultado({ navegador, servidor: servidor.eventId });
      show("success", "Erros de teste enviados.");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível enviar o teste agora.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="flex max-w-xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-bold text-text">Monitor de erros</h3>
      </div>
      <p className="text-sm text-text-light">
        {monitorLigado
          ? `Ligado em ${NOME_AMBIENTE[ambienteMonitor] ?? ambienteMonitor}. Os erros do portal vão para o Sentry, sem dados pessoais.`
          : "Desligado neste ambiente (desenvolvimento ou emulador): o teste só vale no portal publicado."}
      </p>
      {resultado ? (
        <div className="flex items-start gap-2 rounded-[var(--radius)] bg-success/10 p-3 text-sm text-text" role="status">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="font-semibold">Enviado. No Sentry, procure por “Teste do monitor de erros”.</p>
            <p className="mt-0.5 text-xs text-text-light">
              Devem aparecer dois em até um minuto: navegador ({resultado.navegador.slice(0, 8)}) e servidor ({resultado.servidor ? resultado.servidor.slice(0, 8) : "não enviado"}). Se não aparecer nenhum, o portal está mandando para outro projeto.
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => void testar()} loading={enviando} disabled={!monitorLigado}>
          Enviar erro de teste
        </Button>
        <a href="https://sentry.io/issues/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-primary hover:text-primary-hover">
          Abrir o Sentry
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </Card>
  );
}
