"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  Target,
  CalendarCheck,
  Newspaper,
  Megaphone,
  ClipboardList,
  Wallet,
  Settings,
  UserCog,
  ChevronsLeft,
  ChevronsRight,
  X,
  Bike,
  Footprints,
  BellRing,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { RodapeDaGaveta } from "@/components/layout/RodapeDaGaveta";
import { useGavetaMobile } from "@/components/layout/useGavetaMobile";
import { temPermissao, type PermissaoChave } from "@/lib/permissoes";
import type { Role } from "@/lib/types";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { souTambemAtleta } from "@/lib/session/dualRole";
import { useFotoAtleta } from "@/lib/fotos";

const baseItems: { href: string; label: string; icon: typeof LayoutDashboard; permissao?: PermissaoChave }[] = [
  { href: "/gestao", label: "Início", icon: LayoutDashboard, permissao: "inicio" },
  { href: "/gestao/atletas", label: "Atletas", icon: Users, permissao: "atletas" },
  { href: "/gestao/criterios", label: "Critérios", icon: ListChecks, permissao: "regras" },
  { href: "/gestao/pontuacao", label: "Pontuação", icon: Target, permissao: "registrar" },
  { href: "/gestao/eventos", label: "Eventos", icon: CalendarCheck, permissao: "eventos" },
  { href: "/gestao/noticias", label: "Notícias", icon: Newspaper, permissao: "noticias" },
  { href: "/gestao/informativo", label: "Informativo", icon: Megaphone, permissao: "informativo" },
  { href: "/gestao/reuniao", label: "Reunião de resultados", icon: Presentation, permissao: "informativo" },
  { href: "/gestao/pesquisas", label: "Pesquisas", icon: ClipboardList, permissao: "pesquisas" },
  { href: "/gestao/notificacoes", label: "Notificações", icon: BellRing, permissao: "notificacoes" },
  { href: "/gestao/financeiro", label: "Financeiro", icon: Wallet, permissao: "financeiro" },
];

const adminOnlyItems = [
  { href: "/gestao/configuracoes", label: "Configurar portal", icon: Settings },
];

const accountItem = { href: "/gestao/conta", label: "Minha conta", icon: UserCog };

export function StaffSidebar({
  role,
  permissoes,
  mobileOpen,
  onCloseMobile,
}: {
  role: Extract<Role, "comite" | "administrador">;
  permissoes?: string[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const { usuario, atleta, logout } = useActiveSession();
  const foto = useFotoAtleta(atleta);
  const painelRef = useRef<HTMLElement>(null);
  const gestos = useGavetaMobile(mobileOpen, onCloseMobile, painelRef);
  const [collapsed, setCollapsed] = useState(false);
  const tambemAtleta = souTambemAtleta(usuario, atleta);
  const IconModalidade = atleta.equipe === "bicicleta" ? Bike : Footprints;
  const items = [
    ...baseItems.filter(
      (item) => !item.permissao || temPermissao({ role, permissoes }, item.permissao),
    ),
    ...(role === "administrador" ? adminOnlyItems : []),
    accountItem,
  ];

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-[55] bg-navy/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onCloseMobile}
      />
      <aside
        ref={painelRef}
        {...gestos}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? "Menu" : undefined}
        tabIndex={-1}
        className={cn(
          "superficie-escura fixed inset-y-0 left-0 z-[60] flex h-dvh w-[min(18rem,85vw)] shrink-0 flex-col bg-navy outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:w-64",
          "lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 lg:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[72px]" : "lg:w-64",
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          {collapsed ? (
            <span className="hidden size-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white lg:flex">
              AE
            </span>
          ) : (
            <Image
              src="/logos/logo-comite-branca-trim.png"
              alt="Atletas Energisa"
              width={140}
              height={44}
              className="h-auto w-[132px]"
            />
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        {!collapsed && (
          <span className="mx-4 mb-2 w-fit rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold tracking-wider text-white/70">
            {role === "administrador" ? "ADMINISTRADOR" : "COMITÊ"}
          </span>
        )}

        <nav className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3" aria-label="Menu de gestão">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onCloseMobile}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium text-white/70 transition-colors lg:min-h-0",
                  "hover:bg-white/5 hover:text-white",
                  active && "bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-secondary)]",
                  collapsed && "lg:justify-center lg:px-0",
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className="size-[18px] shrink-0" />
                <span className={cn(collapsed && "lg:hidden")}>{label}</span>
              </Link>
            );
          })}

          {tambemAtleta && (
            <Link
              href="/dashboard"
              onClick={onCloseMobile}
              className={cn(
                "mt-2 flex min-h-11 shrink-0 items-center gap-3 rounded-[var(--radius)] bg-secondary/15 px-3 py-2.5 text-sm font-bold text-secondary transition-colors",
                "hover:bg-secondary/25 focus-visible:ring-2 focus-visible:ring-secondary",
                collapsed && "lg:justify-center lg:px-0",
              )}
              title={collapsed ? "Área do atleta" : undefined}
            >
              <IconModalidade className="size-[18px] shrink-0" />
              <span className={cn(collapsed && "lg:hidden")}>Área do atleta</span>
            </Link>
          )}
        </nav>

        <RodapeDaGaveta nome={atleta.nome} foto={foto} papel={role === "administrador" ? "Administrador" : "Comitê"} onSair={logout} comTema />

        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "hidden items-center gap-2 border-t border-white/10 px-4 py-4 text-xs font-medium text-white/50 hover:text-white/80 lg:flex cursor-pointer",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && "Recolher"}
        </button>
      </aside>
    </>
  );
}
