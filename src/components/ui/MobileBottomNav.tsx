"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface MobileBottomNavProps {
  items: {
    href: string;
    label: string;
    icon: LucideIcon;
  }[];
  className?: string;
}

export function MobileBottomNav({ items, className }: MobileBottomNavProps) {
  const pathname = usePathname();
  const displayItems = items.slice(0, 5);

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
            const isActive =
              pathname === hrefPath || pathname?.startsWith(`${hrefPath}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-auto touch-manipulation select-none flex-col items-center justify-center gap-1 px-0.5 py-2",
                  "transition-colors duration-150 active:bg-primary/10",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                  isActive
                    ? "text-primary"
                    : "text-text-muted hover:text-text-light",
                )}
              >
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 top-0 h-1 rounded-b-full bg-primary"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full transition-colors",
                    isActive ? "bg-primary-subtle" : "bg-transparent",
                  )}
                >
                  <Icon size={21} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                {/* Peso fixo: o rótulo não muda de largura ao ficar ativo. */}
                <span className="max-w-full truncate text-center text-[11px] font-semibold leading-none tracking-[-0.01em]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
