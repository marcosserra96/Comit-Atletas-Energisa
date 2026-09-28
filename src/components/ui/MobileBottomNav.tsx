"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface MobileBottomNavProps {
  items: {
    href: string;
    label: string;
    icon: LucideIcon;
    /** Considera ativo só no caminho exato (ex.: "/gestao" não deve acender em "/gestao/atletas"). */
    exato?: boolean;
  }[];
  /** Último botão que abre o menu completo (usado na gestão, que tem mais telas). */
  menu?: { label: string; icon: LucideIcon; onClick: () => void };
  className?: string;
}

const MOLA = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const;

const classeItem = cn(
  "relative flex min-w-0 flex-auto touch-manipulation select-none flex-col items-center justify-center gap-1 px-0.5 py-2",
  "transition-colors duration-150",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
  // Resposta ao toque só no ícone, que é o que o dedo cobre.
  "[&:active_[data-icone]]:scale-90",
);

function Conteudo({
  icon: Icon,
  label,
  ativo,
  grupo,
}: {
  icon: LucideIcon;
  label: string;
  ativo: boolean;
  grupo: string;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        data-icone=""
        className="relative flex size-9 items-center justify-center rounded-full transition-transform duration-150 ease-out"
      >
        {ativo ? (
          <motion.span
            layoutId={`${grupo}-fundo`}
            transition={MOLA}
            className="absolute inset-0 rounded-full bg-primary-subtle"
          />
        ) : null}
        <Icon size={21} strokeWidth={ativo ? 2.5 : 2} className="relative" />
      </span>
      {/* Peso fixo: o rótulo não muda de largura ao ficar ativo. */}
      <span className="max-w-full truncate text-center text-[11px] font-semibold leading-none tracking-[-0.01em]">
        {label}
      </span>
    </>
  );
}

export function MobileBottomNav({ items, menu, className }: MobileBottomNavProps) {
  const pathname = usePathname();
  const grupo = useId();
  const displayItems = items.slice(0, menu ? 4 : 5);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
      <nav
        aria-label="Navegação principal"
        className={cn(
          "w-full border-t border-border-subtle bg-bg-card/95 shadow-[var(--shadow-elevated)] backdrop-blur-xl",
          "pb-[env(safe-area-inset-bottom)]",
          className,
        )}
      >
        {/* Colunas flexíveis (não iguais): rótulos longos como "Desempenho" ganham o
            espaço que os curtos ("Início", "Perfil") não usam, e cabem inteiros. */}
        <div className="flex h-[72px] items-stretch px-1">
          {displayItems.map((item) => {
            const hrefPath = item.href.split("?")[0];
            const isActive = item.exato
              ? pathname === hrefPath
              : pathname === hrefPath || pathname?.startsWith(`${hrefPath}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(classeItem, isActive ? "text-primary" : "text-text-muted hover:text-text-light")}
              >
                {isActive ? (
                  <motion.span
                    layoutId={`${grupo}-traco`}
                    transition={MOLA}
                    aria-hidden="true"
                    className="absolute inset-x-3 top-0 h-1 rounded-b-full bg-primary"
                  />
                ) : null}
                <Conteudo icon={item.icon} label={item.label} ativo={isActive} grupo={grupo} />
              </Link>
            );
          })}
          {menu ? (
            <button
              type="button"
              onClick={menu.onClick}
              className={cn(classeItem, "text-text-muted hover:text-text-light")}
            >
              <Conteudo icon={menu.icon} label={menu.label} ativo={false} grupo={grupo} />
            </button>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
