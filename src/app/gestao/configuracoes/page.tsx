"use client";

import { useState } from "react";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { SubTabs } from "@/components/ui/SubTabs";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { CriteriosTab } from "./CriteriosTab";
import { UsuariosTab } from "./UsuariosTab";
import { IdentidadeVisualTab } from "./IdentidadeVisualTab";
import { DiagnosticoTab } from "./DiagnosticoTab";
import { AuditoriaTab } from "./AuditoriaTab";

type Tab = "criterios" | "usuarios" | "identidade" | "diagnostico" | "auditoria";

export default function ConfigurarPortalPage() {
  const { usuario } = useActiveSession();
  const [tab, setTab] = useState<Tab>("criterios");

  if (usuario.role !== "administrador") {
    return <NotAuthorized />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Configurar Portal</h2>
        <p className="text-sm text-text-light">
          Critérios de pontuação, usuários, identidade visual e auditoria do programa.
        </p>
      </div>

      <SubTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "criterios", label: "Critérios de pontuação" },
          { value: "usuarios", label: "Usuários e permissões" },
          { value: "identidade", label: "Identidade visual" },
          { value: "diagnostico", label: "Diagnóstico e dados" },
          { value: "auditoria", label: "Auditoria" },
        ]}
      />

      {tab === "criterios" && <CriteriosTab />}
      {tab === "usuarios" && <UsuariosTab />}
      {tab === "identidade" && <IdentidadeVisualTab />}
      {tab === "diagnostico" && <DiagnosticoTab />}
      {tab === "auditoria" && <AuditoriaTab />}
    </div>
  );
}
