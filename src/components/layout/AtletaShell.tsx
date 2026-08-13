"use client";

import { useState } from "react";
import { RequireAtletaAccess } from "@/components/session/RequireAtletaAccess";
import { AtletaSidebar } from "@/components/layout/AtletaSidebar";
import { AtletaTopbar } from "@/components/layout/AtletaTopbar";
import { MobileBottomNav } from "@/components/ui/MobileBottomNav";
import {
  LayoutDashboard,
  Activity,
  CalendarCheck,
  Trophy,
  MoreHorizontal,
} from "lucide-react";

const bottomNavItems = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/desempenho", label: "Desempenho", icon: Activity },
  { href: "/eventos", label: "Eventos", icon: CalendarCheck },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/perfil", label: "Mais", icon: MoreHorizontal },
];

function AtletaShellInner({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <AtletaSidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AtletaTopbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 bg-bg p-4 pb-24 sm:p-6 lg:pb-6">{children}</main>
        <MobileBottomNav items={bottomNavItems} />
      </div>
    </div>
  );
}

export function AtletaShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAtletaAccess>
      <AtletaShellInner>{children}</AtletaShellInner>
    </RequireAtletaAccess>
  );
}
