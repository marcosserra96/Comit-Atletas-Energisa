"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignStartHorizontal,
  AlignStartVertical,
  CaseSensitive,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Save,
  type LucideIcon,
} from "lucide-react";
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
  type CampoLayout,
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
  // nomes longos de propósito — é o caso que mais precisa de ajuste de largura/quebra
  podio1Nome: "Weslei Louzado Diana",
  podio2Nome: "Wagner Luis Porfirio Rezende",
  podio3Nome: "Erique Rangel Fortes",
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
  /** Seleção múltipla, em ordem — o primeiro é a referência pra alinhar e igualar fonte. */
  const [selecionados, setSelecionados] = useState<CampoId[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Solta os listeners do arraste em andamento (usado no fim do arraste e se a aba desmontar no meio). */
  const encerrarArrasteRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    carregarLayoutInformativo()
      .then(setLayout)
      .finally(() => setCarregando(false));
  }, []);

  /** Move um conjunto de campos, respeitando a trava de eixo de cada um. */
  const deslocar = useCallback(
    (ids: CampoId[], dx: number, dy: number, origens?: Map<CampoId, CampoLayout>) => {
      setLayout((prev) => {
        const campos = { ...prev.campos };
        for (const id of ids) {
          const eixo = CAMPOS_INFO[id].eixo;
          const base = origens?.get(id) ?? prev.campos[id];
          campos[id] = {
            ...prev.campos[id],
            x: eixo === "y" ? prev.campos[id].x : Math.round((base.x + dx) * 10) / 10,
            y: eixo === "x" ? prev.campos[id].y : Math.round((base.y + dy) * 10) / 10,
          };
        }
        return { ...prev, campos };
      });
    },
    [],
  );

  function handlePointerDown(e: React.PointerEvent, campo: CampoId) {
    e.preventDefault();
    e.stopPropagation();

    // Shift/Ctrl/Cmd soma à seleção; clique simples num campo de fora troca a seleção,
    // mas clicar num já selecionado mantém o grupo (pra arrastar todos juntos).
    const aditivo = e.shiftKey || e.metaKey || e.ctrlKey;
    const jaEstava = selecionados.includes(campo);
    const alvo = aditivo
      ? jaEstava
        ? selecionados.filter((id) => id !== campo)
        : [...selecionados, campo]
      : jaEstava
        ? selecionados
        : [campo];
    setSelecionados(alvo);
    if (aditivo && jaEstava) return; // acabou de tirar da seleção — não arrasta

    const inicioX = e.clientX;
    const inicioY = e.clientY;
    const origens = new Map(alvo.map((id) => [id, { ...layout.campos[id] }]));

    function aoMover(ev: PointerEvent) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const dx = ((ev.clientX - inicioX) * PAGE_W) / rect.width;
      const dy = ((ev.clientY - inicioY) * PAGE_H) / rect.height;
      deslocar(alvo, dx, dy, origens);
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

  // Setas do teclado movem a seleção de 1 em 1 (Shift = 10), pra ajuste fino.
  useEffect(() => {
    if (selecionados.length === 0) return;
    function onKey(e: KeyboardEvent) {
      const passo = e.shiftKey ? 10 : 1;
      const mapa: Record<string, [number, number]> = {
        ArrowLeft: [-passo, 0],
        ArrowRight: [passo, 0],
        ArrowUp: [0, -passo],
        ArrowDown: [0, passo],
      };
      const delta = mapa[e.key];
      if (!delta) return;
      e.preventDefault();
      deslocar(selecionados, delta[0], delta[1]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecionados, deslocar]);

  function ajustarFonte(delta: number) {
    setLayout((prev) => {
      const campos = { ...prev.campos };
      for (const id of selecionados) {
        campos[id] = {
          ...prev.campos[id],
          fontSize: Math.max(5, Math.round((prev.campos[id].fontSize + delta) * 10) / 10),
        };
      }
      return { ...prev, campos };
    });
  }

  function ajustarLargura(delta: number) {
    setLayout((prev) => {
      const campos = { ...prev.campos };
      for (const id of selecionados) {
        campos[id] = { ...prev.campos[id], boxW: Math.max(20, Math.round(prev.campos[id].boxW + delta)) };
      }
      return { ...prev, campos };
    });
  }

  function definirQuebra(valor: boolean) {
    setLayout((prev) => {
      const campos = { ...prev.campos };
      for (const id of selecionados) campos[id] = { ...prev.campos[id], quebraLinha: valor };
      return { ...prev, campos };
    });
  }

  /** Deixa todos os selecionados com a fonte do primeiro (a referência). */
  function igualarFonte() {
    setLayout((prev) => {
      const alvo = prev.campos[selecionados[0]].fontSize;
      const campos = { ...prev.campos };
      for (const id of selecionados) campos[id] = { ...prev.campos[id], fontSize: alvo };
      return { ...prev, campos };
    });
    show("info", "Todos os campos selecionados ficaram com o mesmo tamanho de fonte.");
  }

  /** Alinha os selecionados na mesma coluna (x) ou na mesma linha (y) do primeiro. */
  function alinhar(eixo: "x" | "y") {
    setLayout((prev) => {
      const alvo = prev.campos[selecionados[0]][eixo];
      const campos = { ...prev.campos };
      for (const id of selecionados) {
        // um campo travado no eixo contrário não pode ser alinhado nesse eixo
        if (CAMPOS_INFO[id].eixo === (eixo === "x" ? "y" : "x")) continue;
        campos[id] = { ...prev.campos[id], [eixo]: alvo };
      }
      return { ...prev, campos };
    });
  }

  function selecionarGrupo(campos: CampoId[]) {
    setSelecionados(campos);
  }

  function alternarPelaLista(id: CampoId, aditivo: boolean) {
    setSelecionados((prev) => {
      if (!aditivo) return [id];
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  /** Valor comum da seleção pra um campo numérico: o número quando todos batem, senão "—". */
  function valorComum(pegar: (l: CampoLayout) => number): number | string {
    if (selecionados.length === 0) return 0;
    const valores = new Set(selecionados.map((id) => pegar(layout.campos[id])));
    return valores.size === 1 ? [...valores][0] : "—";
  }

  const fonteDaSelecao = valorComum((l) => l.fontSize);
  const larguraDaSelecao = valorComum((l) => l.boxW);
  const quebraDaSelecao = (() => {
    const valores = new Set(selecionados.map((id) => layout.campos[id].quebraLinha));
    return valores.size === 1 ? [...valores][0] : null;
  })();

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
      width: `${(campo.boxW / PAGE_W) * 100}%`,
      fontSize: `${(campo.fontSize / PAGE_W) * 100}cqw`,
      lineHeight: 1.15,
      textAlign: info.align,
      transform: "translateY(-50%)",
      // espelha o PDF: sem quebra vira uma linha só, cortando com reticências
      whiteSpace: campo.quebraLinha ? "normal" : "nowrap",
      overflow: campo.quebraLinha ? undefined : "hidden",
      textOverflow: campo.quebraLinha ? undefined : "ellipsis",
    } as React.CSSProperties;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-start gap-2.5 border-primary/20 bg-primary/[0.03]">
        <Move className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-xs text-text-light">
          Arraste cada campo até encaixar na arte; as <b>setas do teclado</b> movem de 1 em 1 (Shift = 10).
          Segure <b>Shift</b> (ou Ctrl/Cmd) pra selecionar vários e mover, alinhar e mudar a fonte de
          todos de uma vez — ou clique em <b>&quot;selecionar todos&quot;</b> no título de um grupo. As
          colunas da tabela só movem na horizontal e a <b>1ª linha</b> só na vertical; o resto das linhas
          segue o espaçamento configurado ao lado. As linhas claras são só referência, não saem no PDF. O
          layout é o mesmo pra Bike e Corrida; troque a prévia só pra conferir nos dois fundos.
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
          onPointerDown={() => setSelecionados([])}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- fundo estático de /public; next/image não agrega aqui. */}
          <img src={fundo} alt="" className="pointer-events-none absolute inset-0 size-full" draggable={false} />

          {/* Linhas 2..19 do ranking: só referência visual pro espaçamento. */}
          {COLUNAS_RANK.map((col) =>
            Array.from({ length: RANKING_ROWS_POR_COLUNA - 1 }, (_, i) => {
              const offsetY = (i + 1) * layout.extras.rankingRowHeight;
              return (
                <div key={`${col.nome}-${i}`} className="pointer-events-none">
                  <div className="absolute font-bold text-white/45" style={estiloCampo(col.nome, offsetY)}>
                    {AMOSTRA_LINHAS[i % AMOSTRA_LINHAS.length]}
                  </div>
                  <div className="absolute text-white/45" style={estiloCampo(col.pontos, offsetY)}>
                    {AMOSTRA[col.pontos]}
                  </div>
                  <div className="absolute text-white/45" style={estiloCampo(col.treinos, offsetY)}>
                    {AMOSTRA[col.treinos]}
                  </div>
                  <div className="absolute text-white/45" style={estiloCampo(col.km, offsetY)}>
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
                className="pointer-events-none absolute flex items-center justify-between text-white/45"
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
            const posicaoNaSelecao = selecionados.indexOf(id);
            const ehReferencia = posicaoNaSelecao === 0 && selecionados.length > 1;
            const valorDireita = AMOSTRA_VALOR[id];
            return (
              <div
                key={id}
                onPointerDown={(e) => handlePointerDown(e, id)}
                title={CAMPOS_INFO[id].label}
                className={`absolute cursor-move rounded font-bold text-white ${
                  valorDireita ? "flex items-center justify-between" : ""
                } ${
                  ehReferencia
                    ? "shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-accent)]"
                    : posicaoNaSelecao >= 0
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
          {selecionados.length > 0 ? (
            <Card className="flex flex-col gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                  {selecionados.length === 1 ? "Selecionado" : `${selecionados.length} selecionados`}
                </p>
                {selecionados.length === 1 ? (
                  <p className="text-sm font-bold text-text">{CAMPOS_INFO[selecionados[0]].label}</p>
                ) : (
                  <p className="text-xs text-text-light">
                    Referência: <b className="text-accent">{CAMPOS_INFO[selecionados[0]].label}</b>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text-light">Tamanho da fonte</span>
                <Stepper
                  valor={fonteDaSelecao}
                  onMenos={() => ajustarFonte(-0.5)}
                  onMais={() => ajustarFonte(0.5)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text-light">Largura da caixa</span>
                <Stepper valor={larguraDaSelecao} onMenos={() => ajustarLargura(-10)} onMais={() => ajustarLargura(10)} />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-text-light">
                <input
                  type="checkbox"
                  checked={quebraDaSelecao === true}
                  ref={(el) => {
                    if (el) el.indeterminate = quebraDaSelecao === null;
                  }}
                  onChange={(e) => definirQuebra(e.target.checked)}
                  className="size-4 rounded border-border accent-primary"
                />
                Quebrar em várias linhas
              </label>
              <p className="-mt-1 text-[11px] text-text-muted">
                Sem quebra, o texto fica numa linha só e o que passar da largura vira &quot;…&quot;.
              </p>

              {selecionados.length > 1 && (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <p className="text-[11px] text-text-muted">
                    As ações abaixo usam o <b className="text-accent">primeiro selecionado</b> como referência.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <AcaoLote icon={AlignStartVertical} label="Mesma coluna" onClick={() => alinhar("x")} />
                    <AcaoLote icon={AlignStartHorizontal} label="Mesma linha" onClick={() => alinhar("y")} />
                  </div>
                  <AcaoLote icon={CaseSensitive} label="Igualar tamanho da fonte" onClick={igualarFonte} />
                </div>
              )}

              {selecionados.length === 1 && (
                <p className="text-[11px] text-text-muted">
                  X: {Math.round(layout.campos[selecionados[0]].x)} · Y:{" "}
                  {Math.round(layout.campos[selecionados[0]].y)}
                  {CAMPOS_INFO[selecionados[0]].eixo !== "xy" && (
                    <span className="ml-1">
                      (move só na {CAMPOS_INFO[selecionados[0]].eixo === "x" ? "horizontal" : "vertical"})
                    </span>
                  )}
                </p>
              )}
            </Card>
          ) : (
            <Card className="text-xs text-text-muted">
              Clique num campo em cima da arte. Segure <b className="text-text">Shift</b> (ou Ctrl/Cmd) pra
              selecionar vários e ajustar todos de uma vez.
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
              <button
                onClick={() => selecionarGrupo(grupo.campos)}
                title="Selecionar todos deste grupo"
                className="mb-1 flex items-center justify-between gap-2 text-left text-[11px] font-bold uppercase tracking-wide text-text-muted hover:text-primary"
              >
                {grupo.nome}
                <span className="font-semibold normal-case tracking-normal">selecionar todos</span>
              </button>
              {grupo.campos.map((id) => (
                <button
                  key={id}
                  onClick={(e) => alternarPelaLista(id, e.shiftKey || e.metaKey || e.ctrlKey)}
                  className={`rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                    selecionados.includes(id) ? "bg-primary/10 text-primary" : "text-text-light hover:bg-bg"
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

function AcaoLote({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-border px-2 py-1.5 text-[11px] font-semibold text-text transition-colors hover:border-primary/40 hover:bg-bg"
    >
      <Icon className="size-3.5 shrink-0 text-text-light" />
      {label}
    </button>
  );
}

function Stepper({
  valor,
  onMenos,
  onMais,
}: {
  valor: number | string;
  onMenos: () => void;
  onMais: () => void;
}) {
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
