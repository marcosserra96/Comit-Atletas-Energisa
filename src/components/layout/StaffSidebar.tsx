"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  CalendarCheck,
  Newspaper,
  Wallet,
  Settings,
  UserCog,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { temPermissao, type PermissaoChave } from "@/lib/permissoes";
import type { Role } from "@/lib/types";

const baseItems: { href: string; label: string; icon: typeof LayoutDashboard; permissao?: PermissaoChave }[] = [
  { href: "/gestao", label: "Início", icon: LayoutDashboard, permissao: "inicio" },
  { href: "/gestao/atletas", label: "Atletas", icon: Users, permissao: "atletas" },
  { href: "/gestao/pontuacao", label: "Registrar", icon: Target, permissao: "registrar" },
  { href: "/gestao/eventos", label: "Eventos", icon: CalendarCheck, permissao: "eventos" },
  { href: "/gestao/noticias", label: "Notícias", icon: Newspaper, permissao: "noticias" },
  { href: "/gestao/financeiro", label: "Financeiro", icon: Wallet, permissao: "financeiro" },
];

const adminOnlyItems = [
  { href: "/gestao/configuracoes", label: "Configurar Portal", icon: Settings },
];

const accountItem = { href: "/gestao/conta", label: "Minha Conta", icon: UserCog };

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
  const [collapsed, setCollapsed] = useState(false);
  const items = [
    ...baseItems.filter(
      (item) => !item.permissao || temPermissao({ role, permissoes }, item.permissao),
    ),
    ...(role === "administrador" ? adminOnlyItems : []),
    accountItem,
  ];

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col bg-navy transition-transform duration-200",
          "lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 lg:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[72px]" : "lg:w-64",
        )}
      >
        <div className="flex h-16 items-center px-4">
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
              className="h-9 w-auto"
            />
          )}
        </div>

        {!collapsed && (
          <span className="mx-4 mb-2 w-fit rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white/70">
            {role === "administrador" ? "ADMINISTRADOR" : "COMITÊ"}
          </span>
        )}

        <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium text-white/70 transition-colors",
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
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "hidden items-center gap-2 border-t border-white/10 px-4 py-4 text-xs font-medium text-white/50 hover:text-white/80 lg:flex",
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
