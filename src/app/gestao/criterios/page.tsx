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
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Critérios de pontuação</h2>
        <p className="text-sm text-text-light">
          Defina as regras usadas para pontuar treinos, eventos e lançamentos avulsos.
        </p>
      </div>

      <CriteriosTab />
    </div>
  );
}
