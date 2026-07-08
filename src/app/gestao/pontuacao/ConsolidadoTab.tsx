"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { CalendarRange, FileSpreadsheet } from "lucide-react";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { equipeLabel } from "@/lib/labels";
import { exportToExcel } from "@/lib/excel";
import { cn } from "@/lib/cn";
import type { AtletaDoc, HistoricoPontoDoc } from "@/lib/types";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const TODOS_MESES = new Set(Array.from({ length: 12 }, (_, i) => i + 1));

type EquipeFiltro = "" | "corrida" | "bicicleta";

export function ConsolidadoTab() {
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [historico, setHistorico] = useState<HistoricoPontoDoc[] | null>(null);
  const [ano, setAno] = useState(() => String(new Date().getFullYear()));
  const [equipeFiltro, setEquipeFiltro] = useState<EquipeFiltro>("");
  const [mesesSelecionados, setMesesSelecionados] = useState<Set<number>>(() => new Set(TODOS_MESES));

  useEffect(() => {
    Promise.all([getDocs(collection(db, "atletas")), getDocs(collection(db, "historico_pontos"))]).then(
      ([atletasSnap, historicoSnap]) => {
        setAtletas(atletasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc));
        setHistorico(historicoSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc));
      },
    );
  }, []);

  function toggleMes(m: number) {
    setMesesSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  function toggleTodosMeses() {
    setMesesSelecionados((prev) => (prev.size === 12 ? new Set() : new Set(TODOS_MESES)));
  }

  const meses = useMemo(() => [...mesesSelecionados].sort((a, b) => a - b), [mesesSelecionados]);

  const linhas = useMemo(() => {
    if (!atletas || !historico) return [];
    const elegiveis = atletas.filter(
      (a) =>
        a.role === "atleta" &&
        a.equipe !== "fila_corrida" &&
        a.equipe !== "fila_bicicleta" &&
        a.equipe !== "nenhuma" &&
        (!equipeFiltro || a.equipe === equipeFiltro),
    );
    const historicoAno = historico.filter((h) => !h.estornado && h.dataTreino.startsWith(ano));

    return elegiveis
      .map((atleta) => {
        const porMes: Record<number, number> = {};
        let total = 0;
        historicoAno
          .filter((h) => h.atletaId === atleta.id)
          .forEach((h) => {
            const mes = Number(h.dataTreino.split("-")[1]);
            if (!meses.includes(mes)) return;
            porMes[mes] = (porMes[mes] ?? 0) + h.pontos;
            total += h.pontos;
          });
        return { atleta, porMes, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [atletas, historico, ano, equipeFiltro, meses]);

  function handleExportar() {
    exportToExcel(
      `relatorio-consolidado-${ano}.xlsx`,
      "Consolidado",
      linhas.map(({ atleta, porMes, total }) => ({
        Atleta: atleta.nome,
        Equipe: equipeLabel[atleta.equipe],
        ...Object.fromEntries(meses.map((m) => [MESES[m - 1], porMes[m] ?? 0])),
        Total: total,
      })),
    );
  }

  const carregando = atletas === null || historico === null;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-light">Ano base</label>
              <input
                type="number"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                className="h-10 w-28 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-light">Equipe</label>
              <Select
                className="w-44"
                value={equipeFiltro}
                onChange={(e) => setEquipeFiltro(e.target.value as EquipeFiltro)}
              >
                <option value="">Todas</option>
                <option value="corrida">Corrida</option>
                <option value="bicicleta">Bicicleta</option>
              </Select>
            </div>
          </div>
          <Button variant="secondary" onClick={handleExportar} disabled={linhas.length === 0}>
            <FileSpreadsheet className="size-4" />
            Exportar Excel
          </Button>
        </div>

        <div className="border-t border-border pt-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-light">
            <CalendarRange className="size-3.5" />
            Período de avaliação
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={toggleTodosMeses}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                mesesSelecionados.size === 12
                  ? "border-primary bg-primary text-white"
                  : "border-border text-text-light hover:text-text",
              )}
            >
              Todos
            </button>
            {MESES.map((label, i) => {
              const m = i + 1;
              const ativo = mesesSelecionados.has(m);
              return (
                <button
                  key={m}
                  onClick={() => toggleMes(m)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    ativo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-light hover:text-text",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {carregando ? (
        <Card className="h-64 animate-pulse" />
      ) : meses.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title="Selecione ao menos um mês"
            description="Escolha os meses do período que deseja avaliar."
          />
        </Card>
      ) : linhas.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title="Nenhum atleta encontrado"
            description="Ajuste os filtros para ver o relatório consolidado."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                <th className="px-4 py-3 font-semibold">Atleta</th>
                <th className="px-3 py-3 font-semibold">Equipe</th>
                {meses.map((m) => (
                  <th key={m} className="px-3 py-3 text-center font-semibold">
                    {MESES[m - 1]}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold">Total ({meses.length}m)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ atleta, porMes, total }) => (
                <tr key={atleta.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-text">{atleta.nome}</td>
                  <td className="px-3 py-3 text-text-light">{equipeLabel[atleta.equipe]}</td>
                  {meses.map((m) => (
                    <td
                      key={m}
                      className={cn(
                        "px-3 py-3 text-center font-semibold",
                        (porMes[m] ?? 0) > 0 ? "text-secondary" : "text-text-muted",
                      )}
                    >
                      {porMes[m] ?? 0}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold text-primary">{total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
