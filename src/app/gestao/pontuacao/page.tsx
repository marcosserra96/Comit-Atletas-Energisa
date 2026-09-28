"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { SubTabs } from "@/components/ui/SubTabs";
import { TabPanel } from "@/components/ui/TabPanel";
import { temPermissao } from "@/lib/permissoes";
import { LancarPontosTab } from "./LancarPontosTab";
import { ExtratoTab } from "./ExtratoTab";
import { ConsolidadoTab } from "./ConsolidadoTab";
import { JustificativasTab } from "./JustificativasTab";
import { HistoricoMensalTab } from "./HistoricoMensalTab";
import { carregarJustificativasGestao } from "@/lib/justificativasAusenciaClient";
import type { JustificativaAusenciaDoc } from "@/lib/types";

type Tab = "lancar" | "historico" | "justificativas" | "extrato" | "consolidado";

export default function PontuacaoPage() {
  const { usuario } = useActiveSession();
  const [tab, setTab] = useState<Tab>("lancar");
  const [justificativas, setJustificativas] = useState<JustificativaAusenciaDoc[] | null>(null);
  const [erroJustificativas, setErroJustificativas] = useState(false);

  const carregarJustificativas = useCallback(async () => {
    setErroJustificativas(false);
    try {
      setJustificativas(await carregarJustificativasGestao());
    } catch {
      setJustificativas([]);
      setErroJustificativas(true);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    void carregarJustificativasGestao()
      .then((lista) => {
        if (!ativo) return;
        setJustificativas(lista);
        setErroJustificativas(false);
      })
      .catch(() => {
        if (!ativo) return;
        setJustificativas([]);
        setErroJustificativas(true);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const pendentes = useMemo(
    () => justificativas?.filter((item) => item.status === "pendente").length ?? 0,
    [justificativas],
  );

  function atualizarJustificativa(item: JustificativaAusenciaDoc) {
    setJustificativas((atuais) =>
      (atuais ?? []).map((atual) => (atual.id === item.id ? item : atual)),
    );
  }

  if (!temPermissao(usuario, "registrar")) {
    return <NotAuthorized />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-text">
          Lançar pontos
        </h1>
        <p className="text-sm text-text-light">
          Registre pontuação por treino, evento ou lançamento avulso.
        </p>
      </div>

      <SubTabs
        label="Seções de pontuação"
        value={tab}
        onChange={setTab}
        options={[
          { value: "lancar", label: "Lançar pontos" },
          { value: "historico", label: "Histórico mensal" },
          {
            value: "justificativas",
            label: pendentes > 0 ? `Justificativas (${pendentes})` : "Justificativas",
          },
          { value: "extrato", label: "Extrato" },
          { value: "consolidado", label: "Visão consolidada" },
        ]}
      />

      <TabPanel key={tab}>
        {tab === "lancar" ? (
          <LancarPontosTab
            justificativas={justificativas ?? []}
            erroJustificativas={erroJustificativas}
          />
        ) : tab === "historico" ? (
          <HistoricoMensalTab />
        ) : tab === "justificativas" ? (
          <JustificativasTab
            items={justificativas}
            erro={erroJustificativas}
            onRetry={() => void carregarJustificativas()}
            onUpdate={atualizarJustificativa}
          />
        ) : tab === "extrato" ? (
          <ExtratoTab />
        ) : (
          <ConsolidadoTab />
        )}
      </TabPanel>
    </div>
  );
}
