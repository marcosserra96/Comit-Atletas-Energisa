"use client";

import { RefreshCw, LogOut, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function TermosErroScreen({
  onRetry,
  onLogout,
}: {
  onRetry: () => Promise<void>;
  onLogout: () => void;
}) {
  const retry = () => void onRetry();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-6">
      <section className="w-full max-w-sm rounded-3xl border border-border bg-bg-card p-8 text-center shadow-xl">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-warning/15 text-ranking-gold-text">
          <TriangleAlert className="size-6" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-bold text-text">Não foi possível verificar os termos</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-light">
          Verifique sua conexão e tente novamente para continuar com segurança.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={retry} className="w-full">
            <RefreshCw className="size-4" aria-hidden="true" />
            Tentar novamente
          </Button>
          <Button variant="ghost" onClick={onLogout} className="w-full">
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </Button>
        </div>
      </section>
    </main>
  );
}
