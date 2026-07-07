"use client";

import { useState } from "react";
import { RequireRole } from "@/components/session/RequireRole";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
import { StaffTopbar } from "@/components/layout/StaffTopbar";

function GestaoShellInner({ children }: { children: React.ReactNode }) {
  const { usuario } = useActiveSession();
  const role = usuario.role as "comite" | "administrador";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <StaffSidebar
        role={role}
        permissoes={usuario.permissoes}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 bg-bg p-4 sm:p-6">{children}</main>
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
