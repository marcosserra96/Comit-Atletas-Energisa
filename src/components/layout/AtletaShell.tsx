"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, LayoutDashboard, Activity, CalendarCheck, Trophy, UserCircle } from "lucide-react";
import { RequireAtletaAccess } from "@/components/session/RequireAtletaAccess";
import { AtletaSidebar } from "@/components/layout/AtletaSidebar";
import { AtletaTopbar } from "@/components/layout/AtletaTopbar";
import { MobileBottomNav } from "@/components/ui/MobileBottomNav";
import { AthleteViewProvider, useAthleteView } from "@/lib/session/AthleteViewProvider";

const bottomNavItems = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/desempenho", label: "Desempenho", icon: Activity },
  { href: "/eventos", label: "Eventos", icon: CalendarCheck },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/perfil", label: "Perfil", icon: UserCircle },
];

function AtletaShellInner({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { atleta, isPreview, withPreview } = useAthleteView();
  const mobileItems = bottomNavItems.map((item) => ({ ...item, href: withPreview(item.href) }));

  return (
    <div className="flex min-h-screen">
      <AtletaSidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AtletaTopbar onOpenMobileNav={() => setMobileOpen(true)} />
        {isPreview && (
          <div className="sticky top-16 z-[9] flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-950 sm:px-6">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="size-4 shrink-0" />
              <span>
                Você está visualizando como <strong>{atleta.nome}</strong>. Nenhuma ação será realizada em nome do atleta.
              </span>
            </div>
            <Link
              href="/gestao/atletas?tab=ver"
              className="rounded-full border border-amber-400 bg-white px-3 py-1 text-xs font-bold transition-colors hover:bg-amber-100"
            >
              Encerrar visualização
            </Link>
          </div>
        )}
        <main className="min-w-0 flex-1 bg-bg p-4 pb-28 sm:p-6 lg:pb-6">{children}</main>
        <MobileBottomNav items={mobileItems} />
      </div>
    </div>
  );
}

export function AtletaShell({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const previewAtletaId = searchParams.get("visualizarAtleta");

  return (
    <RequireAtletaAccess>
      <AthleteViewProvider previewAtletaId={previewAtletaId}>
        <AtletaShellInner>{children}</AtletaShellInner>
      </AthleteViewProvider>
    </RequireAtletaAccess>
  );
}
