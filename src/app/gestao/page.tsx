"use client";

import { useActiveSession } from "@/lib/session/SessionProvider";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { temPermissao } from "@/lib/permissoes";
import { VisaoEstrategica } from "./VisaoEstrategica";

export default function GestaoDashboardPage() {
  const { usuario } = useActiveSession();

  if (!temPermissao(usuario, "inicio")) {
    return <NotAuthorized />;
  }

  return <VisaoEstrategica />;
}
