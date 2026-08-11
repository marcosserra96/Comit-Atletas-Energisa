"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Move, Plus, RotateCcw, Save } from "lucide-react";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { logAudit } from "@/lib/audit";
import {
  CAMPOS_INFO,
  CAMPOS_ORDEM,
  LAYOUT_INFORMATIVO_PADRAO,
  RANKING_ROWS_POR_COLUNA,
  type CampoId,
  type InformativoLayoutExtras,
  type LayoutInformativo,
} from "@/lib/informativoLayout";
import { carregarLayoutInformativo, salvarLayoutInformativo } from "@/lib/informativoLayoutStore";

const PAGE_W = 1672;
const PAGE_H = 941;

/** Texto de exemplo em cada campo, pra dar noção real de tamanho e alinhamento. */
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
  rankRow1: "1º",
  rankEsqNome: "Ana Carolina Nogueira Lima",
  rankEsqPontos: "24",
  rankEsqTreinos: "14",
  rankEsqKm: "124,80",
  rankDirNome: "Matheus Marchiote",
  rankDirPontos: "11",
  rankDirTreinos: "6",
  rankDirKm: "60,20",
  destaque1Titulo: "Maior quilometragem",
  destaque1Linha1: "1º Weslei Louzado Diana",
  destaque2Titulo: "Mais treinos",
  destaque2Linha1: "1º Weslei Louzado Diana",
  destaque3Titulo: "Maior pontuação",
  destaque3Linha1: "1º Weslei Louzado Diana",
};

/** Valor à direita nas linhas de destaque (nome à esquerda, valor à direita). */
const AMOSTRA_VALOR: Partial<Record<CampoId, string>> = {
  destaque1Linha1: "135,00 km",
  destaque2Linha1: "15 treinos",
  destaque3Linha1: "26 pts",
};

/** Linhas fantasma do ranking, só pra conferir se o espaçamento bate com os números já impressos na arte. */
const AMOSTRA_LINHAS = [
  "Roberto Werneck", "Eliseu Luiz dos Santos", "Marx Teixeira", "Paula Mara de Oliveira",
  "Dayvison Moreira", "Caroline Bernardes", "Maria Julia Nogueira", "Fabiane Barbosa",
  "Marco Aurelio Vilela", "Pollyana Cerqueira", "Rafaela Gonçalves", "Hugo Alves de Oliveira",
  "Aline Borges Carneiro", "Larissa Freire", "Camila do Carmo Lelis", "Lauany Peixoto Duarte",
  "Rodrigo Sales de Lima", "Amanda de Almeida",
];

const COLUNAS_RANK: { nome: CampoId; pontos: CampoId; treinos: CampoId; km: CampoId }[] = [
  { nome: "rankEsqNome", pontos: "rankEsqPontos", treinos: "rankEsqTreinos", km: "rankEsqKm" },
  { nome: "rankDirNome", pontos: "rankDirPontos", treinos: "rankDirTreinos", km: "rankDirKm" },
];

const DESTAQUE_LINHAS: CampoId[] = ["destaque1Linha1", "destaque2Linha1", "destaque3Linha1"];

