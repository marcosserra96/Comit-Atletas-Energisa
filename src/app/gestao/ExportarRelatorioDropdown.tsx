"use client";

import { useEffect, useRef, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { ChevronDown, Download, FileText, Presentation, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { getStoredBranding } from "@/lib/branding";
import { formatBRL } from "@/lib/format";
import { agruparUltimosLancamentos, type EstatisticasDashboard } from "@/lib/dashboardStats";
import { ReportExecutivoDocument } from "@/lib/pdf/ReportExecutivoDocument";
import type { EventoDoc, HistoricoPontoDoc } from "@/lib/types";

export function ExportarRelatorioDropdown({
  stats,
  eventos,
  lancamentos,
}: {
  stats: EstatisticasDashboard;
  eventos: EventoDoc[];
  lancamentos: HistoricoPontoDoc[];
}) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [gerando, setGerando] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleExportarPdf() {
    setOpen(false);
    setGerando(true);
    try {
      const branding = getStoredBranding();
      const logo = `${window.location.origin}/logos/logo-comite-colorida.png`;
      const ultimosLancamentos = agruparUltimosLancamentos(lancamentos);
      const documento = (
        <ReportExecutivoDocument
          stats={stats}
          eventos={eventos}
          ultimosLancamentos={ultimosLancamentos}
          branding={branding}
          logo={logo}
          formatBRL={formatBRL}
        />
      );
      const blob = await pdf(documento).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dataHoje = new Date().toISOString().slice(0, 10);
      a.download = `report-executivo-atletas-${dataHoje}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      show("success", "Report executivo gerado com sucesso.");
    } catch {
      show("error", "Não foi possível gerar o report agora. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)} loading={gerando}>
        <Download className="size-4" />
        Exportar
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 overflow-hidden rounded-[var(--radius)] border border-border bg-bg-card p-1.5 shadow-lg"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Relatórios
          </p>
          <button
            role="menuitem"
            onClick={handleExportarPdf}
            className="flex w-full items-center gap-2.5 rounded-[calc(var(--radius)-2px)] px-2.5 py-2.5 text-left text-sm font-medium text-text hover:bg-bg"
          >
            <FileText className="size-4 text-primary" />
            Report executivo (PDF)
          </button>
          <button
            role="menuitem"
            disabled
            title="Em breve"
            className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-[calc(var(--radius)-2px)] px-2.5 py-2.5 text-left text-sm font-medium text-text-muted"
          >
            <Trophy className="size-4" />
            Informativo do ranking
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wide">em breve</span>
          </button>
          <button
            role="menuitem"
            disabled
            title="Em breve"
            className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-[calc(var(--radius)-2px)] px-2.5 py-2.5 text-left text-sm font-medium text-text-muted"
          >
            <Presentation className="size-4" />
            Apresentação
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wide">em breve</span>
          </button>
        </div>
      )}
    </div>
  );
}
