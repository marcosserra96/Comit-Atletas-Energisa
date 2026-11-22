"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileDown, ImagePlus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { hojeBrasil, ordenarTrimestres } from "@/lib/calendarioPremiacao";
import { periodoDoAno } from "@/lib/reuniaoResultados";
import { listarReunioes } from "@/lib/reuniaoCliente";
import { type DadosAnalise } from "@/lib/analises/motor";
import { calcularPremio, novoPremio, type PremioPersonalizado } from "@/lib/premiacaoPersonalizada";
import { destinatariosDoPremio } from "@/lib/certificado";
import { ESTILOS, FORMAS, LARGURA_BASE, ORDEM_FORMATOS, cmParaPt, nomeDoArquivoTrofeu, tamanhoImpresso, type EstiloTrofeu, type FormatoTrofeu, type TextosParticipacao, type TipoPeca } from "@/lib/trofeu";
import { ArteTrofeu, type PessoaDoTrofeu } from "@/components/informativo/ArteTrofeu";
import { EditorPremio } from "@/components/reuniao/EditorPremio";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PreviaEscalada } from "./PreviaEscalada";
import { baixarArquivo, useDadosCertificados, type DadosCertificados } from "./Certificados";
import type { RegrasDeTreino } from "@/lib/activityConsolidation";
import type { DiasTreinoConfigDoc } from "@/lib/aderencia";

const CHAVE = "trofeus:rascunho";
const MODALIDADE = { corrida: "Corrida", bicicleta: "Bike" } as const;

interface Rascunho {
  tipo: TipoPeca;
  formato: FormatoTrofeu;
  estilo: EstiloTrofeu;
  largura: number;
  participacao: TextosParticipacao;
  posicao: "direita" | "atras";
  origem: "premio" | "manual";
  periodoId: string;
  premio: PremioPersonalizado;
  premioManual: string;
  periodoTexto: string;
  campeao: boolean;
  manuais: { id: string; colocacao: number }[];
}

/** Atalhos de premiação: o pódio sai pronto, um por modalidade. */
const ATALHOS: { id: string; nome: string; quantidade: number; criterios?: PremioPersonalizado["criterios"]; titulo: string }[] = [
  { id: "ano-1", nome: "Atleta do ano · campeões", quantidade: 1, titulo: "Atleta do ano" },
  { id: "ano-3", nome: "Atleta do ano · pódio", quantidade: 3, titulo: "Atleta do ano" },
  { id: "pontos-3", nome: "Pódio de pontos", quantidade: 3, titulo: "Pódio de pontos", criterios: [{ id: "c-pontos", medida: "pontos", peso: 100, exibir: "total" }] },
];

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <h3 className="text-sm font-bold text-text">{titulo}</h3>
      {children}
    </section>
  );
}

export function Trofeus() {
  const { dados, regrasTreino, diasTreino, erro } = useDadosCertificados();
  if (erro) return <InlineAlert tone="danger">Não foi possível carregar os dados dos atletas. Recarregue a página para tentar de novo.</InlineAlert>;
  if (!dados || !regrasTreino) {
    return (
      <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start" aria-busy="true">
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-64 w-full" />
        </Card>
        <Skeleton className="order-first aspect-square w-full max-w-xl rounded-[var(--radius-lg)] lg:order-none" />
      </div>
    );
  }
  return <PainelTrofeus dados={dados} regrasTreino={regrasTreino} diasTreino={diasTreino} />;
}

