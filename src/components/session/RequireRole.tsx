"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session/SessionProvider";
import { homeForRole } from "@/lib/session/routing";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import type { Role } from "@/lib/types";

export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.status === "signed-out") {
      router.replace("/login");
    } else if (session.status === "active" && !roles.includes(session.usuario.role)) {
      router.replace(homeForRole(session.usuario.role));
    }
  }, [session, roles, router]);

  if (session.status !== "active" || !roles.includes(session.usuario.role)) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}
