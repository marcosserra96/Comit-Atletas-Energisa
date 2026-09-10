"use client";

import { useMemo, useState } from "react";
import { Bike, Check, Footprints, ImageDown, Printer, Search, UsersRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { calcularResumoRankingPeriodo } from "@/lib/rankingMensal";
import type { AtletaDoc, HistoricoPontoDoc, Modalidade } from "@/lib/types";
import { labelPeriodo, mesReferenciaPadrao, type PeriodoInformativo } from "./GerarInformativoModal";
import { InformativoHtml, type FormatoInformativo } from "./InformativoHtml";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function competencia(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function NovoInformativoModal({
  open,
  onClose,
  atletas,
  lancamentos,
}: {
  open: boolean;
  onClose: () => void;
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
}) {
  const referencia = mesReferenciaPadrao();
  const [modalidade, setModalidade] = useState<Modalidade>("corrida");
  const [formato, setFormato] = useState<FormatoInformativo>("horizontal");
  const [modoPeriodo, setModoPeriodo] = useState<"mes" | "periodo">("mes");
  const [ano, setAno] = useState(referencia.ano);
  const [mes, setMes] = useState(referencia.mes);
  const [anoFim, setAnoFim] = useState(referencia.ano);
  const [mesFim, setMesFim] = useState(referencia.mes);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string> | null>(null);

  const atletasDaModalidade = useMemo(
    () =>
      atletas
        .filter((a) => a.ativo && a.equipe === modalidade)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [atletas, modalidade],
  );

  const idsSelecionados = useMemo(
    () => selecionados ?? new Set(atletasDaModalidade.map((a) => a.id)),
    [selecionados, atletasDaModalidade],
  );

  const periodo: PeriodoInformativo = useMemo(() => {
    const inicio = competencia(ano, mes);
    if (modoPeriodo === "mes") return { de: inicio, ate: inicio };
    const fim = competencia(anoFim, mesFim);
    return inicio <= fim ? { de: inicio, ate: fim } : { de: fim, ate: inicio };
  }, [ano, mes, anoFim, mesFim, modoPeriodo]);

  const atletasFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return atletasDaModalidade;
    return atletasDaModalidade.filter((a) => a.nome.toLocaleLowerCase("pt-BR").includes(termo));
  }, [atletasDaModalidade, busca]);

  const atletasConsiderados = useMemo(
    () => atletasDaModalidade.filter((a) => idsSelecionados.has(a.id)),
    [atletasDaModalidade, idsSelecionados],
  );

  const ranking = useMemo(
    () =>
      calcularResumoRankingPeriodo({
        atletas: atletasConsiderados,
        lancamentos,
        de: periodo.de,
        ate: periodo.ate,
      }),
    [atletasConsiderados, lancamentos, periodo],
  );

  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 7 }, (_, i) => anoAtual - 5 + i);
  const escala = formato === "horizontal" ? 0.66 : 0.78;
  const alturaPreviewOriginal = formato === "horizontal" ? 675 : Math.max(996, 820 + ranking.length * 38);

  function trocarModalidade(novaModalidade: Modalidade) {
    setModalidade(novaModalidade);
    setSelecionados(null);
    setBusca("");
  }

  function alternarAtleta(id: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual ?? atletasDaModalidade.map((a) => a.id));
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  function imprimir() {
    window.print();
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xl"
        title="Novo informativo do ranking"
        description="Escolha período, time, atletas e formato. O ranking é recalculado somente com os atletas selecionados."
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 rounded-2xl border border-border bg-bg p-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-light">Time</label>
              <SegmentedControl
                value={modalidade}
                onChange={trocarModalidade}
                options={[
                  { value: "corrida", label: "Corrida" },
                  { value: "bicicleta", label: "Bicicleta" },
                ]}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-text-light">Formato</label>
              <SegmentedControl
                value={formato}
                onChange={setFormato}
                options={[
                  { value: "horizontal", label: "Horizontal 16:9" },
                  { value: "vertical", label: "Vertical" },
                ]}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-text">Período</h3>
                <p className="text-xs text-text-light">Mês único ou acumulado entre duas competências.</p>
              </div>
              <SegmentedControl
                value={modoPeriodo}
                onChange={setModoPeriodo}
                options={[
                  { value: "mes", label: "Um mês" },
                  { value: "periodo", label: "Acumulado" },
                ]}
              />
            </div>
            <div className={`grid gap-3 ${modoPeriodo === "periodo" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
              <Select value={String(mes)} onChange={(e) => setMes(Number(e.target.value))}>
                {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
              </Select>
              <Select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))}>
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
              {modoPeriodo === "periodo" && (
                <>
                  <Select value={String(mesFim)} onChange={(e) => setMesFim(Number(e.target.value))}>
                    {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
                  </Select>
                  <Select value={String(anoFim)} onChange={(e) => setAnoFim(Number(e.target.value))}>
                    {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                  </Select>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-text">
                  <UsersRound className="size-4 text-primary" /> Atletas considerados
                </h3>
                <p className="text-xs text-text-light">Todos vêm marcados por padrão. Desmarque quem não deve entrar neste informativo.</p>
              </div>
              <div className="flex gap-2 text-xs">
                <button className="font-bold text-primary hover:underline" onClick={() => setSelecionados(new Set(atletasDaModalidade.map((a) => a.id)))}>Selecionar todos</button>
                <span className="text-border">·</span>
                <button className="font-bold text-text-light hover:text-text" onClick={() => setSelecionados(new Set())}>Limpar</button>
              </div>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar atleta..."
                className="h-10 w-full rounded-xl border border-border bg-bg-card pl-9 pr-3 text-sm text-text outline-none focus:border-primary"
              />
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-bg-card p-2">
              <div className="grid gap-1 sm:grid-cols-2">
                {atletasFiltrados.map((a) => {
                  const marcado = idsSelecionados.has(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => alternarAtleta(a.id)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-bg"
                    >
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${marcado ? "border-primary bg-primary text-white" : "border-border bg-white"}`}>
                        {marcado && <Check className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{a.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-text-light">
              <span>{idsSelecionados.size} de {atletasDaModalidade.length} selecionados</span>
              <span>{modalidade === "corrida" ? <Footprints className="inline size-3.5" /> : <Bike className="inline size-3.5" />} {modalidade === "corrida" ? "Corrida" : "Bicicleta"}</span>
            </div>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-text">Prévia da peça</h3>
                <p className="text-xs text-text-light">A saída final não contém menus, abas nem controles de navegação.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={imprimir} disabled={!ranking.length}>
                  <Printer className="size-4" /> Imprimir / PDF
                </Button>
                <Button variant="secondary" disabled title="A exportação PNG será ativada após validarmos o novo layout.">
                  <ImageDown className="size-4" /> PNG em breve
                </Button>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-2xl border border-border bg-[#EAF3F5] p-4"
              style={{ height: Math.min(650, alturaPreviewOriginal * escala + 32) }}
            >
              {ranking.length ? (
                <div
                  id="novo-informativo-scale"
                  style={{ transform: `scale(${escala})`, transformOrigin: "top left", width: formato === "horizontal" ? 1200 : 560 }}
                >
                  <InformativoHtml
                    dados={ranking}
                    periodoLabel={labelPeriodo(periodo)}
                    modalidade={modalidade}
                    formato={formato}
                  />
                </div>
              ) : (
                <div className="flex h-52 items-center justify-center text-center text-sm text-text-light">
                  Selecione ao menos um atleta para gerar a prévia.
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <style jsx global>{`
        @page { size: ${formato === "horizontal" ? "landscape" : "portrait"}; margin: 0; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden !important; }
          #novo-informativo-scale { transform: none !important; width: max-content !important; }
          #novo-informativo-preview, #novo-informativo-preview * { visibility: visible !important; }
          #novo-informativo-preview {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
}