export function PainelTrofeus({ dados, regrasTreino, diasTreino }: { dados: DadosCertificados; regrasTreino: RegrasDeTreino; diasTreino: DiasTreinoConfigDoc | null }) {
  const { show } = useToast();
  const hoje = hojeBrasil();
  const [r, setR] = useState<Rascunho>(() => ({
    tipo: "premiacao",
    formato: "taca",
    estilo: "claro",
    largura: 15,
    participacao: { sobretitulo: "1º Encontro", titulo: "Corrida & Pedal", local: "", data: "" },
    posicao: "direita",
    origem: "premio",
    periodoId: `ano-${hoje.slice(0, 4)}`,
    premio: { ...novoPremio("atleta-do-ano"), periodo: "reuniao", quantidade: 1 },
    premioManual: "Destaque do ano",
    periodoTexto: hoje.slice(0, 4),
    campeao: true,
    manuais: [],
  }));
  const [carregado, setCarregado] = useState(false);
  const [ilustracao, setIlustracao] = useState("");
  const [aba, setAba] = useState<"peca" | "visual">("peca");
  const [atual, setAtual] = useState(0);
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [contorno, setContorno] = useState(true);
  const [exportando, setExportando] = useState<{ feitos: number; total: number } | "png" | null>(null);
  const [premiosSalvos, setPremiosSalvos] = useState<{ chave: string; reuniao: string; premio: PremioPersonalizado }[]>([]);
  const arte = useRef<HTMLDivElement>(null);
  const lote = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const mudar = (campos: Partial<Rascunho>) => setR((x) => ({ ...x, ...campos }));

  // Rascunho lembrado neste aparelho (a ilustração não: fica só nesta visita).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const salvo = window.localStorage.getItem(CHAVE);
        if (salvo) setR((x) => ({ ...x, ...(JSON.parse(salvo) as Partial<Rascunho>) }));
      } catch {
        /* sem armazenamento */
      }
      setCarregado(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    if (!carregado) return;
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(r));
    } catch {
      /* sem armazenamento */
    }
  }, [carregado, r]);
  useEffect(() => {
    listarReunioes()
      .then((rs) => setPremiosSalvos(rs.flatMap((x) => (x.premios ?? []).map((p) => ({ chave: `${x.id}:${p.id}`, reuniao: x.titulo, premio: p })))))
      .catch(() => setPremiosSalvos([]));
  }, []);
  useEffect(() => () => void (ilustracao && URL.revokeObjectURL(ilustracao)), [ilustracao]);

  const periodos = useMemo(() => {
    const trimestres = ordenarTrimestres(dados.calendario.trimestres);
    const anos = [...new Set([hoje.slice(0, 4), ...trimestres.map((t) => t.inicio.slice(0, 4))])].sort().reverse();
    return [
      ...anos.map((ano) => ({ id: `ano-${ano}`, ...periodoDoAno(trimestres, ano), texto: ano })),
      ...trimestres
        .filter((t) => t.inicio <= hoje)
        .reverse()
        .map((t) => ({ id: t.id, nome: t.nome, inicio: t.inicio, fim: t.fim, texto: t.nome })),
    ];
  }, [dados, hoje]);
  const periodo = periodos.find((p) => p.id === r.periodoId) ?? periodos[0];
  const dadosAnalise: DadosAnalise = useMemo(() => ({ atletas: dados.atletas, lancamentos: dados.lancamentos, resumos: dados.resumos, regrasTreino, diasTreino, hoje }), [dados, regrasTreino, diasTreino, hoje]);
  const resultado = useMemo(() => (r.tipo === "premiacao" && r.origem === "premio" && periodo ? calcularPremio(r.premio, dadosAnalise, periodo) : undefined), [r.tipo, r.origem, r.premio, dadosAnalise, periodo]);

  /** Uma peça por pessoa (premiação) ou uma peça só (participação). */
  const candidatos: (PessoaDoTrofeu & { id: string })[] = useMemo(() => {
    if (r.tipo === "participacao") return [];
    if (r.origem === "premio") {
      return resultado ? destinatariosDoPremio(r.premio, resultado).map((d) => ({ id: d.id, nome: d.nome, modalidade: d.equipe ? MODALIDADE[d.equipe] : undefined, colocacao: d.colocacao })) : [];
    }
    const porId = new Map(dados.atletas.map((a) => [a.id, a]));
    return r.manuais.flatMap((m) => {
      const a = porId.get(m.id);
      return a ? [{ id: m.id, nome: a.nome, modalidade: a.equipe === "bicicleta" ? "Bike" : a.equipe === "corrida" ? "Corrida" : undefined, colocacao: m.colocacao || undefined }] : [];
    });
  }, [r.tipo, r.origem, r.premio, r.manuais, resultado, dados.atletas]);
  const pessoas = candidatos.filter((c) => !excluidos.has(c.id));
  const indice = Math.min(atual, Math.max(0, pessoas.length - 1));
  const exemplo = { id: "exemplo", nome: "Nome do atleta", modalidade: "Corrida", colocacao: 1 };
  const pessoa = pessoas[indice] ?? exemplo;
  const tituloPremio = r.origem === "premio" ? r.premio.titulo : r.premioManual;
  const textosPremiacao = { premio: tituloPremio, periodo: r.periodoTexto };
  const tam = tamanhoImpresso(r.formato, r.largura);
  const H = FORMAS[r.formato].altura;
  const totalPecas = r.tipo === "participacao" ? 1 : pessoas.length;

  const arteDe = (p: PessoaDoTrofeu, mostrarContorno: boolean, ref?: React.Ref<HTMLDivElement>) =>
    r.tipo === "participacao" ? (
      <ArteTrofeu ref={ref} formato={r.formato} estilo={r.estilo} tipo="participacao" textos={r.participacao} ilustracao={ilustracao || undefined} posicaoIlustracao={r.posicao} contornoVisivel={mostrarContorno} />
    ) : (
      <ArteTrofeu ref={ref} formato={r.formato} estilo={r.estilo} tipo="premiacao" textos={textosPremiacao} pessoa={p} campeao={r.campeao} contornoVisivel={mostrarContorno} />
    );

  const nomeArquivo = (p: PessoaDoTrofeu, ext: "png" | "pdf") =>
    r.tipo === "participacao" ? nomeDoArquivoTrofeu(["trofeu", r.participacao.titulo, `${r.largura}cm`], ext) : nomeDoArquivoTrofeu(["trofeu", tituloPremio, p.modalidade, p.colocacao, p.nome.split(" ")[0]], ext);

  async function gerarPng(no: HTMLDivElement, fontEmbedCSS?: string) {
    const { toBlob } = await import("html-to-image");
    // Tamanho real a 300 dpi; fora do contorno fica transparente.
    return toBlob(no, { width: LARGURA_BASE, height: H, pixelRatio: tam.escala, fontEmbedCSS, cacheBust: true });
  }

  async function baixarPng() {
    if (!arte.current) return;
    setExportando("png");
    try {
      const { getFontEmbedCSS } = await import("html-to-image");
      await document.fonts.ready;
      const blob = await gerarPng(arte.current, await getFontEmbedCSS(arte.current));
      if (!blob) throw new Error("sem imagem");
      baixarArquivo(blob, nomeArquivo(pessoa, "png"));
      show("success", "Imagem baixada em alta qualidade.");
    } catch {
      show("error", "Não foi possível gerar a imagem agora. Tente novamente.");
    } finally {
      setExportando(null);
    }
  }

  async function baixarPdf() {
    setExportando({ feitos: 0, total: totalPecas });
    try {
      const [{ getFontEmbedCSS }, { pdf, Document, Page, Image }, { createElement }] = await Promise.all([import("html-to-image"), import("@react-pdf/renderer"), import("react")]);
      await new Promise((ok) => window.setTimeout(ok, 300));
      await document.fonts.ready;
      const nos = [...(lote.current?.children ?? [])].map((c) => c.firstElementChild).filter((n): n is HTMLDivElement => n instanceof HTMLDivElement);
      await Promise.all(nos.flatMap((n) => [...n.querySelectorAll("img")].map((img) => (img.complete ? null : new Promise((ok) => (img.onload = img.onerror = ok))))));
      const fontEmbedCSS = nos[0] ? await getFontEmbedCSS(nos[0]) : undefined;
      const paginas: string[] = [];
      for (const [i, no] of nos.entries()) {
        const blob = await gerarPng(no, fontEmbedCSS);
        if (!blob) throw new Error("sem imagem");
        paginas.push(await new Promise<string>((ok) => {
          const leitor = new FileReader();
          leitor.onload = () => ok(String(leitor.result));
          leitor.readAsDataURL(blob);
        }));
        setExportando({ feitos: i + 1, total: nos.length });
      }
      // Cada página no tamanho exato da peça (em cm), uma peça por página.
      const largura = cmParaPt(tam.larguraCm);
      const altura = cmParaPt(tam.alturaCm);
      const documento = createElement(
        Document,
        { title: r.tipo === "participacao" ? r.participacao.titulo : tituloPremio, author: "Comitê Atletas Energisa" },
        ...paginas.map((src, i) => createElement(Page, { key: i, size: { width: largura, height: altura }, style: { padding: 0 } }, createElement(Image, { src, style: { width: largura, height: altura } }))),
      );
      const blob = await pdf(documento).toBlob();
      baixarArquivo(blob, nomeDoArquivoTrofeu(["trofeus", r.tipo === "participacao" ? r.participacao.titulo : tituloPremio, `${r.largura}cm`], "pdf"));
      show("success", totalPecas === 1 ? "PDF baixado, pronto para a gráfica." : `${totalPecas} peças num PDF, prontas para a gráfica.`);
    } catch {
      show("error", "Não foi possível gerar o PDF agora. Tente novamente.");
    } finally {
      setExportando(null);
    }
  }

  const gerandoPdf = exportando && exportando !== "png" ? exportando : null;
  const atletasParaEscolher = dados.atletas
    .filter((a) => (a.equipe === "corrida" || a.equipe === "bicicleta") && a.visivelNasListas !== false && !r.manuais.some((m) => m.id === a.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start">
      <Card className="flex flex-col gap-4">
        <SegmentedControl
          value={aba}
          onChange={setAba}
          className="w-full [&>button]:flex-1"
          options={[
            { value: "peca", label: "Peça e textos" },
            { value: "visual", label: "Formato e estilo" },
          ]}
        />

        {aba === "peca" ? (
          <>
            <Grupo titulo="Tipo">
              <SegmentedControl
                value={r.tipo}
                onChange={(tipo) => {
                  mudar({ tipo });
                  setAtual(0);
                }}
                className="w-full [&>button]:flex-1"
                options={[
                  { value: "premiacao", label: "Premiação" },
                  { value: "participacao", label: "Participação em evento" },
                ]}
              />
            </Grupo>

            {r.tipo === "participacao" ? (
              <Grupo titulo="Textos do evento">
                <TextField label="Linha de cima" value={r.participacao.sobretitulo} maxLength={30} placeholder="Ex.: 1º Encontro" onChange={(e) => mudar({ participacao: { ...r.participacao, sobretitulo: e.target.value } })} />
                <TextField label="Nome do evento" value={r.participacao.titulo} maxLength={40} placeholder="Ex.: Corrida & Pedal" onChange={(e) => mudar({ participacao: { ...r.participacao, titulo: e.target.value } })} />
                <TextField label="Local" value={r.participacao.local} maxLength={60} placeholder="Ex.: Museu Parque Usina Maurício" onChange={(e) => mudar({ participacao: { ...r.participacao, local: e.target.value } })} />
                <TextField label="Data" value={r.participacao.data} maxLength={30} placeholder="Ex.: 21/06/2026" onChange={(e) => mudar({ participacao: { ...r.participacao, data: e.target.value } })} />
                <div className="flex flex-col gap-2 rounded-[var(--radius)] bg-bg-inset/60 p-3">
                  <p className="text-sm font-medium text-text">Ilustração do local (opcional)</p>
                  <p className="text-xs text-text-light [text-wrap:pretty]">
                    Fica melhor um desenho em traço com fundo transparente (PNG). Para pedir ao GPT: “ilustração em traço fino azul do [local], estilo desenho técnico, fundo transparente, sem texto”.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => entrada.current?.click()}>
                      <ImagePlus className="size-4" aria-hidden="true" />
                      {ilustracao ? "Trocar a ilustração" : "Escolher a ilustração"}
                    </Button>
                    {ilustracao ? (
                      <Button size="sm" variant="ghost" onClick={() => setIlustracao("")}>
                        <Trash2 className="size-4" aria-hidden="true" />
                        Tirar
                      </Button>
                    ) : null}
                  </div>
                  {ilustracao && (r.formato === "facetado" || r.formato === "placa") ? (
                    <SegmentedControl
                      value={r.posicao}
                      onChange={(posicao) => mudar({ posicao })}
                      className="w-full [&>button]:flex-1"
                      options={[
                        { value: "direita", label: "Ao lado do texto" },
                        { value: "atras", label: "Atrás, suave" },
                      ]}
                    />
                  ) : null}
                  <input
                    ref={entrada}
                    type="file"
                    accept="image/png,image/webp,image/jpeg,image/svg+xml"
                    className="sr-only"
                    aria-label="Escolher a ilustração"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setIlustracao(URL.createObjectURL(f));
                      e.target.value = "";
                    }}
                  />
                </div>
              </Grupo>
            ) : (
              <>
                <Grupo titulo="Quem recebe">
                  <SegmentedControl
                    value={r.origem}
                    onChange={(origem) => {
                      mudar({ origem });
                      setExcluidos(new Set());
                      setAtual(0);
                    }}
                    className="w-full [&>button]:flex-1"
                    options={[
                      { value: "premio", label: "Pelos critérios" },
                      { value: "manual", label: "Escolher atletas" },
                    ]}
                  />
                  {r.origem === "premio" ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {ATALHOS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              const base = novoPremio("atleta-do-ano");
                              mudar({ premio: { ...base, titulo: a.titulo, periodo: "reuniao", equipe: "separadas", quantidade: a.quantidade, criterios: a.criterios ?? base.criterios } });
                              setExcluidos(new Set());
                            }}
                            className="min-h-9 rounded-full border border-border px-3 text-xs font-semibold text-text-secondary hover:border-primary/40 hover:bg-bg-inset/60 hover:text-text"
                          >
                            {a.nome}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-text">Período dos números</span>
                        <Select value={periodo?.id ?? ""} onChange={(e) => mudar({ periodoId: e.target.value, periodoTexto: periodos.find((p) => p.id === e.target.value)?.texto ?? r.periodoTexto })} aria-label="Período">
                          {periodos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {premiosSalvos.length > 0 ? (
                        <Select
                          value=""
                          placeholder="Usar um prêmio de uma reunião"
                          aria-label="Usar um prêmio de uma reunião"
                          onChange={(e) => {
                            const p = premiosSalvos.find((x) => x.chave === e.target.value)?.premio;
                            if (p) mudar({ premio: { ...p, criterios: p.criterios.map((c) => ({ ...c })) } });
                          }}
                        >
                          {premiosSalvos.map((x) => (
                            <option key={x.chave} value={x.chave}>
                              {`${x.premio.titulo} · ${x.reuniao}`}
                            </option>
                          ))}
                        </Select>
                      ) : null}
                      <EditorPremio premio={r.premio} resultado={resultado} onChange={(premio) => mudar({ premio })} embutido />
                    </>
                  ) : (
                    <>
                      <TextField label="Nome do prêmio" value={r.premioManual} maxLength={40} onChange={(e) => mudar({ premioManual: e.target.value })} />
                      <Select value="" searchable placeholder="Buscar atleta para incluir" aria-label="Incluir atleta" onChange={(e) => e.target.value && mudar({ manuais: [...r.manuais, { id: e.target.value, colocacao: 1 }] })}>
                        {atletasParaEscolher.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome}
                          </option>
                        ))}
                      </Select>
                    </>
                  )}
                </Grupo>

                <Grupo titulo={`Peças · ${pessoas.length}`}>
                  {candidatos.length === 0 ? (
                    <p className="rounded-[var(--radius)] bg-bg-inset/60 px-3 py-2.5 text-sm text-text-light">{r.origem === "manual" ? "Busque e inclua os atletas acima." : "Ninguém pontuou nesses critérios no período."}</p>
                  ) : (
                    <ul className="flex max-h-72 flex-col divide-y divide-border-subtle overflow-y-auto rounded-[var(--radius)] border border-border">
                      {candidatos.map((c) => {
                        const fora = excluidos.has(c.id);
                        const pos = pessoas.findIndex((x) => x.id === c.id);
                        const manual = r.manuais.find((m) => m.id === c.id);
                        return (
                          <li key={c.id} className={cn("flex items-center gap-2 bg-bg-card pl-3 pr-1", pos === indice && !fora && "bg-primary-subtle/60")}>
                            {r.origem === "premio" ? (
                              <input
                                type="checkbox"
                                checked={!fora}
                                aria-label={`Incluir ${c.nome}`}
                                onChange={() =>
                                  setExcluidos((s) => {
                                    const n = new Set(s);
                                    if (n.has(c.id)) n.delete(c.id);
                                    else n.add(c.id);
                                    return n;
                                  })
                                }
                                className="size-4 shrink-0 accent-[var(--color-primary)]"
                              />
                            ) : null}
                            <button type="button" disabled={fora} onClick={() => setAtual(pos)} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center text-left disabled:opacity-50">
                              <span className="truncate text-sm font-semibold text-text">{c.nome}</span>
                              <span className="truncate text-xs text-text-light">{[c.colocacao ? `${c.colocacao}º lugar` : "", c.modalidade].filter(Boolean).join(" · ")}</span>
                            </button>
                            {manual ? (
                              <>
                                <select
                                  value={manual.colocacao}
                                  onChange={(e) => mudar({ manuais: r.manuais.map((m) => (m.id === c.id ? { ...m, colocacao: Number(e.target.value) } : m)) })}
                                  aria-label={`Colocação de ${c.nome}`}
                                  className="h-9 rounded-[var(--radius-sm)] border border-border bg-bg-card px-1.5 text-xs text-text"
                                >
                                  <option value={1}>1º</option>
                                  <option value={2}>2º</option>
                                  <option value={3}>3º</option>
                                  <option value={0}>Sem</option>
                                </select>
                                <button type="button" onClick={() => mudar({ manuais: r.manuais.filter((m) => m.id !== c.id) })} aria-label={`Tirar ${c.nome}`} className="flex size-9 shrink-0 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger">
                                  <X className="size-4" aria-hidden="true" />
                                </button>
                              </>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Grupo>

                <Grupo titulo="Textos">
                  <TextField label="Linha de cima" value={r.periodoTexto} maxLength={30} placeholder="Ex.: 2026" onChange={(e) => mudar({ periodoTexto: e.target.value })} />
                  <label className="flex items-center gap-3 text-sm text-text">
                    <Switch ativo={r.campeao} onChange={(campeao) => mudar({ campeao })} rotulo="1º lugar como Campeão" />
                    Escrever “Campeão” no 1º lugar
                  </label>
                </Grupo>
              </>
            )}
          </>
        ) : (
          <>
            <Grupo titulo="Formato de corte">
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Formato de corte">
                {ORDEM_FORMATOS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={r.formato === f}
                    onClick={() => mudar({ formato: f })}
                    title={FORMAS[f].descricao}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-[var(--radius)] p-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      r.formato === f ? "bg-primary-subtle text-primary ring-2 ring-primary" : "text-text-secondary hover:bg-bg-inset",
                    )}
                  >
                    <svg viewBox={`0 0 ${LARGURA_BASE} ${FORMAS[f].altura}`} className="h-14 w-auto" aria-hidden="true">
                      <path d={FORMAS[f].contorno} className={r.formato === f ? "fill-primary/20 stroke-primary" : "fill-bg-inset stroke-text-muted"} strokeWidth={24} />
                    </svg>
                    {FORMAS[f].nome}
                  </button>
                ))}
              </div>
            </Grupo>
            <Grupo titulo="Estilo">
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Estilo">
                {ESTILOS.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={r.estilo === e.id}
                    onClick={() => mudar({ estilo: e.id })}
                    title={e.descricao}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-[var(--radius)] p-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      r.estilo === e.id ? "bg-primary-subtle text-primary ring-2 ring-primary" : "text-text-secondary hover:bg-bg-inset",
                    )}
                  >
                    <span className={cn("block h-10 w-full rounded-[6px] ring-1 ring-border", e.id === "claro" ? "bg-white" : e.id === "marinho" ? "bg-[#071b36]" : "bg-[#fbf7ee]")}>
                      <span className={cn("mx-auto mt-4 block h-1.5 w-2/3 rounded-full", e.id === "dourado" ? "bg-[#c9973a]" : "bg-[linear-gradient(90deg,#1580b0,#9cc31f,#f37021)]")} />
                    </span>
                    {e.nome}
                  </button>
                ))}
              </div>
            </Grupo>
            <Grupo titulo="Tamanho na impressão">
              <div className="flex items-end gap-3">
                <div className="w-32">
                  <TextField label="Largura (cm)" type="number" inputMode="decimal" min={4} max={60} step={0.5} value={String(r.largura)} onChange={(e) => mudar({ largura: Math.min(60, Math.max(4, Number(e.target.value) || 15)) })} />
                </div>
                <p className="pb-2.5 text-sm text-text-secondary">
                  × {String(tam.alturaCm).replace(".", ",")} cm de altura
                </p>
              </div>
              <p className="text-xs text-text-light">
                {tam.larguraPx} × {tam.alturaPx} px a 300 dpi. Fora do contorno, o fundo sai transparente. A altura acompanha o formato.
              </p>
            </Grupo>
          </>
        )}
      </Card>

      <div className="order-first flex min-w-0 flex-col gap-3 lg:order-none lg:sticky lg:top-[84px]">
        <div className="mx-auto w-full max-w-[min(100%,560px)] rounded-[var(--radius-lg)] bg-[repeating-conic-gradient(#e7edf4_0_25%,#f6f9fc_0_50%)] bg-[length:24px_24px] p-4">
          <PreviaEscalada largura={LARGURA_BASE} altura={H}>
            {arteDe(pessoa, contorno, arte)}
          </PreviaEscalada>
        </div>
        {r.tipo === "premiacao" ? (
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAtual(Math.max(0, indice - 1))} disabled={indice === 0 || !pessoas.length} aria-label="Peça anterior">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <p className="min-w-0 truncate text-center text-sm text-text-secondary">
              {pessoas.length ? (
                <>
                  <span className="font-semibold text-text">{pessoa.nome}</span> · {indice + 1} de {pessoas.length}
                </>
              ) : (
                "Exemplo: escolha quem recebe para ver cada peça"
              )}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setAtual(Math.min(pessoas.length - 1, indice + 1))} disabled={!pessoas.length || indice >= pessoas.length - 1} aria-label="Próxima peça">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
        <label className="flex items-center gap-2 self-center text-xs text-text-light">
          <Switch ativo={contorno} onChange={setContorno} rotulo="Mostrar a linha de corte" />
          Mostrar a linha de corte (só na tela)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="sm:flex-1" onClick={() => void baixarPdf()} loading={!!gerandoPdf} disabled={!!exportando || totalPecas === 0}>
            <FileDown className="size-4" aria-hidden="true" />
            {gerandoPdf ? `Gerando ${gerandoPdf.feitos} de ${gerandoPdf.total}` : totalPecas > 1 ? `PDF para a gráfica (${totalPecas} peças)` : "PDF para a gráfica"}
          </Button>
          <Button className="sm:flex-1" variant="secondary" onClick={() => void baixarPng()} loading={exportando === "png"} disabled={!!exportando || (r.tipo === "premiacao" && !pessoas.length)}>
            <Download className="size-4" aria-hidden="true" />
            PNG desta peça
          </Button>
        </div>
        <p className="text-xs text-text-light">
          Cada página do PDF tem o tamanho exato da peça ({String(tam.larguraCm).replace(".", ",")} × {String(tam.alturaCm).replace(".", ",")} cm) a 300 dpi, uma peça por página. A gráfica imprime em adesivo branco, cola no acrílico e corta no contorno.
        </p>
      </div>

      {gerandoPdf ? (
        <div ref={lote} aria-hidden="true" style={{ position: "fixed", left: -30000, top: 0, pointerEvents: "none" }}>
          {(r.tipo === "participacao" ? [exemplo] : pessoas).map((p, i) => (
            <div key={`${p.id}-${i}`}>
              {arteDe(p, false)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
