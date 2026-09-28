"use client";

import { cn } from "@/lib/cn";

interface SubTabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  /** Nome acessível do grupo de abas (ex.: "Seções de atletas"). */
  label?: string;
}

/**
 * Abas de seção de uma página (Atletas, Lançar pontos, Financeiro…).
 * Estilo sublinhado, para não competir com o botão principal da página; no
 * celular a faixa rola para o lado em vez de quebrar linha.
 * Para alternar filtros ou visões dentro de uma seção, use `SegmentedControl`.
 */
export function SubTabs<T extends string>({ value, onChange, options, label }: SubTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mx-4 flex overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {options.map((opt) => {
        const ativo = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative -mb-px min-h-11 shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
              ativo
                ? "border-primary text-primary"
                : "border-transparent text-text-light hover:border-border-strong hover:text-text",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
