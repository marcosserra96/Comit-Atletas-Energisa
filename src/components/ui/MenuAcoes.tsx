"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

/** Onde o menu abre: abaixo de um botão (alinhado à direita dele) ou no ponto do clique. */
type Ancora = { tipo: "botao"; rect: DOMRect } | { tipo: "ponto"; x: number; y: number };

const MARGEM = 8;

/**
 * O menu em si, desenhado por cima da página (portal): nunca é cortado por um
 * cartão com overflow e não rola a página ao receber o foco. Fecha com Esc,
 * clique fora, rolagem ou mudança de tamanho da janela.
 */
function MenuFlutuante({ acoes, rotulo, ancora, onFechar }: { acoes: AcaoDoMenu[]; rotulo: string; ancora: Ancora; onFechar: (devolverFoco: boolean) => void }) {
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Calcula a posição depois de medir o menu: vira para cima/esquerda quando não cabe.
  useLayoutEffect(() => {
    const el = menu.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if (ancora.tipo === "botao") {
      left = ancora.rect.right - w;
      top = ancora.rect.bottom + 4;
      if (top + h > vh - MARGEM) top = ancora.rect.top - h - 4;
    } else {
      left = ancora.x;
      top = ancora.y;
      if (left + w > vw - MARGEM) left = ancora.x - w;
      if (top + h > vh - MARGEM) top = ancora.y - h;
    }
    setPos({ left: Math.max(MARGEM, Math.min(left, vw - w - MARGEM)), top: Math.max(MARGEM, Math.min(top, vh - h - MARGEM)) });
    el.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus({ preventScroll: true });
  }, [ancora]);

  useEffect(() => {
    const fora = (e: Event) => {
      if (menu.current && !menu.current.contains(e.target as Node)) onFechar(false);
    };
    const fechar = () => onFechar(false);
    document.addEventListener("mousedown", fora, true);
    document.addEventListener("touchstart", fora, true);
    document.addEventListener("contextmenu", fora, true);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    window.addEventListener("blur", fechar);
    return () => {
      document.removeEventListener("mousedown", fora, true);
      document.removeEventListener("touchstart", fora, true);
      document.removeEventListener("contextmenu", fora, true);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
      window.removeEventListener("blur", fechar);
    };
  }, [onFechar]);

  function teclado(e: React.KeyboardEvent) {
    const itens = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
    const focar = (i: number) => itens[i]?.focus({ preventScroll: true });
    if (e.key === "Escape") {
      e.preventDefault();
      onFechar(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focar((atual + 1) % itens.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focar((atual - 1 + itens.length) % itens.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      focar(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focar(itens.length - 1);
    } else if (e.key === "Tab") {
      onFechar(false);
    }
  }

  const visiveis = acoes.filter((a) => !a.disabled);
  const comuns = visiveis.filter((a) => !a.perigo);
  const perigosas = visiveis.filter((a) => a.perigo);

  return createPortal(
    <div
      ref={menu}
      id={id}
      role="menu"
      aria-label={rotulo}
      onKeyDown={teclado}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: "fixed", left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? "visible" : "hidden" }}
      className="z-[200] min-w-52 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-card py-1 shadow-[var(--shadow-elevated)]"
    >
      {[...comuns, ...perigosas].map((a, i) => {
        const Icone = a.icone;
        return (
          <button
            key={a.rotulo}
            type="button"
            role="menuitem"
            onClick={() => {
              onFechar(false);
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
    </div>,
    document.body,
  );
}

/**
 * Botão "⋯" com as ações de um item (editar, estornar, excluir…). Abre por
 * cima da página, para cima quando não cabe embaixo. Teclado: setas,
 * Home/End, Esc devolve o foco.
 */
export function MenuAcoes({ acoes, rotulo, className }: { acoes: AcaoDoMenu[]; rotulo: string; className?: string }) {
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const fechar = useCallback((devolverFoco: boolean) => {
    setAncora(null);
    if (devolverFoco) botao.current?.focus({ preventScroll: true });
  }, []);
  if (acoes.every((a) => a.disabled)) return null;

  return (
    <div className={cn("relative shrink-0", className)}>
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={!!ancora}
        onClick={(e) => {
          e.stopPropagation();
          // Mede já: dentro do atualizador do estado o evento não tem mais currentTarget.
          const rect = e.currentTarget.getBoundingClientRect();
          setAncora((atual) => (atual ? null : { tipo: "botao", rect }));
        }}
        className="flex size-9 items-center justify-center rounded-[var(--radius)] text-text-muted transition-colors hover:bg-bg-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pointer-coarse:size-11"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {ancora ? <MenuFlutuante acoes={acoes} rotulo={rotulo} ancora={ancora} onFechar={fechar} /> : null}
    </div>
  );
}

/**
 * Clique com o botão direito num item abre as mesmas ações do "⋯" no ponto do
 * clique. Shift + botão direito mantém o menu do navegador; em campos de texto
 * e em texto selecionado o navegador também continua no controle.
 *
 * Uso: `const contexto = useMenuDeContexto(); <li onContextMenu={contexto.abrir(acoes, rotulo)}>…</li>{contexto.menu}`
 */
export function useMenuDeContexto() {
  const [estado, setEstado] = useState<{ acoes: AcaoDoMenu[]; rotulo: string; ancora: Ancora } | null>(null);
  const fechar = useCallback(() => setEstado(null), []);
  const abrir = useCallback(
    (acoes: AcaoDoMenu[], rotulo: string) => (e: React.MouseEvent) => {
      if (e.shiftKey) return;
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, [contenteditable=true]")) return;
      if (window.getSelection()?.toString()) return;
      if (acoes.every((a) => a.disabled)) return;
      e.preventDefault();
      e.stopPropagation();
      setEstado({ acoes, rotulo, ancora: { tipo: "ponto", x: e.clientX, y: e.clientY } });
    },
    [],
  );
  const menu: ReactNode = estado ? <MenuFlutuante acoes={estado.acoes} rotulo={estado.rotulo} ancora={estado.ancora} onFechar={fechar} /> : null;
  return { abrir, menu };
}
