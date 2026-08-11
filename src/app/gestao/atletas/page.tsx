"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { SubTabs } from "@/components/ui/SubTabs";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { TabPanel } from "@/components/ui/TabPanel";
import { temPermissao } from "@/lib/permissoes";
import { VerAtletasTab } from "./VerAtletasTab";
import { CadastrarTab } from "./CadastrarTab";
import { EquipesTab } from "./EquipesTab";
import { PendentesTab } from "./PendentesTab";

type Tab = "ver" | "cadastrar" | "equipes" | "pendentes";

const TABS: Tab[] = ["ver", "cadastrar", "equipes", "pendentes"];

export default function AtletasPage() {
  const { usuario } = useActiveSession();
  const isAdmin = usuario.role === "administrador";

  const searchParams = useSearchParams();
  const q = searchParams.get("q");
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(() =>
    TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "ver",
  );

  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    if (q) setTab("ver");
  }

  if (!temPermissao(usuario, "atletas")) {
    return <NotAuthorized />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Atletas</h2>
        <p className="text-sm text-text-light">
          Veja os atletas do programa, cadastre novos e gerencie as equipes.
        </p>
      </div>

      <SubTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "ver", label: "Ver atletas" },
          { value: "cadastrar", label: "Cadastrar" },
          { value: "equipes", label: "Equipes" },
          ...(isAdmin
            ? [{ value: "pendentes" as const, label: "Pedidos pendentes" }]
            : []),
        ]}
      />

      <TabPanel key={tab}>
        {tab === "ver" && <VerAtletasTab key={q ?? "none"} />}
        {tab === "cadastrar" && <CadastrarTab />}
        {tab === "equipes" && <EquipesTab />}
        {tab === "pendentes" && isAdmin && <PendentesTab />}
      </TabPanel>
    </div>
  );
}
