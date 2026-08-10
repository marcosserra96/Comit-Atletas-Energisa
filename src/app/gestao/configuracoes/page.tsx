"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { SubTabs } from "@/components/ui/SubTabs";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { TabPanel } from "@/components/ui/TabPanel";
import { UsuariosTab } from "./UsuariosTab";
import { IdentidadeVisualTab } from "./IdentidadeVisualTab";
import { InformativoTab } from "./InformativoTab";
import { ConsistenciaTab } from "./ConsistenciaTab";
import { DiagnosticoTab } from "./DiagnosticoTab";
import { AuditoriaTab } from "./AuditoriaTab";

type Tab = "usuarios" | "identidade" | "informativo" | "consistencia" | "diagnostico" | "auditoria";

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
          { value: "consistencia", label: "Consistência" },
          { value: "diagnostico", label: "Diagnóstico e dados" },
          { value: "auditoria", label: "Auditoria" },
        ]}
      />

      <AnimatePresence mode="wait">
        {tab === "usuarios" && (
          <TabPanel key="usuarios">
            <UsuariosTab />
          </TabPanel>
        )}
        {tab === "identidade" && (
          <TabPanel key="identidade">
            <IdentidadeVisualTab />
          </TabPanel>
        )}
        {tab === "informativo" && (
          <TabPanel key="informativo">
            <InformativoTab />
          </TabPanel>
        )}
        {tab === "consistencia" && (
          <TabPanel key="consistencia">
            <ConsistenciaTab />
          </TabPanel>
        )}
        {tab === "diagnostico" && (
          <TabPanel key="diagnostico">
            <DiagnosticoTab />
          </TabPanel>
        )}
        {tab === "auditoria" && (
          <TabPanel key="auditoria">
            <AuditoriaTab />
          </TabPanel>
        )}
      </AnimatePresence>
    </div>
  );
}
