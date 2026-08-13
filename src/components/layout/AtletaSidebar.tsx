"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserCircle,
  Activity,
  CalendarCheck,
  Newspaper,
  Trophy,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/perfil", label: "Perfil", icon: UserCircle },
  { href: "/desempenho", label: "Desempenho", icon: Activity },
  { href: "/eventos", label: "Eventos", icon: CalendarCheck },
  { href: "/noticias", label: "Notícias", icon: Newspaper },
  { href: "/ranking", label: "Ranking", icon: Trophy },
];

export function AtletaSidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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

        <nav className="mt-2 flex flex-1 flex-col gap-1 px-3" aria-label="Menu do atleta">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onCloseMobile}
                aria-current={active ? "page" : undefined}
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
