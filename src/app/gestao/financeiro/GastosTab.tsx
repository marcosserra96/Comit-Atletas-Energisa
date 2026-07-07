"use client";

import { Fragment, useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { ChevronDown, FileSpreadsheet, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatBRL } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { cn } from "@/lib/cn";
import { NovaDespesaModal } from "./NovaDespesaModal";
import type { DespesaDoc } from "@/lib/types";

const TIPOS_CUSTO = [
  { propKey: "propInsc", realKey: "realInsc", label: "Inscrição" },
  { propKey: "propTransp", realKey: "realTransp", label: "Transporte" },
  { propKey: "propHosp", realKey: "realHosp", label: "Hospedagem" },
  { propKey: "propAlim", realKey: "realAlim", label: "Alimentação" },
  { propKey: "propDemais", realKey: "realDemais", label: "Outros" },
] as const;

export function GastosTab() {
  const { show } = useToast();
  const [despesas, setDespesas] = useState<DespesaDoc[] | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const [editando, setEditando] = useState<DespesaDoc | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "despesas"), orderBy("criadoEm", "desc")),
      (snap) => {
        setDespesas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DespesaDoc));
      },
      () => setDespesas([]),
    );
    return unsubscribe;
  }, []);

  async function handleExcluir(d: DespesaDoc) {
    try {
      await deleteDoc(doc(db, "despesas", d.id));
      show("success", "Despesa removida.");
    } catch {
      show("error", "Não foi possível remover agora. Tente novamente.");
    }
  }

  function handleExportar() {
    exportToExcel(
      "gastos.xlsx",
      "Gastos",
      (despesas ?? []).map((d) => ({
        Categoria: d.categoria,
        Evento: d.evento,
        Equipe: d.equipe,
        Avulso: d.avulso ? "Sim" : "Não",
        "Inscrição (orçado)": d.propInsc ?? 0,
        "Inscrição (realizado)": d.realInsc ?? 0,
        "Transporte (orçado)": d.propTransp ?? 0,
        "Transporte (realizado)": d.realTransp ?? 0,
        "Hospedagem (orçado)": d.propHosp ?? 0,
        "Hospedagem (realizado)": d.realHosp ?? 0,
        "Alimentação (orçado)": d.propAlim ?? 0,
        "Alimentação (realizado)": d.realAlim ?? 0,
        "Outros (orçado)": d.propDemais ?? 0,
        "Outros (realizado)": d.realDemais ?? 0,
        Orçado: d.totalProposto,
        Realizado: d.totalRealizado,
        Desvio: d.totalProposto - d.totalRealizado,
        Observações: d.observacoes ?? "",
      })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleExportar} disabled={!despesas || despesas.length === 0}>
          <FileSpreadsheet className="size-4" />
          Exportar Excel
        </Button>
        <Button onClick={() => setNovaOpen(true)}>
          <Plus className="size-4" />
          Nova despesa
        </Button>
      </div>

      {despesas === null ? (
        <Card className="h-40 animate-pulse" />
      ) : despesas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="Nenhuma despesa registrada"
            description="Registre a primeira despesa para acompanhar o orçamento do programa."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                <th className="px-4 py-3 font-semibold">Equipe</th>
                <th className="px-3 py-3 font-semibold">Categoria</th>
                <th className="px-3 py-3 font-semibold">Evento / Custo</th>
                <th className="px-3 py-3 text-right font-semibold">Orçado</th>
                <th className="px-3 py-3 text-right font-semibold text-secondary">Realizado</th>
                <th className="px-3 py-3 text-right font-semibold">Desvio</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {despesas.map((d) => {
                const aberto = expandido === d.id;
                return (
                  <Fragment key={d.id}>
                    <tr className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Badge tone="neutral">{d.equipe}</Badge>
                      </td>
                      <td className="px-3 py-3 text-text-light">{d.categoria}</td>
                      <td className="px-3 py-3 font-medium text-text">
                        {d.evento}
                        {d.avulso && (
                          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                            [avulso]
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-text">{formatBRL(d.totalProposto)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-secondary">
                        {formatBRL(d.totalRealizado)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-semibold ${
                          d.totalProposto - d.totalRealizado < 0 ? "text-danger" : "text-success"
                        }`}
                      >
                        {formatBRL(d.totalProposto - d.totalRealizado)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setExpandido(aberto ? null : d.id)}
                            aria-label="Ver detalhes"
                            className="flex items-center gap-1 rounded-[var(--radius)] px-2 py-1.5 text-xs font-semibold text-text-light hover:bg-bg hover:text-primary"
                          >
                            Detalhes
                            <ChevronDown className={cn("size-3.5 transition-transform", aberto && "rotate-180")} />
                          </button>
                          <button
                            onClick={() => setEditando(d)}
                            aria-label="Editar"
                            className="rounded-[var(--radius)] p-1.5 text-text-muted hover:bg-bg hover:text-primary"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => handleExcluir(d)}
                            aria-label="Excluir"
                            className="rounded-[var(--radius)] p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {aberto && (
                      <tr key={`${d.id}-detalhes`} className="border-b border-border bg-bg last:border-0">
                        <td colSpan={7} className="px-4 py-3">
                          <table className="w-full min-w-[420px] text-xs">
                            <thead>
                              <tr className="text-left uppercase text-text-muted">
                                <th className="py-1.5 font-semibold">Tipo de custo</th>
                                <th className="py-1.5 text-right font-semibold">Orçado</th>
                                <th className="py-1.5 text-right font-semibold text-secondary">Realizado</th>
                                <th className="py-1.5 text-right font-semibold">Desvio</th>
                              </tr>
                            </thead>
                            <tbody>
                              {TIPOS_CUSTO.map((t) => {
                                const prop = d[t.propKey] ?? 0;
                                const real = d[t.realKey] ?? 0;
                                if (!prop && !real) return null;
                                return (
                                  <tr key={t.label} className="border-t border-border">
                                    <td className="py-1.5 text-text">{t.label}</td>
                                    <td className="py-1.5 text-right text-text-light">{formatBRL(prop)}</td>
                                    <td className="py-1.5 text-right text-text-light">{formatBRL(real)}</td>
                                    <td
                                      className={`py-1.5 text-right font-semibold ${
                                        prop - real < 0 ? "text-danger" : "text-text"
                                      }`}
                                    >
                                      {formatBRL(prop - real)}
                                    </td>
                                  </tr>
                                );
                              })}
                              {TIPOS_CUSTO.every((t) => !d[t.propKey] && !d[t.realKey]) && (
                                <tr>
                                  <td colSpan={4} className="py-2 text-center text-text-muted">
                                    Sem detalhamento por tipo de custo.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          {d.observacoes && (
                            <div className="mt-3 rounded-[var(--radius)] border border-border bg-bg-card p-3">
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                                Observações
                              </p>
                              <p className="whitespace-pre-wrap text-sm text-text-light">{d.observacoes}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <NovaDespesaModal open={novaOpen} onClose={() => setNovaOpen(false)} />
      <NovaDespesaModal
        key={editando?.id ?? "none"}
        open={!!editando}
        onClose={() => setEditando(null)}
        despesa={editando}
      />
    </div>
  );
}
