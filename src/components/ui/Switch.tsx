"use client";

import { cn } from "@/lib/cn";

/** Chave liga/desliga acessível (role="switch"), com área de toque de 44 px. */
export function Switch({
  ativo,
  onChange,
  rotulo,
  disabled = false,
  className,
}: {
  ativo: boolean;
  onChange: (ativo: boolean) => void;
  /** Lido por leitores de tela (o texto visível fica ao lado, em quem usa). */
  rotulo: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={rotulo}
      disabled={disabled}
      onClick={() => onChange(!ativo)}
      className={cn(
        "flex min-h-11 min-w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
        className,
      )}
    >
      <span className={cn("relative h-6 w-10 rounded-full transition-colors", ativo ? "bg-primary" : "bg-border")}>
        <span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform", ativo ? "translate-x-4" : "translate-x-0")} />
      </span>
    </button>
  );
}
