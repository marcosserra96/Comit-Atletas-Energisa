"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { Activity, TrendingUp } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatShortDate } from "@/lib/format";
import type { HistoricoPontoDoc } from "@/lib/types";

const tipoLabel: Record<string, string> = {
  treino: "Treino",
  evento: "Evento",
  avulso: "Avulso",
  importacao: "Importação",
};

export default function DesempenhoPage() {
  const { atleta } = useActiveSession();
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);

  useEffect(() => {
    let active = true;
    getDocs(
      query(
        collection(db, "historico_pontos"),
        where("atletaId", "==", atleta.id),
        orderBy("criadoEm", "desc"),
      ),
    )
      .then((snap) => {
        if (active) {
          setLancamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc));
        }
      })
      .catch(() => active && setLancamentos([]));
    return () => {
      active = false;
    };
  }, [atleta.id]);

  const validos = lancamentos?.filter((l) => !l.estornado) ?? [];
  const totalPontos = validos.reduce((sum, l) => sum + l.pontos, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Desempenho</h2>
        <p className="text-sm text-text-light">Sua evolução e histórico de pontuação.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <TrendingUp className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium text-text-light">Pontuação total</p>
            <p className="text-xl font-extrabold text-text">{totalPontos}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
            <Activity className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium text-text-light">Lançamentos válidos</p>
            <p className="text-xl font-extrabold text-text">{validos.length}</p>
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <h3 className="p-5 pb-0 text-sm font-bold text-text">Histórico completo</h3>
        {lancamentos === null ? (
          <div className="m-5 h-40 animate-pulse rounded-[var(--radius)] bg-bg" />
        ) : lancamentos.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Activity}
              title="Nenhum lançamento ainda"
              description="Assim que o comitê lançar pontos, seu histórico aparece aqui."
            />
          </div>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                <th className="px-5 py-3 font-semibold">Regra</th>
                <th className="px-3 py-3 font-semibold">Tipo</th>
                <th className="px-3 py-3 font-semibold">Data</th>
                <th className="px-5 py-3 text-right font-semibold">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium text-text">{l.regraDesc}</td>
                  <td className="px-3 py-3">
                    <Badge tone="neutral">{tipoLabel[l.tipoLancamento]}</Badge>
                  </td>
                  <td className="px-3 py-3 text-text-light">{formatShortDate(l.dataTreino)}</td>
                  <td className="px-5 py-3 text-right font-semibold">
                    {l.estornado ? (
                      <span className="text-text-muted line-through">+{l.pontos}</span>
                    ) : (
                      <span className="text-success">+{l.pontos}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
