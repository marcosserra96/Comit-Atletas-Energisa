"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Menu } from "lucide-react";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { souTambemAtleta } from "@/lib/session/dualRole";
import { roleLabel } from "@/lib/labels";

const titleByPath: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/perfil": "Perfil",
  "/desempenho": "Desempenho",
  "/eventos": "Eventos",
  "/noticias": "Notícias",
  "/ranking": "Ranking",
};

export function AtletaTopbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = usePathname();
  const { atleta, usuario, logout } = useActiveSession();
  const title = titleByPath[pathname] ?? "";
  const initial = atleta.nome.trim().charAt(0).toUpperCase();
  const tambemComite = souTambemAtleta(usuario, atleta);

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-bg-card px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          aria-label="Abrir menu"
          className="flex size-9 items-center justify-center rounded-[var(--radius)] text-text-muted hover:bg-bg lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <h1 className="text-lg font-bold text-text">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {tambemComite && (
          <Link
            href="/gestao"
            className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 sm:flex"
          >
            <LayoutDashboard className="size-3.5" />
            Modo Comitê
          </Link>
        )}

        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initial}
          </span>
          <div className="hidden leading-tight sm:block">
            <span className="block text-sm font-medium text-text">{atleta.nome.split(" ")[0]}</span>
            {tambemComite && (
              <span className="block text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {roleLabel[usuario.role]}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          aria-label="Sair"
          title="Sair"
          className="flex size-9 items-center justify-center rounded-[var(--radius)] text-text-muted transition-colors hover:bg-bg hover:text-danger"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </header>
  );
}
