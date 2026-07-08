"use client";

import { useState } from "react";
import { RequireAtletaAccess } from "@/components/session/RequireAtletaAccess";
import { AtletaSidebar } from "@/components/layout/AtletaSidebar";
import { AtletaTopbar } from "@/components/layout/AtletaTopbar";

function AtletaShellInner({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <AtletaSidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AtletaTopbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1 bg-bg p-4 sm:p-6">{children}</main>
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
