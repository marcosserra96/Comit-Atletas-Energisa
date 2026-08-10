"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { SubTabs } from "@/components/ui/SubTabs";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { TabPanel } from "@/components/ui/TabPanel";
import { temPermissao } from "@/lib/permissoes";
import { ResumoTab } from "./ResumoTab";
import { GastosTab } from "./GastosTab";

type Tab = "resumo" | "gastos";

export default function FinanceiroPage() {
  const { usuario } = useActiveSession();
  const [tab, setTab] = useState<Tab>("resumo");

  if (!temPermissao(usuario, "financeiro")) {
    return <NotAuthorized />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Financeiro</h2>
        <p className="text-sm text-text-light">
          Acompanhe o orçamento do programa, veja o que foi gasto e o que está previsto.
        </p>
      </div>

      <SubTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "resumo", label: "Resumo" },
          { value: "gastos", label: "Gastos" },
        ]}
      />

      <AnimatePresence mode="wait">
        {tab === "resumo" ? (
          <TabPanel key="resumo">
            <ResumoTab />
          </TabPanel>
        ) : (
          <TabPanel key="gastos">
            <GastosTab />
          </TabPanel>
        )}
      </AnimatePresence>
    </div>
  );
}
