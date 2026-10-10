"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, LayoutDashboard, Menu, Newspaper, Target, Users, Wallet } from "lucide-react";
import { RequireRole } from "@/components/session/RequireRole";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
import { StaffTopbar } from "@/components/layout/StaffTopbar";
import { MobileBottomNav } from "@/components/ui/MobileBottomNav";
import { temPermissao, type PermissaoChave } from "@/lib/permissoes";

/** Atalhos da barra inferior no celular, por ordem de uso; entram os 4 primeiros permitidos. */
const ATALHOS: { href: string; label: string; icon: typeof Menu; permissao: PermissaoChave; exato?: boolean }[] = [
  { href: "/gestao", label: "Início", icon: LayoutDashboard, permissao: "inicio", exato: true },
  { href: "/gestao/pontuacao", label: "Pontos", icon: Target, permissao: "registrar" },
  { href: "/gestao/atletas", label: "Atletas", icon: Users, permissao: "atletas" },
  { href: "/gestao/eventos", label: "Eventos", icon: CalendarCheck, permissao: "eventos" },
  { href: "/gestao/noticias", label: "Notícias", icon: Newspaper, permissao: "noticias" },
  { href: "/gestao/financeiro", label: "Financeiro", icon: Wallet, permissao: "financeiro" },
];

function GestaoShellInner({ children }: { children: React.ReactNode }) {
  const { usuario } = useActiveSession();
  const role = usuario.role as "comite" | "administrador";
  const [mobileOpen, setMobileOpen] = useState(false);

  // O comitê também recebe avisos: mantém o aparelho inscrito (token renovado 1x/dia).
  useEffect(() => {
    void import("@/lib/push/cliente").then((m) => m.sincronizarPush());
  }, []);
  const atalhos = ATALHOS.filter((item) =>
    temPermissao({ role, permissoes: usuario.permissoes }, item.permissao),
  ).slice(0, 4);

  return (
    <div className="flex min-h-dvh">
      <StaffSidebar
        role={role}
        permissoes={usuario.permissoes}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 bg-bg p-4 pb-32 sm:p-6 lg:pb-6">{children}</main>
        <MobileBottomNav
          items={atalhos}
          menu={{ label: "Menu", icon: Menu, onClick: () => setMobileOpen(true) }}
        />
      </div>
    </div>
  );
}

export function GestaoShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["comite", "administrador"]}>
      <GestaoShellInner>{children}</GestaoShellInner>
    </RequireRole>
  );
}
