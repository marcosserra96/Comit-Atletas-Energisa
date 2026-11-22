"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { ChevronLeft, ChevronRight, Download, FileDown, ImagePlus, RotateCcw, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import { reduzirImagem } from "@/lib/fotos";
import { carregarTodosLancamentos } from "@/lib/lancamentosCache";
import { useRegrasDeTreino } from "@/lib/useRegrasDeTreino";
import { useDiasTreino } from "@/lib/useDiasTreino";
import { hojeBrasil, normalizarCalendario, ordenarTrimestres, type CalendarioPremiacaoDoc } from "@/lib/calendarioPremiacao";
import { periodoDoAno } from "@/lib/reuniaoResultados";
import { listarReunioes } from "@/lib/reuniaoCliente";
import { MEDIDAS, type DadosAnalise } from "@/lib/analises/motor";
import { calcularPremio, MEDIDAS_DO_PREMIO, novoPremio, type MedidaDoPremio, type PremioPersonalizado } from "@/lib/premiacaoPersonalizada";
import {
  CAMPOS_DO_TEXTO,
  LAYOUTS_CERTIFICADO,
  TAMANHO_CERTIFICADO,
  destinatariosDaMeta,
  destinatariosDoPremio,
  nomeDoArquivoCertificado,
  periodoNaFrase,
  preencher,
  textoColocacao,
  textosPadrao,
  type Destinatario,
  type LayoutCertificado,
  type MetaCertificado,
  type OrigemCertificado,
  type TextosCertificado,
} from "@/lib/certificado";
import { ArteCertificado } from "@/components/informativo/ArteCertificado";
import { EditorPremio } from "@/components/reuniao/EditorPremio";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PreviaEscalada } from "./PreviaEscalada";
import type { RegrasDeTreino } from "@/lib/activityConsolidation";
import type { DiasTreinoConfigDoc } from "@/lib/aderencia";
import type { AtletaDoc, HistoricoMensalDoc } from "@/lib/types";

const CHAVE_RASCUNHO = "certificados:rascunho";
const { largura: W, altura: H } = TAMANHO_CERTIFICADO;

interface Rascunho {
  origem: OrigemCertificado;
  periodoId: string;
  premio: PremioPersonalizado;
  meta: MetaCertificado;
  manuais: string[];
  layout: LayoutCertificado;
  textos: Partial<Record<OrigemCertificado, TextosCertificado>>;
}

function lerRascunho(): Partial<Rascunho> | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_RASCUNHO);
    return bruto ? (JSON.parse(bruto) as Partial<Rascunho>) : null;
  } catch {
    return null;
  }
}

function gravarRascunho(r: Rascunho) {
  try {
    window.localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(r));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}

export interface DadosCertificados {
  atletas: AtletaDoc[];
  lancamentos: DadosAnalise["lancamentos"];
  resumos: HistoricoMensalDoc[];
  calendario: CalendarioPremiacaoDoc;
}

