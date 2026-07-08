"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session/SessionProvider";
import { souTambemAtleta } from "@/lib/session/dualRole";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";

/**
 * Guarda a área do atleta: acessível a quem tem role "atleta", e também a
 * comitê/administrador que sejam atletas competindo de fato (ver souTambemAtleta).
 * Staff sem essa condição é redirecionado para /gestao em vez de ver uma área que
 * não é dele.
 */
export function RequireAtletaAccess({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const router = useRouter();

  const podeAcessar =
    session.status === "active" &&
    (session.usuario.role === "atleta" || souTambemAtleta(session.usuario, session.atleta));

  useEffect(() => {
    if (session.status === "signed-out") {
      router.replace("/login");
    } else if (session.status === "active" && !podeAcessar) {
      router.replace("/gestao");
    }
  }, [session, podeAcessar, router]);

  if (session.status !== "active" || !podeAcessar) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}
