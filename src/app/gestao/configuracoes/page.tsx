"use client";

import { useState } from "react";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { SubTabs } from "@/components/ui/SubTabs";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { TabPanel } from "@/components/ui/TabPanel";
import { UsuariosTab } from "./UsuariosTab";
import { IdentidadeVisualTab } from "./IdentidadeVisualTab";
import { InformativoTab } from "./InformativoTab";
import { InformativoLayoutTab } from "./InformativoLayoutTab";
import { ConsistenciaTab } from "./ConsistenciaTab";
import { DiagnosticoTab } from "./DiagnosticoTab";
import { AuditoriaTab } from "./AuditoriaTab";

type Tab =
  | "usuarios"
  | "identidade"
  | "informativo"
  | "informativo_layout"
  | "consistencia"
  | "diagnostico"
  | "auditoria";

/** Conteúdo de cada aba. O TabPanel usa `key={tab}` pra remontar e animar a entrada. */
function conteudoDaAba(tab: Tab) {
  switch (tab) {
    case "usuarios":
      return <UsuariosTab />;
    case "identidade":
      return <IdentidadeVisualTab />;
    case "informativo":
      return <InformativoTab />;
    case "informativo_layout":
      return <InformativoLayoutTab />;
    case "consistencia":
      return <ConsistenciaTab />;
    case "diagnostico":
      return <DiagnosticoTab />;
    case "auditoria":
      return <AuditoriaTab />;
  }
}

export default function ConfigurarPortalPage() {
  const { usuario } = useActiveSession();
  const [tab, setTab] = useState<Tab>("usuarios");

  if (usuario.role !== "administrador") {
    return <NotAuthorized />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Configurar Portal</h2>
        <p className="text-sm text-text-light">
          Usuários, identidade visual e auditoria do programa.
        </p>
      </div>

      <SubTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "usuarios", label: "Usuários e permissões" },
          { value: "identidade", label: "Identidade visual" },
          { value: "informativo", label: "Informativo do ranking" },
          { value: "informativo_layout", label: "Layout do informativo" },
          { value: "consistencia", label: "Consistência" },
          { value: "diagnostico", label: "Diagnóstico e dados" },
          { value: "auditoria", label: "Auditoria" },
        ]}
      />

      <TabPanel key={tab}>{conteudoDaAba(tab)}</TabPanel>
    </div>
  );
}
