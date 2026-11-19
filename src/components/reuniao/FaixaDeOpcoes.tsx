"use client";

import { type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";

export interface AbaDaFaixa<T extends string> {
  id: T;
  rotulo: string;
  /** Número de avisos ao lado do nome. */
  aviso?: number;
}

/**
 * Faixa de opções no estilo do PowerPoint: abas em cima e as ferramentas da
 * aba embaixo. Recolhida, ficam só as abas; tocar numa aba abre de novo.
 */
export function FaixaDeOpcoes<T extends string>({
  abas,
  aba,
  onAba,
  recolhida,
  onRecolher,
  children,
}: {
  abas: AbaDaFaixa<T>[];
  aba: T;
  onAba: (aba: T) => void;
  recolhida: boolean;
  onRecolher: (recolhida: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="shrink-0 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-card shadow-sm">
      <div className="flex items-end gap-1 border-b border-border bg-bg-inset/50 px-2 pt-1.5">
        <div role="tablist" aria-label="Faixa de opções" className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {abas.map((a) => {
            const ativa = a.id === aba && !recolhida;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={a.id === aba}
                onClick={() => {
                  if (a.id === aba && !recolhida) onRecolher(true);
                  else {
                    onAba(a.id);
                    onRecolher(false);
                  }
                }}
                className={cn(
                  "relative flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-[var(--radius-sm)] px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                  ativa ? "-mb-px border border-b-0 border-border bg-bg-card text-primary" : a.id === aba ? "text-primary" : "text-text-light hover:bg-bg-card/60 hover:text-text",
                )}
              >
                {a.rotulo}
                {a.aviso ? <span className="flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-on-accent">{a.aviso}</span> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onRecolher(!recolhida)}
          aria-expanded={!recolhida}
          title={recolhida ? "Mostrar a faixa de opções" : "Recolher a faixa de opções"}
          className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-light hover:bg-bg-card hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronUp className={cn("size-4 transition-transform", recolhida && "rotate-180")} aria-hidden="true" />
          <span className="sr-only">{recolhida ? "Mostrar a faixa de opções" : "Recolher a faixa de opções"}</span>
        </button>
      </div>
      {recolhida ? null : (
        <div role="tabpanel" className="max-h-[40vh] overflow-y-auto px-3 py-2">
          {children}
        </div>
      )}
    </div>
  );
}

/** Grupo de ferramentas com o nome embaixo, como no PowerPoint. */
export function GrupoDaFaixa({ nome, children, className }: { nome: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex shrink-0 flex-col justify-between gap-1", className)}>
      <div className="flex items-start gap-1">{children}</div>
      <h3 className="text-center text-[10px] font-medium text-text-muted">{nome}</h3>
    </section>
  );
}

/** Botão grande da faixa: ícone em cima, nome embaixo. */
export function BotaoDaFaixa({
  icone,
  rotulo,
  onClick,
  disabled,
  destaque,
  title,
}: {
  icone: ReactNode;
  rotulo: string;
  onClick: () => void;
  disabled?: boolean;
  destaque?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex min-h-[50px] w-[70px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1 text-center text-[11px] font-semibold sm:w-[76px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40",
        destaque ? "bg-primary text-on-primary hover:bg-primary-hover" : "text-text hover:bg-bg-inset",
      )}
    >
      <span className={cn("[&>svg]:size-5", destaque ? "" : "text-primary")}>{icone}</span>
      {rotulo}
    </button>
  );
}

export function SeparadorDaFaixa() {
  return <div className="hidden w-px self-stretch bg-border sm:block" aria-hidden="true" />;
}
