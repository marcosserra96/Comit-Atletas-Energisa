"use client";

import { XCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function RecusadoScreen({
  motivo,
  onLogout,
}: {
  motivo?: string;
  onLogout: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-bg-card p-9 text-center shadow-xl">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <XCircle className="size-6" />
        </span>
        <h1 className="mb-2 text-lg font-bold text-text">Solicitação não aprovada</h1>
        <p className="mb-2 text-sm leading-relaxed text-text-light">
          Seu pedido de acesso ao portal não foi aprovado pelo administrador.
        </p>
        {motivo && (
          <p className="mb-7 rounded-[var(--radius)] bg-bg px-4 py-3 text-sm text-text">
            &ldquo;{motivo}&rdquo;
          </p>
        )}
        <Button variant="secondary" className="w-full" onClick={onLogout}>
          <LogOut className="size-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