export function InformativoLayoutTab() {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [layout, setLayout] = useState<LayoutInformativo>(LAYOUT_INFORMATIVO_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modalidade, setModalidade] = useState<"corrida" | "bicicleta">("corrida");
  const [selecionado, setSelecionado] = useState<CampoId | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Solta os listeners do arraste em andamento (usado no fim do arraste e se a aba desmontar no meio). */
  const encerrarArrasteRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    carregarLayoutInformativo()
      .then(setLayout)
      .finally(() => setCarregando(false));
  }, []);

  const moverCampo = useCallback((campo: CampoId, dx: number, dy: number, origem?: { x: number; y: number }) => {
    const eixo = CAMPOS_INFO[campo].eixo;
    setLayout((prev) => {
      const base = origem ?? prev.campos[campo];
      const x = eixo === "y" ? prev.campos[campo].x : Math.round((base.x + dx) * 10) / 10;
      const y = eixo === "x" ? prev.campos[campo].y : Math.round((base.y + dy) * 10) / 10;
      return { ...prev, campos: { ...prev.campos, [campo]: { ...prev.campos[campo], x, y } } };
    });
  }, []);

  function handlePointerDown(e: React.PointerEvent, campo: CampoId) {
    e.preventDefault();
    e.stopPropagation();
    setSelecionado(campo);

    const inicioX = e.clientX;
    const inicioY = e.clientY;
    const origem = { x: layout.campos[campo].x, y: layout.campos[campo].y };

    function aoMover(ev: PointerEvent) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const dx = ((ev.clientX - inicioX) * PAGE_W) / rect.width;
      const dy = ((ev.clientY - inicioY) * PAGE_H) / rect.height;
      moverCampo(campo, dx, dy, origem);
    }
    function aoSoltar() {
      window.removeEventListener("pointermove", aoMover);
      window.removeEventListener("pointerup", aoSoltar);
      encerrarArrasteRef.current = null;
    }

    encerrarArrasteRef.current = aoSoltar;
    window.addEventListener("pointermove", aoMover);
    window.addEventListener("pointerup", aoSoltar);
  }

  useEffect(() => () => encerrarArrasteRef.current?.(), []);

  // Setas do teclado movem o campo selecionado de 1 em 1 (Shift = 10), pra ajuste fino.
  useEffect(() => {
    if (!selecionado) return;
    function onKey(e: KeyboardEvent) {
      const passo = e.shiftKey ? 10 : 1;
      const mapa: Record<string, [number, number]> = {
        ArrowLeft: [-passo, 0],
        ArrowRight: [passo, 0],
        ArrowUp: [0, -passo],
        ArrowDown: [0, passo],
      };
      const delta = mapa[e.key];
      if (!delta || !selecionado) return;
      e.preventDefault();
      moverCampo(selecionado, delta[0], delta[1]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecionado, moverCampo]);

  function updateFontSize(campo: CampoId, delta: number) {
    setLayout((prev) => ({
      ...prev,
      campos: {
        ...prev.campos,
        [campo]: {
          ...prev.campos[campo],
          fontSize: Math.max(5, Math.round((prev.campos[campo].fontSize + delta) * 10) / 10),
        },
      },
    }));
  }

  function updateExtra(chave: keyof InformativoLayoutExtras, delta: number) {
    setLayout((prev) => ({
      ...prev,
      extras: {
        ...prev.extras,
        [chave]: Math.max(1, Math.round((prev.extras[chave] + delta) * 100) / 100),
      },
    }));
  }

  function handleRestaurar() {
    setLayout(LAYOUT_INFORMATIVO_PADRAO);
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
      show("success", "Layout salvo — já vale pra próxima exportação.");
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

  /** As colunas do ranking sempre desenham na altura definida por "rankRow1" — é assim que o PDF monta. */
  function yDeExibicao(id: CampoId) {
    if (id.startsWith("rank") && id !== "rankRow1") return layout.campos.rankRow1.y;
    return layout.campos[id].y;
  }

  function estiloCampo(id: CampoId, offsetY = 0) {
    const campo = layout.campos[id];
    const info = CAMPOS_INFO[id];
    return {
      left: `${(campo.x / PAGE_W) * 100}%`,
      top: `${((yDeExibicao(id) + offsetY) / PAGE_H) * 100}%`,
      width: `${(info.boxW / PAGE_W) * 100}%`,
      fontSize: `${(campo.fontSize / PAGE_W) * 100}cqw`,
      textAlign: info.align,
      transform: "translateY(-50%)",
    } as React.CSSProperties;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-start gap-2.5 border-primary/20 bg-primary/[0.03]">
        <Move className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-xs text-text-light">
          Arraste cada campo até encaixar na arte. Use <b>A+/A-</b> pro tamanho da fonte e as{" "}
          <b>setas do teclado</b> pra mover de 1 em 1 (Shift = 10). As colunas da tabela só movem na
          horizontal e a <b>1ª linha</b> só na vertical — o resto das linhas segue o espaçamento
          configurado ao lado. As linhas claras são só referência, não saem no PDF. O layout é o mesmo
          pra Bike e Corrida; troque a prévia só pra conferir nos dois fundos.
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <div
          ref={containerRef}
          className="relative w-full select-none overflow-hidden rounded-[var(--radius-lg)] border border-border"
          style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, containerType: "inline-size" } as React.CSSProperties}
          onPointerDown={() => setSelecionado(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- fundo estático de /public; next/image não agrega aqui. */}
          <img src={fundo} alt="" className="pointer-events-none absolute inset-0 size-full" draggable={false} />

          {/* Linhas 2..19 do ranking: só referência visual pro espaçamento. */}
          {COLUNAS_RANK.map((col) =>
            Array.from({ length: RANKING_ROWS_POR_COLUNA - 1 }, (_, i) => {
              const offsetY = (i + 1) * layout.extras.rankingRowHeight;
              return (
                <div key={`${col.nome}-${i}`} className="pointer-events-none">
                  <div className="absolute whitespace-nowrap font-bold text-white/45" style={estiloCampo(col.nome, offsetY)}>
                    {AMOSTRA_LINHAS[i % AMOSTRA_LINHAS.length]}
                  </div>
                  <div className="absolute whitespace-nowrap text-white/45" style={estiloCampo(col.pontos, offsetY)}>
                    {AMOSTRA[col.pontos]}
                  </div>
                  <div className="absolute whitespace-nowrap text-white/45" style={estiloCampo(col.treinos, offsetY)}>
                    {AMOSTRA[col.treinos]}
                  </div>
                  <div className="absolute whitespace-nowrap text-white/45" style={estiloCampo(col.km, offsetY)}>
                    {AMOSTRA[col.km]}
                  </div>
                </div>
              );
            }),
          )}

          {/* Linhas 2 e 3 de cada card de destaque. */}
          {DESTAQUE_LINHAS.map((id) =>
            [1, 2].map((i) => (
              <div
                key={`${id}-${i}`}
                className="pointer-events-none absolute flex items-center justify-between whitespace-nowrap text-white/45"
                style={estiloCampo(id, i * layout.extras.destaqueLinhaGap)}
              >
                <span>
                  {i + 1}º {AMOSTRA_LINHAS[i]}
                </span>
                <span className="font-bold">{AMOSTRA_VALOR[id]}</span>
              </div>
            )),
          )}

          {/* Campos arrastáveis. */}
          {CAMPOS_ORDEM.map((id) => {
            const ativo = selecionado === id;
            const valorDireita = AMOSTRA_VALOR[id];
            return (
              <div
                key={id}
                onPointerDown={(e) => handlePointerDown(e, id)}
                title={CAMPOS_INFO[id].label}
                className={`absolute cursor-move whitespace-nowrap rounded font-bold text-white ${
                  valorDireita ? "flex items-center justify-between" : ""
                } ${
                  ativo
                    ? "shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-primary)]"
                    : "shadow-[0_0_0_1px_rgba(255,255,255,0.3)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.7)]"
                }`}
                style={estiloCampo(id)}
              >
                {valorDireita ? (
                  <>
                    <span className="font-normal">{AMOSTRA[id]}</span>
                    <span>{valorDireita}</span>
                  </>
                ) : (
                  AMOSTRA[id]
                )}
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
                <Stepper
                  valor={layout.campos[selecionado].fontSize}
                  onMenos={() => updateFontSize(selecionado, -0.5)}
                  onMais={() => updateFontSize(selecionado, 0.5)}
                />
              </div>
              <p className="text-[11px] text-text-muted">
                X: {Math.round(layout.campos[selecionado].x)} · Y:{" "}
                {Math.round(layout.campos[selecionado].y)}
                {CAMPOS_INFO[selecionado].eixo !== "xy" && (
                  <span className="ml-1 text-text-muted">
                    (move só na {CAMPOS_INFO[selecionado].eixo === "x" ? "horizontal" : "vertical"})
                  </span>
                )}
              </p>
            </Card>
          ) : (
            <Card className="text-xs text-text-muted">
              Clique num campo em cima da arte pra selecionar e ajustar.
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Espaçamentos</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-text-light">Entre linhas do ranking</span>
              <Stepper
                valor={layout.extras.rankingRowHeight}
                onMenos={() => updateExtra("rankingRowHeight", -0.25)}
                onMais={() => updateExtra("rankingRowHeight", 0.25)}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-text-light">Entre linhas dos destaques</span>
              <Stepper
                valor={layout.extras.destaqueLinhaGap}
                onMenos={() => updateExtra("destaqueLinhaGap", -1)}
                onMais={() => updateExtra("destaqueLinhaGap", 1)}
              />
            </div>
          </Card>

          {gruposOrdenados.map((grupo) => (
            <Card key={grupo.nome} className="flex flex-col gap-1">
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

function Stepper({ valor, onMenos, onMais }: { valor: number; onMenos: () => void; onMais: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onMenos}
        className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-border text-text hover:bg-bg"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-11 text-center text-sm font-bold tabular-nums text-text">{valor}</span>
      <button
        type="button"
        onClick={onMais}
        className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-border text-text hover:bg-bg"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
