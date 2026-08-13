"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { Activity, Map, Trophy, CalendarDays } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";
import { formatDataTreino } from "@/lib/format";
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
  
  // Try to compute total km if possible (assuming `distanciaKm` or similar might be present, defaulting to 0)
  const totalKm = validos.reduce((sum, l) => sum + (Number((l as any).distanciaKm) || 0), 0);
  
  // Best month placeholder
  const bestMonth = "-";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        icon={Activity} 
        title="Desempenho" 
        description="Sua evolução e histórico de pontuação." 
      />

      {lancamentos === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Pontuação Total" value={totalPontos} icon={Trophy} />
          <MetricCard label="Quilômetros" value={`${totalKm} km`} icon={Map} />
          <MetricCard label="Participações" value={validos.length} icon={Activity} />
          <MetricCard label="Melhor Mês" value={bestMonth} icon={CalendarDays} />
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <h3 className="p-5 pb-0 text-lg font-bold text-text">Histórico completo</h3>
        
        {lancamentos === null ? (
          <div className="p-5">
            <SkeletonLine className="h-10 w-full mb-2" />
            <SkeletonLine className="h-10 w-full mb-2" />
            <SkeletonLine className="h-10 w-full" />
          </div>
        ) : lancamentos.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Activity}
              title="Nenhum lançamento ainda"
              description="Assim que o comitê lançar pontos, seu histórico aparece aqui."
            />
          </div>
        ) : (
          <div className="mt-3">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-inset text-left text-xs uppercase text-text-muted">
                    <th className="px-5 py-3 font-semibold">Regra</th>
                    <th className="px-3 py-3 font-semibold">Tipo</th>
                    <th className="px-3 py-3 font-semibold">Data</th>
                    <th className="px-5 py-3 text-right font-semibold">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l) => (
                    <tr 
                      key={l.id} 
                      className={`border-b border-border last:border-0 even:bg-bg-inset/50 hover:bg-bg-inset transition-colors ${
                        l.estornado ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-5 py-4 font-medium text-text flex items-center gap-2">
                        <span className={l.estornado ? "line-through text-text-muted" : ""}>{l.regraDesc}</span>
                        {l.estornado && <Badge tone="danger">Estornado</Badge>}
                      </td>
                      <td className="px-3 py-4">
                        <Badge tone="neutral">{tipoLabel[l.tipoLancamento]}</Badge>
                      </td>
                      <td className="px-3 py-4 text-text-light">{formatDataTreino(l.dataTreino, l.dataAproximada)}</td>
                      <td className="px-5 py-4 text-right font-semibold">
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
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden flex flex-col p-4 gap-4">
              {lancamentos.map((l) => (
                <div 
                  key={l.id} 
                  className={`flex flex-col gap-2 rounded-lg border border-border bg-bg p-4 ${
                    l.estornado ? "opacity-75 bg-bg-inset" : ""
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`font-semibold text-text ${l.estornado ? "line-through text-text-muted" : ""}`}>
                      {l.regraDesc}
                    </span>
                    <div className="flex items-center">
                      {l.estornado ? (
                        <span className="text-text-muted line-through font-bold">+{l.pontos} pt</span>
                      ) : (
                        <span className="text-success font-bold">+{l.pontos} pt</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge tone="neutral">{tipoLabel[l.tipoLancamento]}</Badge>
                    {l.estornado && <Badge tone="danger">Estornado</Badge>}
                    <span className="text-xs text-text-light ml-auto">
                      {formatDataTreino(l.dataTreino, l.dataAproximada)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
