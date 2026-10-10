"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface AcaoDoMenu {
  rotulo: string;
  icone?: LucideIcon;
  onSelect: () => void;
  /** Ação que apaga ou desfaz algo: aparece em vermelho, separada das outras. */
  perigo?: boolean;
  disabled?: boolean;
}

/**
 * Botão "⋯" com as ações de um item (editar, estornar, excluir…). Abre para
 * cima quando não cabe embaixo. Teclado: setas, Home/End, Esc devolve o foco.
 */
export function MenuAcoes({ acoes, rotulo, className }: { acoes: AcaoDoMenu[]; rotulo: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const [paraCima, setParaCima] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const visiveis = acoes.filter((a) => !a.disabled);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent | TouchEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
    };
  }, [aberto]);

  useLayoutEffect(() => {
    if (!aberto || !botao.current) return;
    const r = botao.current.getBoundingClientRect();
    setParaCima(window.innerHeight - r.bottom < 56 * visiveis.length + 24);
    menu.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  }, [aberto, visiveis.length]);

  function fechar(devolverFoco = true) {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  }

  function teclado(e: React.KeyboardEvent) {
    const itens = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      itens[(atual + 1) % itens.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itens[(atual - 1 + itens.length) % itens.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      itens[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      itens[itens.length - 1]?.focus();
    } else if (e.key === "Tab") {
      fechar(false);
    }
  }

  if (visiveis.length === 0) return null;
  const comuns = visiveis.filter((a) => !a.perigo);
  const perigosas = visiveis.filter((a) => a.perigo);

  return (
    <div ref={raiz} className={cn("relative shrink-0", className)}>
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setAberto((v) => !v);
        }}
        className="flex size-9 items-center justify-center rounded-[var(--radius)] text-text-muted transition-colors hover:bg-bg-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pointer-coarse:size-11"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {aberto ? (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={rotulo}
          onKeyDown={teclado}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute right-0 z-30 min-w-52 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-card py-1 shadow-[var(--shadow-elevated)]",
            paraCima ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {[...comuns, ...perigosas].map((a, i) => {
            const Icone = a.icone;
            return (
              <button
                key={a.rotulo}
                type="button"
                role="menuitem"
                onClick={() => {
                  fechar(false);
                  a.onSelect();
                }}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2.5 px-3.5 text-left text-sm font-medium transition-colors focus-visible:outline-none",
                  a.perigo ? "text-danger hover:bg-danger/10 focus-visible:bg-danger/10" : "text-text hover:bg-bg-inset focus-visible:bg-bg-inset",
                  a.perigo && i === comuns.length && comuns.length > 0 && "border-t border-border-subtle",
                )}
              >
                {Icone ? <Icone className="size-4 shrink-0" aria-hidden="true" /> : null}
                {a.rotulo}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
