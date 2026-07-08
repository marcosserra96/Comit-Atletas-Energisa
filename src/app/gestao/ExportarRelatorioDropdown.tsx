"use client";

import { useEffect, useRef, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { doc, getDoc } from "firebase/firestore";
import { ChevronDown, Download, FileText, Presentation, Trophy } from "lucide-react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { getStoredBranding } from "@/lib/branding";
import { formatBRL } from "@/lib/format";
import { agruparUltimosLancamentos, type EstatisticasDashboard } from "@/lib/dashboardStats";
import { calcularResumoRankingMensal, diasUteisNoMes } from "@/lib/rankingMensal";
import { normalizarInformativoConfig } from "@/lib/informativoConfig";
import { ReportExecutivoDocument } from "@/lib/pdf/ReportExecutivoDocument";
import { InformativoRankingDocument } from "@/lib/pdf/InformativoRankingDocument";
import type { AtletaDoc, EventoDoc, HistoricoPontoDoc, InformativoConfigDoc } from "@/lib/types";

export function ExportarRelatorioDropdown({
  stats,
  eventos,
  lancamentos,
  atletas,
}: {
  stats: EstatisticasDashboard;
  eventos: EventoDoc[];
  lancamentos: HistoricoPontoDoc[];
  atletas: AtletaDoc[];
}) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [gerando, setGerando] = useState<"pdf" | "informativo" | null>(null);
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
    setGerando("pdf");
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
      setGerando(null);
    }
  }

  async function handleExportarInformativo() {
    setOpen(false);
    setGerando("informativo");
    try {
      const snap = await getDoc(doc(db, "configuracoes", "informativo"));
      const config: InformativoConfigDoc = normalizarInformativoConfig(
        snap.exists() ? (snap.data() as Partial<InformativoConfigDoc>) : undefined,
      );
      const branding = getStoredBranding();
      const logo = `${window.location.origin}/logos/logo-comite-colorida.png`;

      const hoje = new Date();
      const ano = hoje.getFullYear();
      const mes = hoje.getMonth() + 1;
      const mesLabel = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

      const resumo = calcularResumoRankingMensal({ atletas, lancamentos, ano, mes });
      const bike = resumo.filter((a) => a.equipe === "bicicleta");
      const corrida = resumo.filter((a) => a.equipe === "corrida");

      const documento = (
        <InformativoRankingDocument
          bike={bike}
          corrida={corrida}
          mesLabel={mesLabel.replace(/^./, (c) => c.toUpperCase())}
          diasUteis={diasUteisNoMes(ano, mes)}
          modalidadeFiltro={config.modalidade}
          paginasSeparadas={config.paginasSeparadas}
          opcoes={config}
          branding={branding}
          logo={logo}
        />
      );
      const blob = await pdf(documento).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dataHoje = new Date().toISOString().slice(0, 10);
      a.download = `informativo-ranking-atletas-${dataHoje}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      show("success", "Informativo do ranking gerado com sucesso.");
    } catch {
      show("error", "Não foi possível gerar o informativo agora. Tente novamente.");
    } finally {
      setGerando(null);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)} loading={gerando !== null}>
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
            onClick={handleExportarInformativo}
            className="flex w-full items-center gap-2.5 rounded-[calc(var(--radius)-2px)] px-2.5 py-2.5 text-left text-sm font-medium text-text hover:bg-bg"
          >
            <Trophy className="size-4 text-primary" />
            Informativo do ranking
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              window.open("/apresentacao", "_blank");
            }}
            className="flex w-full items-center gap-2.5 rounded-[calc(var(--radius)-2px)] px-2.5 py-2.5 text-left text-sm font-medium text-text hover:bg-bg"
          >
            <Presentation className="size-4 text-primary" />
            Apresentação
          </button>
        </div>
      )}
    </div>
  );
}
