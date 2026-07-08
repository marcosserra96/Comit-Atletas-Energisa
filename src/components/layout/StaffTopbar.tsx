"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bike, Footprints, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { roleLabel } from "@/lib/labels";
import { souTambemAtleta } from "@/lib/session/dualRole";

const titleByPath: Record<string, string> = {
  "/gestao": "Início",
  "/gestao/atletas": "Atletas",
  "/gestao/pontuacao": "Registrar",
  "/gestao/eventos": "Eventos",
  "/gestao/noticias": "Notícias",
  "/gestao/financeiro": "Financeiro",
  "/gestao/configuracoes": "Configurar Portal",
  "/gestao/conta": "Minha Conta",
};

export function StaffTopbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { atleta, usuario, logout } = useActiveSession();
  const title = titleByPath[pathname] ?? "";
  const initial = atleta.nome.trim().charAt(0).toUpperCase();
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const [busca, setBusca] = useState("");
  const tambemAtleta = souTambemAtleta(usuario, atleta);
  const IconModalidade = atleta.equipe === "bicicleta" ? Bike : Footprints;

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (!busca.trim()) return;
    router.push(`/gestao/atletas?q=${encodeURIComponent(busca.trim())}`);
  }

  return (
    <header className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-3 border-b-2 border-primary bg-navy px-4 shadow-[0_2px_12px_rgba(0,0,0,0.2)] sm:px-5">
      <button
        onClick={onOpenMobileNav}
        aria-label="Abrir menu"
        className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <h1 className="hidden shrink-0 text-sm font-bold text-white/90 lg:block">{title}</h1>

      <form onSubmit={handleBuscar} className="relative flex-1 max-w-[400px]">
        <Search className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-white/40" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar atleta…"
          className="h-9 w-full rounded-[var(--radius)] border border-white/10 bg-white/[0.08] pl-[34px] pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-primary/50 focus:bg-white/[0.13] focus:ring-2 focus:ring-primary/15"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        {tambemAtleta && (
          <Link
            href="/dashboard"
            className="hidden items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/15 px-3 py-1.5 text-xs font-bold text-secondary transition-colors hover:bg-secondary/25 sm:flex"
          >
            <IconModalidade className="size-3.5" />
            Minha Área
          </Link>
        )}

        <button
          onClick={toggleTheme}
          aria-label="Alternar tema"
          title="Alternar tema"
          className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-white/[0.06] text-white/65 transition-colors hover:bg-white/[0.14] hover:text-white"
        >
          {theme === "light" ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
        </button>

        <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.07] py-1 pl-1 pr-3">
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {initial}
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-[13px] font-semibold text-white">{atleta.nome.split(" ")[0]}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">
              {roleLabel[usuario.role]}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          aria-label="Sair"
          title="Sair"
          className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-white/[0.06] text-white/65 transition-colors hover:bg-white/[0.14] hover:text-white"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </header>
  );
}
