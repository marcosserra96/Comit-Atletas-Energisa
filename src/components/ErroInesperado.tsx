"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Tela de "algo deu errado": avisa o monitor e oferece um caminho claro.
 * O código curto (erros do servidor) ajuda a achar o caso no Sentry.
 */
export function ErroInesperado({ error, tentarDeNovo }: { error: Error & { digest?: string }; tentarDeNovo: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { origem: "tela" } });
  }, [error]);
  const codigo = error.digest?.slice(0, 8);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-warning-subtle text-warning">
          <TriangleAlert className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-bold text-text">Algo deu errado nesta tela</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-light">
          O problema foi registrado para a equipe corrigir. Tente de novo; se continuar, volte para o início.
        </p>
        <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={tentarDeNovo} className="w-full sm:w-auto">
            <RefreshCw className="size-4" aria-hidden="true" />
            Tentar de novo
          </Button>
          <Button variant="secondary" onClick={() => window.location.assign("/")} className="w-full sm:w-auto">
            Voltar ao início
          </Button>
        </div>
        {codigo ? <p className="mt-6 text-xs text-text-muted">Código do erro: {codigo}</p> : null}
      </div>
    </main>
  );
}