/** Atletas, lançamentos, resumos mensais e calendário: o mesmo que as Análises usam. */
export function useDadosCertificados() {
  const [dados, setDados] = useState<DadosCertificados | null>(null);
  const [erro, setErro] = useState(false);
  const regrasTreino = useRegrasDeTreino();
  const diasTreino = useDiasTreino();
  useEffect(() => {
    let vivo = true;
    Promise.all([
      getDocs(collection(db, "atletas")),
      carregarTodosLancamentos(),
      getDocs(collection(db, "historico_mensal")).catch(() => null),
      getDoc(doc(db, "configuracoes", "calendario_premiacao")).catch(() => null),
    ])
      .then(([atletas, lancamentos, resumos, cal]) => {
        if (!vivo) return;
        setDados({
          atletas: atletas.docs.map((d) => ({ ...(d.data() as AtletaDoc), id: d.id })),
          lancamentos,
          resumos: resumos ? resumos.docs.map((d) => ({ ...(d.data() as HistoricoMensalDoc), id: d.id })) : [],
          calendario: normalizarCalendario(cal?.data() as Partial<CalendarioPremiacaoDoc> | undefined),
        });
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, []);
  return { dados, regrasTreino, diasTreino, erro };
}

function Grupo({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-text">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

function AreaDeTexto({ label, value, onChange, dica }: { label: string; value: string; onChange: (v: string) => void; dica?: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        value={value}
        maxLength={400}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-[var(--radius)] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      {dica}
    </div>
  );
}

/**
 * Certificados: quem recebe (premiação com critérios, meta atingida ou
 * escolha do comitê), a arte e os textos, com um certificado por atleta.
 * Sai em PDF (todos, um por página) ou em imagem (o que está na tela).
 */
export function Certificados() {
  const { dados, regrasTreino, diasTreino, erro } = useDadosCertificados();
  if (erro) return <InlineAlert tone="danger">Não foi possível carregar os dados dos atletas. Recarregue a página para tentar de novo.</InlineAlert>;
  if (!dados || !regrasTreino) {
    return (
      <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start" aria-busy="true">
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-64 w-full" />
        </Card>
        <Skeleton className="order-first aspect-[1754/1240] w-full rounded-[var(--radius-lg)] lg:order-none" />
      </div>
    );
  }
  return <PainelCertificados dados={dados} regrasTreino={regrasTreino} diasTreino={diasTreino} />;
}

export function PainelCertificados({ dados, regrasTreino, diasTreino }: { dados: DadosCertificados; regrasTreino: RegrasDeTreino; diasTreino: DiasTreinoConfigDoc | null }) {
  const { show } = useToast();
  const hoje = hojeBrasil();
  const [origem, setOrigem] = useState<OrigemCertificado>("premio");
  const [periodoId, setPeriodoId] = useState(`ano-${hoje.slice(0, 4)}`);
  const [premio, setPremio] = useState<PremioPersonalizado>(() => novoPremio());
  const [meta, setMeta] = useState<MetaCertificado>({ medida: "treinos", minimo: 48, equipe: "todas" });
  const [manuais, setManuais] = useState<string[]>([]);
  const [layout, setLayout] = useState<LayoutCertificado>("classico");
  const [textosPorOrigem, setTextosPorOrigem] = useState<Partial<Record<OrigemCertificado, TextosCertificado>>>({});
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [imagem, setImagem] = useState("");
  const [aba, setAba] = useState<"quem" | "arte" | "textos">("quem");
  const [atual, setAtual] = useState(0);
  const [carregado, setCarregado] = useState(false);
  const [exportando, setExportando] = useState<{ feitos: number; total: number } | "png" | null>(null);
  const [premiosSalvos, setPremiosSalvos] = useState<{ chave: string; reuniao: string; premio: PremioPersonalizado }[]>([]);
  const arte = useRef<HTMLDivElement>(null);
  const lote = useRef<(HTMLDivElement | null)[]>([]);
  const entradaImagem = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const r = lerRascunho();
      if (r) {
        if (r.origem) setOrigem(r.origem);
        if (r.periodoId) setPeriodoId(r.periodoId);
        if (r.premio?.criterios?.length) setPremio(r.premio);
        if (r.meta) setMeta(r.meta);
        if (Array.isArray(r.manuais)) setManuais(r.manuais);
        if (r.layout) setLayout(r.layout);
        if (r.textos) setTextosPorOrigem(r.textos);
      }
      setCarregado(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    if (carregado) gravarRascunho({ origem, periodoId, premio, meta, manuais, layout, textos: textosPorOrigem });
  }, [carregado, origem, periodoId, premio, meta, manuais, layout, textosPorOrigem]);

  // Prêmios montados nas reuniões, para reaproveitar (quem não pode ver reuniões só não vê a lista).
  useEffect(() => {
    listarReunioes()
      .then((rs) => setPremiosSalvos(rs.flatMap((r) => (r.premios ?? []).map((p) => ({ chave: `${r.id}:${p.id}`, reuniao: r.titulo, premio: p })))))
      .catch(() => setPremiosSalvos([]));
  }, []);

  const periodos = useMemo(() => {
    const trimestres = ordenarTrimestres(dados.calendario.trimestres);
    const anos = [...new Set([hoje.slice(0, 4), ...trimestres.map((t) => t.inicio.slice(0, 4))])].sort().reverse();
    return [
      ...anos.map((ano) => ({ id: `ano-${ano}`, ...periodoDoAno(trimestres, ano), texto: periodoNaFrase({ nome: "", anual: true, ano }) })),
      ...trimestres
        .filter((t) => t.inicio <= hoje)
        .reverse()
        .map((t) => ({ id: t.id, nome: t.nome, inicio: t.inicio, fim: t.fim, texto: periodoNaFrase({ nome: t.nome, anual: false, ano: t.fim.slice(0, 4) }) })),
    ];
  }, [dados, hoje]);
  const periodo = periodos.find((p) => p.id === periodoId) ?? periodos[0];

  const dadosAnalise: DadosAnalise = useMemo(
    () => ({ atletas: dados.atletas, lancamentos: dados.lancamentos, resumos: dados.resumos, regrasTreino, diasTreino, hoje }),
    [dados, regrasTreino, diasTreino, hoje],
  );

  const resultadoPremio = useMemo(() => (periodo && origem === "premio" ? calcularPremio(premio, dadosAnalise, periodo) : undefined), [dadosAnalise, periodo, premio, origem]);

  const candidatos: Destinatario[] = useMemo(() => {
    if (!periodo) return [];
    if (origem === "premio") return resultadoPremio ? destinatariosDoPremio(premio, resultadoPremio) : [];
    if (origem === "meta") return destinatariosDaMeta(meta, dadosAnalise, periodo);
    const porId = new Map(dadosAnalise.atletas.map((a) => [a.id, a]));
    return manuais.flatMap((id) => {
      const a = porId.get(id);
      return a ? [{ id, nome: a.nome, equipe: a.equipe === "bicicleta" ? ("bicicleta" as const) : ("corrida" as const), valores: [] }] : [];
    });
  }, [dadosAnalise, periodo, origem, resultadoPremio, premio, meta, manuais]);
  const destinatarios = candidatos.filter((d) => !excluidos.has(d.id));
  const indice = Math.min(atual, Math.max(0, destinatarios.length - 1));
  const pessoa = destinatarios[indice];

  const textosBase = textosPorOrigem[origem] ?? textosPadrao(origem, hoje);
  const mudarTexto = (campo: keyof TextosCertificado, valor: string) => setTextosPorOrigem((t) => ({ ...t, [origem]: { ...textosBase, [campo]: valor } }));
  const contexto = { premio: premio.titulo, periodo: periodo?.texto ?? "" };
  const textosDe = (d: Destinatario): TextosCertificado => ({ ...textosBase, texto: preencher(textosBase.texto, d, contexto) });
  const exemplo: Destinatario = { id: "exemplo", nome: "Nome do atleta", valores: ["1.240 pontos"], colocacao: origem === "premio" ? 1 : undefined };
  const mostrado = pessoa ?? exemplo;

  const atletasParaEscolher = useMemo(
    () => dados.atletas.filter((a) => (a.equipe === "corrida" || a.equipe === "bicicleta") && a.visivelNasListas !== false && !manuais.includes(a.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [dados, manuais],
  );

  async function escolherImagem(arquivo?: File) {
    if (!arquivo) return;
    try {
      setImagem(await reduzirImagem(arquivo, { lado: 1800, qualidade: 0.88 }));
      setLayout("imagem");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível abrir esta imagem.");
    } finally {
      if (entradaImagem.current) entradaImagem.current.value = "";
    }
  }

  async function baixarPng() {
    if (!arte.current || !pessoa) return;
    setExportando("png");
    try {
      const { toBlob, getFontEmbedCSS } = await import("html-to-image");
      await document.fonts.ready;
      const fontEmbedCSS = await getFontEmbedCSS(arte.current);
      const blob = await toBlob(arte.current, { width: W, height: H, pixelRatio: 1, fontEmbedCSS, cacheBust: true });
      if (!blob) throw new Error("sem imagem");
      baixarArquivo(blob, nomeDoArquivoCertificado(pessoa.nome, "png"));
      show("success", "Certificado baixado.");
    } catch {
      show("error", "Não foi possível gerar a imagem agora. Tente novamente.");
    } finally {
      setExportando(null);
    }
  }

  async function baixarPdf() {
    if (destinatarios.length === 0) return;
    setExportando({ feitos: 0, total: destinatarios.length });
    try {
      const [{ toJpeg, getFontEmbedCSS }, { pdf, Document, Page, Image }, { createElement }] = await Promise.all([import("html-to-image"), import("@react-pdf/renderer"), import("react")]);
      // Os certificados do lote acabaram de entrar na página (escondidos): espera fontes e imagens.
      await new Promise((r) => window.setTimeout(r, 300));
      await document.fonts.ready;
      const nos = lote.current.slice(0, destinatarios.length).filter((n): n is HTMLDivElement => !!n);
      await Promise.all(nos.flatMap((n) => [...n.querySelectorAll("img")].map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r))))));
      const fontEmbedCSS = nos[0] ? await getFontEmbedCSS(nos[0]) : undefined;
      const paginas: string[] = [];
      for (const [i, no] of nos.entries()) {
        paginas.push(await toJpeg(no, { width: W, height: H, pixelRatio: 1, quality: 0.92, fontEmbedCSS, cacheBust: i === 0 }));
        setExportando({ feitos: i + 1, total: nos.length });
      }
      // A4 deitado em pontos.
      const documento = createElement(
        Document,
        { title: origem === "premio" ? premio.titulo : "Certificados", author: "Comitê Atletas Energisa" },
        ...paginas.map((src, i) => createElement(Page, { key: i, size: "A4", orientation: "landscape", style: { padding: 0 } }, createElement(Image, { src, style: { width: 842, height: 595 } }))),
      );
      const blob = await pdf(documento).toBlob();
      baixarArquivo(blob, nomeDoArquivoCertificado(origem === "premio" ? premio.titulo : periodo?.nome ?? "", "pdf", destinatarios.length > 1));
      show("success", destinatarios.length === 1 ? "Certificado baixado em PDF." : `${destinatarios.length} certificados baixados em um PDF.`);
    } catch {
      show("error", "Não foi possível gerar o PDF agora. Tente novamente.");
    } finally {
      setExportando(null);
    }
  }

  const carregando = !periodo;
  const gerandoPdf = exportando && exportando !== "png" ? exportando : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start">
      <Card className="flex flex-col gap-4">
        <SegmentedControl
          value={aba}
          onChange={setAba}
          className="w-full [&>button]:flex-1 [&>button]:px-2"
          options={[
            { value: "quem", label: "Atletas" },
            { value: "arte", label: "Arte" },
            { value: "textos", label: "Textos" },
          ]}
        />

        {aba === "quem" ? (
          carregando ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <Grupo titulo="Critério">
                <div className="flex flex-col gap-1.5">
                  <SegmentedControl
                    value={origem}
                    onChange={(o) => {
                      setOrigem(o);
                      setExcluidos(new Set());
                      setAtual(0);
                    }}
                    className="w-full [&>button]:flex-1 [&>button]:px-2"
                    options={[
                      { value: "premio", label: "Premiação" },
                      { value: "meta", label: "Meta" },
                      { value: "manual", label: "Escolher" },
                    ]}
                  />
                  <p className="text-xs text-text-light">
                    {origem === "premio"
                      ? "O pódio de um prêmio com critérios e pesos, como o Atleta do ano."
                      : origem === "meta"
                        ? "Todos que chegaram a um número no período, como 48 treinos no ano."
                        : "Você escolhe quem recebe, um a um."}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-text">Período</span>
                  <Select value={periodo.id} onChange={(e) => setPeriodoId(e.target.value)} aria-label="Período">
                    {periodos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </Select>
                </div>
              </Grupo>

              {origem === "premio" ? (
                <Grupo titulo="Prêmio">
                  {premiosSalvos.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-text">Usar um prêmio de uma reunião</span>
                      <Select
                        value=""
                        onChange={(e) => {
                          const p = premiosSalvos.find((x) => x.chave === e.target.value)?.premio;
                          if (p) setPremio({ ...p, criterios: p.criterios.map((c) => ({ ...c })) });
                        }}
                        aria-label="Usar um prêmio de uma reunião"
                        placeholder="Escolha para copiar os critérios"
                      >
                        {premiosSalvos.map((x) => (
                          <option key={x.chave} value={x.chave}>
                            {`${x.premio.titulo} · ${x.reuniao}`}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}
                  <EditorPremio premio={premio} resultado={resultadoPremio} onChange={setPremio} embutido />
                </Grupo>
              ) : origem === "meta" ? (
                <Grupo titulo="Meta">
                  <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-text">Medida</span>
                      <Select value={meta.medida} onChange={(e) => setMeta({ ...meta, medida: e.target.value as MedidaDoPremio })} aria-label="Medida">
                        {MEDIDAS_DO_PREMIO.map((m) => (
                          <option key={m} value={m}>
                            {MEDIDAS[m].rotulo}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <TextField
                      label="A partir de"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={String(meta.minimo)}
                      onChange={(e) => setMeta({ ...meta, minimo: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                  <p className="-mt-1 text-xs text-text-light">{MEDIDAS[meta.medida].descricao}</p>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-text">Equipe</span>
                    <SegmentedControl
                      value={meta.equipe}
                      onChange={(v) => setMeta({ ...meta, equipe: v })}
                      className="w-full [&>button]:flex-1"
                      options={[
                        { value: "todas", label: "Todas" },
                        { value: "corrida", label: "Corrida" },
                        { value: "bicicleta", label: "Bike" },
                      ]}
                    />
                  </div>
                </Grupo>
              ) : (
                <Grupo titulo="Atletas">
                  <Select value="" searchable placeholder="Buscar atleta para incluir" aria-label="Incluir atleta" onChange={(e) => e.target.value && setManuais((m) => [...m, e.target.value])}>
                    {atletasParaEscolher.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </Select>
                </Grupo>
              )}

              <Grupo
                titulo={`Recebem o certificado · ${destinatarios.length}`}
                acao={
                  excluidos.size > 0 ? (
                    <button type="button" onClick={() => setExcluidos(new Set())} className="text-xs font-semibold text-primary hover:underline">
                      Incluir todos de volta
                    </button>
                  ) : null
                }
              >
                {candidatos.length === 0 ? (
                  <p className="rounded-[var(--radius)] bg-bg-inset/60 px-3 py-2.5 text-sm text-text-light">
                    {origem === "manual" ? "Busque e inclua os atletas acima." : "Ninguém chegou lá nesse período. Mude o período ou o critério."}
                  </p>
                ) : (
                  <ul className="flex max-h-72 flex-col divide-y divide-border-subtle overflow-y-auto rounded-[var(--radius)] border border-border">
                    {candidatos.map((d) => {
                      const fora = excluidos.has(d.id);
                      const posicao = destinatarios.findIndex((x) => x.id === d.id);
                      return (
                        <li key={d.id} className={cn("flex items-center gap-2 bg-bg-card pl-3 pr-1", posicao === indice && !fora && "bg-primary-subtle/60")}>
                          {origem !== "manual" ? (
                            <input
                              type="checkbox"
                              checked={!fora}
                              aria-label={`Incluir ${d.nome}`}
                              onChange={() =>
                                setExcluidos((s) => {
                                  const n = new Set(s);
                                  if (n.has(d.id)) n.delete(d.id);
                                  else n.add(d.id);
                                  return n;
                                })
                              }
                              className="size-4 shrink-0 accent-[var(--color-primary)]"
                            />
                          ) : null}
                          <button type="button" disabled={fora} onClick={() => setAtual(posicao)} className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-50")}>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-text">{d.nome}</span>
                              <span className="block truncate text-xs text-text-light">{[textoColocacao(d.colocacao), d.equipe === "bicicleta" ? "Bike" : "Corrida", ...d.valores].filter(Boolean).join(" · ")}</span>
                            </span>
                          </button>
                          {origem === "manual" ? (
                            <button type="button" onClick={() => setManuais((m) => m.filter((x) => x !== d.id))} aria-label={`Tirar ${d.nome}`} className="flex size-9 shrink-0 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger">
                              <X className="size-4" aria-hidden="true" />
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Grupo>
            </>
          )
        ) : aba === "arte" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {LAYOUTS_CERTIFICADO.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => (l.id === "imagem" && !imagem ? entradaImagem.current?.click() : setLayout(l.id))}
                  aria-pressed={layout === l.id}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-[var(--radius)] p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    layout === l.id ? "bg-primary-subtle ring-2 ring-primary" : "hover:bg-bg-inset",
                  )}
                >
                  <span className="pointer-events-none block overflow-hidden rounded-[6px]" aria-hidden="true">
                    <PreviaEscalada largura={W} altura={H}>
                      <ArteCertificado layout={l.id} textos={textosDe(mostrado)} nome={mostrado.nome} colocacao={mostrado.colocacao} imagem={imagem} />
                    </PreviaEscalada>
                  </span>
                  <span className="px-0.5">
                    <span className={cn("block text-xs font-semibold", layout === l.id ? "text-primary" : "text-text")}>{l.nome}</span>
                    <span className="block text-[11px] leading-snug text-text-light">{l.descricao}</span>
                  </span>
                </button>
              ))}
            </div>
            <input ref={entradaImagem} type="file" accept="image/*" className="sr-only" aria-label="Escolher a imagem de fundo" onChange={(e) => void escolherImagem(e.target.files?.[0])} />
            {layout === "imagem" ? (
              <div className="flex flex-col gap-2 rounded-[var(--radius)] bg-bg-inset/60 p-3">
                <Button variant="secondary" size="sm" onClick={() => entradaImagem.current?.click()}>
                  <ImagePlus className="size-4" aria-hidden="true" />
                  {imagem ? "Trocar a imagem" : "Escolher a imagem de fundo"}
                </Button>
                <p className="text-xs text-text-light">Use uma arte deitada (paisagem). O texto fica num painel branco no centro. A imagem não é enviada ao portal.</p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <Grupo titulo="Título">
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Título" value={textosBase.titulo} maxLength={30} onChange={(e) => mudarTexto("titulo", e.target.value)} />
                <TextField label="Subtítulo" value={textosBase.subtitulo} maxLength={40} onChange={(e) => mudarTexto("subtitulo", e.target.value)} />
              </div>
              <TextField label="Antes do nome" value={textosBase.abertura} maxLength={60} onChange={(e) => mudarTexto("abertura", e.target.value)} />
            </Grupo>
            <Grupo titulo="Texto">
              <AreaDeTexto
                label="Texto do certificado"
                value={textosBase.texto}
                onChange={(v) => mudarTexto("texto", v)}
                dica={
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-text-light">Toque num campo para incluir. Cada certificado troca pelo que é da pessoa. Palavras entre *asteriscos* ficam em destaque.</p>
                    <div className="flex flex-wrap gap-1">
                      {CAMPOS_DO_TEXTO.map((c) => (
                        <button
                          key={c.chave}
                          type="button"
                          title={c.descricao}
                          onClick={() => mudarTexto("texto", `${textosBase.texto}${textosBase.texto.endsWith(" ") ? "" : " "}${c.chave}`.slice(0, 400))}
                          className="min-h-8 rounded-full border border-border px-2.5 font-mono text-[11px] text-text-secondary hover:border-primary/40 hover:text-text"
                        >
                          {c.chave}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              />
              <TextField label="Data" value={textosBase.data} maxLength={40} onChange={(e) => mudarTexto("data", e.target.value)} />
            </Grupo>
            <Grupo titulo="Assinaturas">
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Nome" value={textosBase.assinatura1} maxLength={40} onChange={(e) => mudarTexto("assinatura1", e.target.value)} />
                <TextField label="Cargo" value={textosBase.cargo1} maxLength={50} onChange={(e) => mudarTexto("cargo1", e.target.value)} />
                <TextField label="Segunda assinatura" value={textosBase.assinatura2} maxLength={40} placeholder="Opcional" onChange={(e) => mudarTexto("assinatura2", e.target.value)} />
                <TextField label="Cargo" value={textosBase.cargo2} maxLength={50} onChange={(e) => mudarTexto("cargo2", e.target.value)} />
              </div>
              <p className="text-xs text-text-light">Sem a segunda assinatura, a data ocupa o lugar dela.</p>
            </Grupo>
            <button
              type="button"
              onClick={() => setTextosPorOrigem((t) => ({ ...t, [origem]: undefined }))}
              className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Voltar aos textos padrão
            </button>
          </>
        )}
      </Card>

      <div className="order-first flex min-w-0 flex-col gap-3 lg:order-none lg:sticky lg:top-[84px]">
        <PreviaEscalada largura={W} altura={H}>
          <ArteCertificado ref={arte} layout={layout} textos={textosDe(mostrado)} nome={mostrado.nome} colocacao={mostrado.colocacao} imagem={imagem} />
        </PreviaEscalada>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAtual(Math.max(0, indice - 1))} disabled={indice === 0 || !pessoa} aria-label="Certificado anterior">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <p className="min-w-0 truncate text-center text-sm text-text-secondary">
            {pessoa ? (
              <>
                <span className="font-semibold text-text">{pessoa.nome}</span> · {indice + 1} de {destinatarios.length}
              </>
            ) : (
              "Exemplo: escolha quem recebe para ver cada certificado"
            )}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setAtual(Math.min(destinatarios.length - 1, indice + 1))} disabled={!pessoa || indice >= destinatarios.length - 1} aria-label="Próximo certificado">
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        {layout === "imagem" && !imagem ? <InlineAlert tone="info">Escolha a imagem de fundo em Arte. Sem ela, o certificado sai com o fundo azul.</InlineAlert> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="sm:flex-1" onClick={() => void baixarPdf()} loading={!!gerandoPdf} disabled={!!exportando || destinatarios.length === 0}>
            <FileDown className="size-4" aria-hidden="true" />
            {gerandoPdf ? `Gerando ${gerandoPdf.feitos} de ${gerandoPdf.total}` : destinatarios.length > 1 ? `Baixar PDF com os ${destinatarios.length}` : "Baixar PDF"}
          </Button>
          <Button className="sm:flex-1" variant="secondary" onClick={() => void baixarPng()} loading={exportando === "png"} disabled={!!exportando || !pessoa}>
            <Download className="size-4" aria-hidden="true" />
            Baixar imagem deste
          </Button>
        </div>
        <p className="text-xs text-text-light">PDF em A4 deitado, um certificado por página, pronto para imprimir ou mandar por e-mail.</p>
      </div>

      {/* Lote do PDF: só existe enquanto gera, fora da tela. */}
      {gerandoPdf ? (
        <div aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
          {destinatarios.map((d, i) => (
            <ArteCertificado
              key={d.id}
              ref={(no) => {
                lote.current[i] = no;
              }}
              layout={layout}
              textos={textosDe(d)}
              nome={d.nome}
              colocacao={d.colocacao}
              imagem={imagem}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
