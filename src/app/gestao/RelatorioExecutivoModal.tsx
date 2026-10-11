"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { FileText } from "lucide-react";
import { db } from "@/lib/firebase";
import { dataIsoLocal } from "@/lib/date";
import { getStoredBranding } from "@/lib/branding";
import { useRegrasDeTreino } from "@/lib/useRegrasDeTreino";
import { normalizarCalendario, type CalendarioPremiacaoDoc } from "@/lib/calendarioPremiacao";
import { montarRelatorio, periodosDoRelatorio, type OpcaoPeriodo } from "@/lib/relatorioExecutivo";
import { cn } from "@/lib/cn";
import type { AtletaDoc, DespesaDoc, EventoDoc, HistoricoMensalDoc, HistoricoPontoDoc } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const curta = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;

const DESCRICAO: Record<OpcaoPeriodo, string> = {
  trimestre_atual: "Trimestre da premiação em andamento",
  trimestre_anterior: "Último trimestre encerrado",
  mes_atual: "Mês em andamento",
  mes_anterior: "Mês passado completo",
  ano: "Do início do ano até hoje",
};

/** Escolhe o período e gera o PDF do relatório executivo. */
export function RelatorioExecutivoModal({
  aberto,
  onFechar,
  atletas,
  lancamentos,
  resumosMensais,
  eventos,
  despesas,
}: {
  aberto: boolean;
  onFechar: () => void;
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
  resumosMensais: HistoricoMensalDoc[];
  eventos: EventoDoc[];
  despesas: DespesaDoc[] | null;
}) {
  const { show } = useToast();
  const regrasTreino = useRegrasDeTreino();
  const [calendario, setCalendario] = useState<CalendarioPremiacaoDoc | null>(null);
  const [escolhido, setEscolhido] = useState<OpcaoPeriodo | null>(null);
  const [gerando, setGerando] = useState(false);
  const hoje = dataIsoLocal();

  useEffect(() => {
    if (!aberto || calendario) return;
    getDoc(doc(db, "configuracoes", "calendario_premiacao")).then(
      (snap) => setCalendario(normalizarCalendario(snap.data() as Partial<CalendarioPremiacaoDoc> | undefined)),
      () => setCalendario(normalizarCalendario(undefined)),
    );
  }, [aberto, calendario]);

  const periodos = useMemo(() => (calendario ? periodosDoRelatorio(calendario.trimestres, hoje) : []), [calendario, hoje]);
  // Padrão: o último trimestre fechado (é o que se apresenta), senão o mês passado.
  const selecionado =
    periodos.find((p) => p.id === escolhido) ??
    periodos.find((p) => p.id === "trimestre_anterior") ??
    periodos.find((p) => p.id === "mes_anterior") ??
    periodos[0];

  async function gerar() {
    if (!selecionado) return;
    setGerando(true);
    try {
      const [{ pdf }, { RelatorioExecutivoDocument, registrarFontesRelatorio }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/RelatorioExecutivoDocument"),
      ]);
      registrarFontesRelatorio(window.location.origin);
      const dados = montarRelatorio({
        periodo: selecionado,
        atletas,
        lancamentos,
        resumosMensais,
        regrasTreino: regrasTreino ?? undefined,
        eventos,
        despesas,
        hoje,
      });
      const b = getStoredBranding();
      const blob = await pdf(
        <RelatorioExecutivoDocument
          dados={dados}
          logo={`${window.location.origin}/logos/logo-comite-branca-trim.png`}
          cores={{ primary: b.primary, secondary: b.secondary, accent: b.accent }}
          geradoEm={new Date().toLocaleDateString("pt-BR")}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-executivo-${selecionado.nome.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/(^-|-$)/g, "")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      show("success", "Relatório baixado.");
      onFechar();
    } catch {
      show("error", "Não foi possível gerar o relatório agora. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      mobileSheet
      size="md"
      title="Relatório executivo"
      description="Duas páginas em PDF com os números do período, a comparação com o período anterior e os pontos de atenção."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onFechar} disabled={gerando}>
            Cancelar
          </Button>
          <Button onClick={() => void gerar()} loading={gerando} disabled={!selecionado || !regrasTreino}>
            <FileText className="size-4" aria-hidden="true" />
            Gerar PDF
          </Button>
        </div>
      }
    >
      {calendario === null ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
          ))}
        </div>
      ) : (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text">Período</legend>
          <div className="flex flex-col gap-2" role="radiogroup">
            {periodos.map((p) => {
              const ativo = selecionado?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setEscolhido(p.id)}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-[var(--radius)] border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    ativo ? "border-primary bg-primary-subtle" : "border-border hover:border-border-strong",
                  )}
                >
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", ativo ? "border-primary" : "border-border-strong")} aria-hidden="true">
                    {ativo ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text">{p.nome}</span>
                    <span className="block text-xs text-text-light">
                      {DESCRICAO[p.id]} · {curta(p.inicio)} a {curta(p.parcial ? p.ate : p.fim)}
                      {p.parcial ? " (até hoje)" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </Modal>
  );
}
