"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, Save, Move } from "lucide-react";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { logAudit } from "@/lib/audit";
import {
  CAMPOS_INFO,
  CAMPOS_ORDEM,
  INFORMATIVO_LAYOUT_PADRAO,
  carregarLayoutInformativo,
  salvarLayoutInformativo,
  type CampoId,
  type CampoLayout,
} from "@/lib/informativoLayout";

const PAGE_W = 1672;
const PAGE_H = 941;

/** Texto de exemplo mostrado em cada campo no editor, pra dar noção real de tamanho. */
const AMOSTRA: Record<CampoId, string> = {
  mesLabel: "Junho de 2026",
  kpi1: "519 pts",
  kpi2: "289",
  kpi3: "2.739,80 km",
  kpi4: "38",
  podio2Pts: "26 pts",
  podio2Treinos: "15 treinos",
  podio2Km: "131,60 km",
  podio1Pts: "26 pts",
  podio1Treinos: "15 treinos",
  podio1Km: "135,00 km",
  podio3Pts: "27 pts",
  podio3Treinos: "14 treinos",
  podio3Km: "128,20 km",
};

export function InformativoLayoutTab() {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [layout, setLayout] = useState<Record<CampoId, CampoLayout>>(INFORMATIVO_LAYOUT_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modalidade, setModalidade] = useState<"corrida" | "bicicleta">("corrida");
  const [selecionado, setSelecionado] = useState<CampoId | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ campo: CampoId; startClientX: number; startClientY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    carregarLayoutInformativo()
      .then(setLayout)
      .finally(() => setCarregando(false));
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    const container = containerRef.current;
    if (!d || !container) return;
    const rect = container.getBoundingClientRect();
    const scaleX = PAGE_W / rect.width;
    const scaleY = PAGE_H / rect.height;
    const dx = (e.clientX - d.startClientX) * scaleX;
    const dy = (e.clientY - d.startClientY) * scaleY;
    setLayout((prev) => ({
      ...prev,
      [d.campo]: { ...prev[d.campo], x: Math.round((d.origX + dx) * 10) / 10, y: Math.round((d.origY + dy) * 10) / 10 },
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  function handlePointerDown(e: React.PointerEvent, campo: CampoId) {
    e.preventDefault();
    setSelecionado(campo);
    dragRef.current = {
      campo,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: layout[campo].x,
      origY: layout[campo].y,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  function updateFontSize(campo: CampoId, delta: number) {
    setLayout((prev) => ({
      ...prev,
      [campo]: { ...prev[campo], fontSize: Math.max(6, Math.round((prev[campo].fontSize + delta) * 10) / 10) },
    }));
  }

  function handleRestaurar() {
    setLayout(INFORMATIVO_LAYOUT_PADRAO);
    show("info", "Layout restaurado pro padrão — clique em Salvar pra confirmar.");
  }

  async function handleSalvar() {
    setSalvando(true);
    try {
      await salvarLayoutInformativo(layout, uid);
      await logAudit({
        acao: "layout_informativo_atualizado",
        entidade: "configuracoes",
        entidadeId: "informativo_layout",
        dados: {},
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      show("success", "Layout do informativo salvo — já vale pra próxima exportação.");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  const fundo = modalidade === "corrida" ? "/informativo-fundo-corrida.png" : "/informativo-fundo-bike.png";

  const gruposOrdenados = useMemo(() => {
    const grupos: { nome: string; campos: CampoId[] }[] = [];
    for (const id of CAMPOS_ORDEM) {
      const grupoNome = CAMPOS_INFO[id].grupo;
      let grupo = grupos.find((g) => g.nome === grupoNome);
      if (!grupo) {
        grupo = { nome: grupoNome, campos: [] };
        grupos.push(grupo);
      }
      grupo.campos.push(id);
    }
    return grupos;
  }, []);

  if (carregando) return <Card className="h-96 animate-pulse" />;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-start gap-2.5 border-primary/20 bg-primary/[0.03]">
        <Move className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-xs text-text-light">
          Arraste cada campo até a posição certa em cima do fundo — nomes, pontos, treinos e km do pódio
          já são preenchidos automaticamente, só os 4 números de KPI e o mês precisam de ajuste fino.
          Use os botões <b>A+/A-</b> pra mudar o tamanho da fonte do campo selecionado. O layout é o mesmo
          pra Bike e Corrida — troque a prévia abaixo só pra conferir contra os dois fundos.
        </p>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={modalidade}
          onChange={setModalidade}
          options={[
            { value: "corrida", label: "Prévia: Corrida" },
            { value: "bicicleta", label: "Prévia: Bike" },
          ]}
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleRestaurar}>
            <RotateCcw className="size-3.5" />
            Restaurar padrão
          </Button>
          <Button size="sm" onClick={handleSalvar} loading={salvando}>
            <Save className="size-3.5" />
            Salvar layout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_260px]">
        <div
          ref={containerRef}
          className="relative w-full select-none overflow-hidden rounded-[var(--radius-lg)] border border-border"
          style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, containerType: "inline-size" } as React.CSSProperties}
          onPointerDown={() => setSelecionado(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- fundo estático servido de /public, não precisa de otimização do next/image aqui. */}
          <img src={fundo} alt="" className="pointer-events-none absolute inset-0 size-full" draggable={false} />

          {CAMPOS_ORDEM.map((id) => {
            const campo = layout[id];
            const ativo = selecionado === id;
            return (
              <div
                key={id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handlePointerDown(e, id);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move whitespace-nowrap rounded px-1.5 py-0.5 font-bold text-white transition-shadow ${
                  ativo ? "shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-primary)]" : "shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
                }`}
                style={{
                  left: `${(campo.x / PAGE_W) * 100}%`,
                  top: `${(campo.y / PAGE_H) * 100}%`,
                  fontSize: `${(campo.fontSize / PAGE_W) * 100}cqw`,
                }}
              >
                {AMOSTRA[id]}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          {selecionado ? (
            <Card className="flex flex-col gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Selecionado</p>
                <p className="text-sm font-bold text-text">{CAMPOS_INFO[selecionado].label}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text-light">Tamanho da fonte</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateFontSize(selecionado, -1)}
                    className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-border text-text hover:bg-bg"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-text">
                    {layout[selecionado].fontSize}
                  </span>
                  <button
                    onClick={() => updateFontSize(selecionado, 1)}
                    className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-border text-text hover:bg-bg"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-text-muted">
                X: {Math.round(layout[selecionado].x)} · Y: {Math.round(layout[selecionado].y)}
              </p>
            </Card>
          ) : (
            <Card className="text-xs text-text-muted">Clique num campo no fundo pra selecionar e ajustar.</Card>
          )}

          {gruposOrdenados.map((grupo) => (
            <Card key={grupo.nome} className="flex flex-col gap-1.5">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-text-muted">{grupo.nome}</p>
              {grupo.campos.map((id) => (
                <button
                  key={id}
                  onClick={() => setSelecionado(id)}
                  className={`rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                    selecionado === id ? "bg-primary/10 text-primary" : "text-text-light hover:bg-bg"
                  }`}
                >
                  {CAMPOS_INFO[id].label}
                </button>
              ))}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
