"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session/SessionProvider";
import { souTambemAtleta } from "@/lib/session/dualRole";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";

/**
 * Guarda a área do atleta. Administradores também podem entrar quando há um
 * atleta explícito na URL, mantendo a sessão real e somente visualizando os dados.
 */
export function RequireAtletaAccess({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewAtletaId = searchParams.get("visualizarAtleta");

  const podeAcessar =
    session.status === "active" &&
    (session.usuario.role === "atleta" ||
      souTambemAtleta(session.usuario, session.atleta) ||
      (session.usuario.role === "administrador" && Boolean(previewAtletaId)));

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
