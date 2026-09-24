"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { TabPanel } from "@/components/ui/TabPanel";
import { temPermissao } from "@/lib/permissoes";
import { LancarPontosTab } from "./LancarPontosTab";
import { ExtratoTab } from "./ExtratoTab";
import { ConsolidadoTab } from "./ConsolidadoTab";
import { JustificativasTab } from "./JustificativasTab";
import { carregarJustificativasGestao } from "@/lib/justificativasAusenciaClient";
import type { JustificativaAusenciaDoc } from "@/lib/types";

type Tab = "lancar" | "justificativas" | "extrato" | "consolidado";

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
        <h2 className="text-2xl font-extrabold text-text">
          Lançamento de pontos
        </h2>
        <p className="text-sm text-text-light">
          Registre pontuação por treino, evento ou lançamento avulso.
        </p>
      </div>

      <div className="max-w-full overflow-x-auto pb-1">
        <div className="flex w-max gap-1 rounded-[var(--radius)] border border-border bg-bg-card p-1">
          {(
            [
              { value: "lancar", label: "Lançar pontos" },
              {
                value: "justificativas",
                label: pendentes > 0 ? `Justificativas (${pendentes})` : "Justificativas",
              },
              { value: "extrato", label: "Extrato" },
              { value: "consolidado", label: "Visão Consolidada" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTab(opt.value)}
              className={cn(
                "min-h-11 cursor-pointer rounded-[calc(var(--radius)-2px)] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                tab === opt.value
                  ? "bg-primary text-white"
                  : "text-text-light hover:bg-bg hover:text-text",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <TabPanel key={tab}>
        {tab === "lancar" ? (
          <LancarPontosTab
            justificativas={justificativas ?? []}
            erroJustificativas={erroJustificativas}
          />
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
