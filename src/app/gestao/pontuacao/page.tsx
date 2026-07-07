"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { temPermissao } from "@/lib/permissoes";
import { LancarPontosTab } from "./LancarPontosTab";
import { ExtratoTab } from "./ExtratoTab";

type Tab = "lancar" | "extrato";

export default function PontuacaoPage() {
  const { usuario } = useActiveSession();
  const [tab, setTab] = useState<Tab>("lancar");

  if (!temPermissao(usuario, "registrar")) {
    return <NotAuthorized />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Lançamento de pontos</h2>
        <p className="text-sm text-text-light">
          Registre pontuação por treino, evento ou lançamento avulso.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-[var(--radius)] bg-bg-card border border-border p-1">
        {(
          [
            { value: "lancar", label: "Lançar pontos" },
            { value: "extrato", label: "Extrato" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTab(opt.value)}
            className={cn(
              "rounded-[calc(var(--radius)-2px)] px-4 py-2 text-sm font-semibold transition-colors",
              tab === opt.value ? "bg-primary text-white" : "text-text-light hover:text-text",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {tab === "lancar" ? <LancarPontosTab /> : <ExtratoTab />}
    </div>
  );
}
