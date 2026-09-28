"use client";

import { useActiveSession } from "@/lib/session/SessionProvider";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { temPermissao } from "@/lib/permissoes";
import { CriteriosTab } from "./CriteriosTab";

export default function CriteriosPage() {
  const { usuario } = useActiveSession();

  if (!temPermissao(usuario, "regras")) {
    return <NotAuthorized />;
  }

  return (
    <CriteriosTab />
  );
}
