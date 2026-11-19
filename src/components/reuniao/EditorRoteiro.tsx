"use client";

import { useId, useRef, useState } from "react";
import { Award, BarChart3, Bold, ChevronDown, Copy, ImagePlus, Images, LayoutTemplate, MessageSquareQuote, Plus, Sparkles, GripVertical, Trash2, TrendingUp, Trophy, Type } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FormatacaoLivre } from "@/components/reuniao/FormatacaoLivre";
import { EditorPremio } from "@/components/reuniao/EditorPremio";
import { novoPremio, pesosNormalizados, rotuloDoCriterio, type PremioPersonalizado, type ResultadoPremio } from "@/lib/premiacaoPersonalizada";
import { cn } from "@/lib/cn";
import { IMAGEM_SLIDE_LADO } from "@/lib/fotoRegras";
import { reduzirImagem } from "@/lib/fotos";
import { enviarImagemSlide, guardarImagemNoCache } from "@/lib/reuniaoCliente";
import {
  CAMPOS_DE_TEXTO,
  CATEGORIAS_DESTAQUE,
  categoriasDaSecao,
  nomeDaSecao,
  novoSlideLivre,
  SECOES_COM_PERIODO,
  TEXTOS_PADRAO,
  TITULO_SECAO,
  type ReuniaoResultadosDoc,
  type SecaoReuniao,
  type SlideLivre,
  type TipoSecao,
} from "@/lib/reuniaoResultados";
import { EditorRetrospectiva } from "@/components/reuniao/EditorRetrospectiva";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Switch } from "@/components/ui/Switch";

type Roteiro = Pick<ReuniaoResultadosDoc, "secoes" | "livres"> & Partial<Pick<ReuniaoResultadosDoc, "textos" | "tempos" | "contagem" | "premios">>;

/** Minutos planejados para a seção (a tela do apresentador avisa quando passa). */
function TempoPlanejado({ minutos, onChange }: { minutos?: number; onChange: (m: number | null) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-text">
        Tempo planejado
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={180}
        step={0.5}
        value={minutos ?? ""}
        placeholder="—"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="h-9 w-20 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <span className="text-sm text-text-light">min</span>
    </div>
  );
}

/** Seção automática aberta: textos fixos do slide e, na contagem, os minutos. */
function EditorSecao({
  secao,
  roteiro,
  onChange,
}: {
  secao: SecaoReuniao;
  roteiro: Roteiro;
  onChange: (r: Partial<Roteiro>) => void;
}) {
  const campos = secao.tipo === "livre" ? [] : (CAMPOS_DE_TEXTO[secao.tipo] ?? []);
  const textos = roteiro.textos ?? {};
  const mudarTexto = (chave: string, valor: string) => {
    const novo = { ...textos };
    if (valor.trim()) novo[chave] = valor;
    else delete novo[chave];
    onChange({ textos: novo });
  };
  const mudarSecao = (campos: Partial<SecaoReuniao>) => onChange({ secoes: roteiro.secoes.map((x) => (x.id === secao.id ? { ...x, ...campos } : x)) });
  const categorias = categoriasDaSecao(secao);
  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle px-3 pb-3 pt-3">
      {SECOES_COM_PERIODO.includes(secao.tipo) ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Números de</span>
          <SegmentedControl
            value={secao.periodo === "ano" ? "ano" : "reuniao"}
            onChange={(v) => mudarSecao({ periodo: v === "ano" ? "ano" : undefined })}
            className="w-full [&>button]:flex-1"
            options={[
              { value: "reuniao", label: "Período da reunião" },
              { value: "ano", label: "Ano até agora" },
            ]}
          />
          {secao.periodo === "ano" ? <p className="text-xs text-text-light">Do começo do ano até o fim do período da reunião, comparado com o mesmo trecho do ano anterior.</p> : null}
        </div>
      ) : null}
      {secao.tipo === "destaques" ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium text-text">Quais destaques entram</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {CATEGORIAS_DESTAQUE.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] border border-border px-2.5 py-2 text-sm hover:bg-bg-inset/60">
                <input
                  type="checkbox"
                  checked={categorias.has(c.id)}
                  onChange={(e) => {
                    const novo = new Set(categorias);
                    if (e.target.checked) novo.add(c.id);
                    else novo.delete(c.id);
                    mudarSecao({ destaques: CATEGORIAS_DESTAQUE.filter((x) => novo.has(x.id)).map((x) => x.id) });
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-text">{c.nome}</span>
                  <span className="block text-xs text-text-light">{c.descricao}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-text-light">Categoria sem ninguém no período não aparece. Até 4 cartões por slide.</p>
        </fieldset>
      ) : null}
      {campos.map((c) => (
        <TextField
          key={c.chave}
          label={c.rotulo}
          value={textos[c.chave] ?? ""}
          placeholder={TEXTOS_PADRAO[c.chave]}
          maxLength={80}
          onChange={(e) => mudarTexto(c.chave, e.target.value)}
        />
      ))}
      {secao.tipo === "contagem" ? (
        <div className="flex items-center gap-2">
          <label htmlFor={`contagem-${secao.id}`} className="text-sm font-medium text-text">
            Contar
          </label>
          <input
            id={`contagem-${secao.id}`}
            type="number"
            min={1}
            max={60}
            value={roteiro.contagem?.minutos ?? 5}
            onChange={(e) => onChange({ contagem: { minutos: Math.min(60, Math.max(1, Number(e.target.value) || 5)) } })}
            className="h-9 w-20 rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-sm tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <span className="text-sm text-text-light">min, ou até o horário da reunião da agenda</span>
        </div>
      ) : null}
      {campos.some((c) => textos[c.chave]) ? (
        <button type="button" onClick={() => onChange({ textos: Object.fromEntries(Object.entries(textos).filter(([k]) => !campos.some((c) => c.chave === k))) })} className="self-start text-xs font-semibold text-text-light hover:text-text">
          Voltar aos textos padrão
        </button>
      ) : null}
      {secao.tipo !== "contagem" ? <TempoPlanejado minutos={roteiro.tempos?.[secao.id]} onChange={(m) => onChange({ tempos: tempoNovo(roteiro.tempos, secao.id, m) })} /> : null}
    </div>
  );
}

function tempoNovo(tempos: Record<string, number> | undefined, id: string, m: number | null) {
  const novo = { ...(tempos ?? {}) };
  if (m && m > 0) novo[id] = Math.min(180, m);
  else delete novo[id];
  return novo;
}

function EditorLivre({
  livre,
  imagem,
  onChange,
}: {
  livre: SlideLivre;
  imagem?: string;
  onChange: (l: SlideLivre) => void;
}) {
  const { show } = useToast();
  const idTexto = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const campoTexto = useRef<HTMLTextAreaElement>(null);

  /** Negrito: põe ** em volta do trecho selecionado (ou insere um par para digitar dentro). */
  function negrito() {
    const t = campoTexto.current;
    if (!t) return;
    const { selectionStart: a, selectionEnd: b, value } = t;
    const trecho = value.slice(a, b);
    const novo = `${value.slice(0, a)}**${trecho || "texto"}**${value.slice(b)}`;
    onChange({ ...livre, texto: novo.slice(0, 1500) });
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(a + 2, a + 2 + (trecho || "texto").length);
    });
  }
  const [enviando, setEnviando] = useState(false);
  const conteudo = livre.layout === "conteudo";
  const enquete = livre.layout === "enquete";

  async function escolherImagem(arquivo?: File) {
    if (!arquivo) return;
    setEnviando(true);
    try {
      const dataUrl = await reduzirImagem(arquivo, { lado: IMAGEM_SLIDE_LADO, qualidade: 0.85 });
      const id = await enviarImagemSlide(dataUrl);
      guardarImagemNoCache(id, dataUrl);
      onChange({ ...livre, imagemId: id });
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  const seletorDeFoto = (
    <div className="flex items-center gap-3">
      {imagem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagem} alt="" className={cn("border border-border object-cover", livre.layout === "fala" ? "size-14 rounded-full" : "h-14 w-24 rounded-[var(--radius-sm)]")} />
      ) : null}
      <input ref={entrada} type="file" accept="image/*" className="sr-only" onChange={(e) => void escolherImagem(e.target.files?.[0])} aria-label="Escolher imagem" />
      <Button type="button" size="sm" variant="secondary" loading={enviando} onClick={() => entrada.current?.click()}>
        <ImagePlus className="size-4" aria-hidden="true" />
        {livre.imagemId ? (livre.layout === "fala" ? "Trocar a foto" : "Trocar imagem") : livre.layout === "fala" ? "Adicionar a foto" : "Adicionar imagem"}
      </Button>
      {livre.imagemId ? (
        <button type="button" onClick={() => onChange({ ...livre, imagemId: null })} className="min-h-9 text-xs font-semibold text-text-light hover:text-danger">
          {livre.layout === "fala" ? "Tirar a foto" : "Tirar imagem"}
        </button>
      ) : null}
    </div>
  );

  if (livre.layout === "fala") {
    return (
      <div className="flex flex-col gap-3 border-t border-border-subtle px-3 pb-3 pt-3">
        <TextField label="Nome" value={livre.titulo} maxLength={60} placeholder="Ex.: Maria Souza" onChange={(e) => onChange({ ...livre, titulo: e.target.value })} />
        <TextField label="Cargo ou papel" value={livre.sobretitulo} maxLength={60} placeholder="Ex.: Diretora de Gente e Gestão" onChange={(e) => onChange({ ...livre, sobretitulo: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idTexto} className="text-sm font-medium text-text">
            Frase <span className="font-normal text-text-muted">(opcional; sem frase, o nome aparece grande)</span>
          </label>
          <textarea
            id={idTexto}
            rows={3}
            maxLength={300}
            value={livre.texto}
            placeholder="Ex.: Ver o time crescer a cada trimestre é a melhor parte do programa."
            onChange={(e) => onChange({ ...livre, texto: e.target.value })}
            className="w-full resize-y rounded-[var(--radius)] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        {seletorDeFoto}
        <p className="text-xs text-text-light">Funciona melhor com uma foto do rosto, de frente. Ela é recortada em círculo.</p>
      </div>
    );
  }
  if (livre.layout === "retrospectiva") return <EditorRetrospectiva livre={livre} onChange={onChange} />;

  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle px-3 pb-3 pt-3">
      <div className="flex gap-1 rounded-[var(--radius)] bg-bg-inset p-1" role="radiogroup" aria-label="Tipo do slide">
        {(
          [
            { v: "divisoria", t: "Divisória", d: "Título grande", I: Type },
            { v: "conteudo", t: "Conteúdo", d: "Lista e/ou imagem", I: LayoutTemplate },
            { v: "enquete", t: "Enquete", d: "Votação ao vivo", I: BarChart3 },
          ] as const
        ).map(({ v, t, I }) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={livre.layout === v}
            onClick={() => onChange({ ...livre, layout: v })}
            className={cn(
              "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] text-xs font-semibold transition-colors",
              livre.layout === v ? "bg-bg-card text-text shadow-sm" : "text-text-light hover:text-text",
            )}
          >
            <I className="size-3.5" aria-hidden="true" />
            {t}
          </button>
        ))}
      </div>
      {conteudo || enquete ? null : (
        <TextField
          label="Linha de cima (laranja)"
          value={livre.sobretitulo}
          maxLength={60}
          placeholder="Ex.: Fala da"
          onChange={(e) => onChange({ ...livre, sobretitulo: e.target.value })}
        />
      )}
      <TextField
        label={enquete ? "Pergunta" : conteudo ? "Título" : "Título (azul)"}
        value={livre.titulo}
        maxLength={enquete ? 140 : 120}
        placeholder={enquete ? "Ex.: Qual prova fazemos no próximo trimestre?" : conteudo ? "Ex.: Relembrando nossos combinados" : "Ex.: Diretoria"}
        onChange={(e) => onChange({ ...livre, titulo: e.target.value })}
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-end justify-between gap-2">
          <label htmlFor={idTexto} className="text-sm font-medium text-text">
            {enquete ? (
              <>
                Opções <span className="font-normal text-text-muted">(uma por linha, de 2 a 6)</span>
              </>
            ) : (
              <>
                {conteudo ? "Itens (um por linha)" : "Texto abaixo do título"} <span className="font-normal text-text-muted">(opcional)</span>
              </>
            )}
          </label>
          <button
            type="button"
            hidden={enquete}
            onClick={negrito}
            title="Negrito: selecione o trecho e toque aqui"
            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border text-text-light hover:border-border-strong hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Bold className="size-4" aria-hidden="true" />
            <span className="sr-only">Negrito</span>
          </button>
        </div>
        <textarea
          ref={campoTexto}
          id={idTexto}
          rows={conteudo || enquete ? 5 : 2}
          maxLength={1500}
          value={livre.texto}
          onChange={(e) => onChange({ ...livre, texto: e.target.value })}
          className="w-full resize-y rounded-[var(--radius)] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        {livre.texto.includes("**") ? <p className="text-xs text-text-muted">O que está entre ** aparece em negrito no slide.</p> : null}
      </div>
      {conteudo ? seletorDeFoto : null}
      {enquete ? (
        <p className="text-xs text-text-light">
          Na apresentação, toque em <span className="font-semibold">Abrir votação</span>: aparece um QR code e os atletas votam pelo app, com o resultado ao vivo no telão. Precisa da permissão Pesquisas.
        </p>
      ) : (
        <FormatacaoLivre livre={livre} temImagem={!!livre.imagemId} onChange={onChange} />
      )}
    </div>
  );
}

type OpcaoGaleria = { titulo: string; descricao: string; icone: typeof Type } & ({ livre: SlideLivre["layout"] } | { secao: TipoSecao; periodo?: "ano" } | { premio: true });

const GRUPOS_GALERIA: { titulo: string; opcoes: OpcaoGaleria[] }[] = [
  {
    titulo: "Escritos pelo comitê",
    opcoes: [
      { livre: "divisoria", titulo: "Divisória", descricao: "Título grande para abrir um assunto", icone: Type },
      { livre: "conteudo", titulo: "Conteúdo", descricao: "Lista de itens e uma imagem", icone: LayoutTemplate },
      { livre: "fala", titulo: "Fala de uma pessoa", descricao: "Foto, nome, cargo e uma frase", icone: MessageSquareQuote },
      { livre: "retrospectiva", titulo: "Retrospectiva", descricao: "Fotos de uma pasta do computador, com efeitos", icone: Images },
      { livre: "enquete", titulo: "Enquete", descricao: "Votação ao vivo pelo celular", icone: BarChart3 },
    ],
  },
  {
    titulo: "Números do portal",
    opcoes: [
      { secao: "resultados", periodo: "ano", titulo: "Resultados do ano", descricao: "Treinos, pontos e km do ano até agora", icone: TrendingUp },
      { secao: "destaques", periodo: "ano", titulo: "Destaques do ano", descricao: "Quem se destacou no ano até agora", icone: Sparkles },
      { premio: true, titulo: "Premiação com critérios", descricao: "Atleta do ano e outros prêmios, com os pesos que você define", icone: Trophy },
      { secao: "premiacao", periodo: "ano", titulo: "Premiação do ano", descricao: "Pódio e classificação do ano até agora", icone: Award },
      { secao: "destaques", titulo: "Mais destaques do período", descricao: "Outro slide com outras categorias", icone: Sparkles },
    ],
  },
];

/** Galeria para incluir slides: os escritos pelo comitê e os de números (inclusive do ano). */
function GaleriaDeSlides({
  aberta,
  onFechar,
  onLivre,
  onSecao,
  onPremio,
}: {
  aberta: boolean;
  onFechar: () => void;
  onLivre: (layout: SlideLivre["layout"]) => void;
  onSecao: (tipo: TipoSecao, periodo?: "ano") => void;
  onPremio: () => void;
}) {
  return (
    <Modal open={aberta} onClose={onFechar} title="Adicionar slide" description="Ele entra antes do Obrigado. Para mudar de lugar, arraste pela alça à esquerda." size="lg" mobileSheet>
      <div className="flex flex-col gap-5">
        {GRUPOS_GALERIA.map((g) => (
          <section key={g.titulo} className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-text">{g.titulo}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.opcoes.map((o) => {
                const Icone = o.icone;
                return (
                  <button
                    key={o.titulo}
                    type="button"
                    onClick={() => ("livre" in o ? onLivre(o.livre) : "premio" in o ? onPremio() : onSecao(o.secao, o.periodo))}
                    className="flex items-start gap-3 rounded-[var(--radius)] border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-bg-inset/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary-subtle text-primary">
                      <Icone className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-text">{o.titulo}</span>
                      <span className="block text-xs text-text-light [text-wrap:pretty]">{o.descricao}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}

/** Só sobe e desce: a lista é uma coluna. */
const soNaVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Textos que o leitor de tela fala enquanto arrasta. */
function anuncios(nome: (id: string | number) => string, posicao: (id: string | number) => number) {
  return {
    onDragStart: ({ active }: { active: { id: string | number } }) => `${nome(active.id)} pego, na posição ${posicao(active.id)}. Use as setas para mover e espaço para soltar.`,
    onDragOver: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) => (over ? `${nome(active.id)} na posição ${posicao(over.id)}.` : undefined),
    onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) => (over ? `${nome(active.id)} solto na posição ${posicao(over.id)}.` : `${nome(active.id)} solto.`),
    onDragCancel: ({ active }: { active: { id: string | number } }) => `Cancelado: ${nome(active.id)} voltou ao lugar.`,
  };
}

/** Item da lista que se arrasta pela alça (mouse, toque ou teclado). */
function ItemArrastavel({ id, titulo, className, children }: { id: string; titulo: string; className: string; children: (alca: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const alca = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-roledescription="item arrastável"
      aria-label={`Mudar ${titulo} de lugar`}
      title="Arraste para mudar de lugar"
      className="flex h-12 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-text-muted hover:bg-bg-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(className, isDragging && "relative z-10 opacity-100 shadow-[var(--shadow-elevated)] ring-2 ring-primary/40")}
    >
      {children(alca)}
    </li>
  );
}

/** Lista das seções: ligar/desligar, arrastar para mudar a ordem, editar e incluir slides livres. */
export function EditorRoteiro({
  roteiro,
  imagens,
  premios: resultados,
  onChange,
  onIrPara,
}: {
  roteiro: Roteiro;
  imagens: Record<string, string>;
  /** Premiações com critérios já calculadas, para a classificação ao vivo no editor. */
  premios?: Record<string, ResultadoPremio>;
  onChange: (r: Partial<Roteiro>) => void;
  /** Tocar numa seção mostra os slides dela na prévia. */
  onIrPara?: (secaoId: string) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [galeria, setGaleria] = useState(false);
  const livres = new Map(roteiro.livres.map((l) => [l.id, l]));
  const premios = new Map((roteiro.premios ?? []).map((p) => [p.id, p]));

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = roteiro.secoes.map((s) => s.id);
  const nomeDe = (id: string | number) => {
    const s = roteiro.secoes.find((x) => x.id === id);
    return s ? nomeDaSecao(s, livres.get(s.id), premios.get(s.id)) : "Slide";
  };
  const posicaoDe = (id: string | number) => ids.indexOf(String(id)) + 1;

  function soltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const de = ids.indexOf(String(active.id));
    const para = ids.indexOf(String(over.id));
    if (de < 0 || para < 0) return;
    onChange({ ...roteiro, secoes: arrayMove(roteiro.secoes, de, para) });
  }

  function atualizarSecao(id: string, campos: Partial<SecaoReuniao>) {
    onChange({ ...roteiro, secoes: roteiro.secoes.map((s) => (s.id === id ? { ...s, ...campos } : s)) });
  }

  function atualizarLivre(l: SlideLivre) {
    onChange({ ...roteiro, livres: roteiro.livres.map((x) => (x.id === l.id ? l : x)) });
  }

  /** Novos slides entram antes do "Obrigado" (ou no fim) e já abertos para editar. */
  function inserir(secao: SecaoReuniao, extra: Partial<Roteiro> = {}) {
    const fim = roteiro.secoes.findIndex((s) => s.tipo === "obrigado");
    const secoes = [...roteiro.secoes];
    secoes.splice(fim >= 0 ? fim : secoes.length, 0, secao);
    onChange({ secoes, ...extra });
    setAberto(secao.id);
    setGaleria(false);
    onIrPara?.(secao.id);
  }

  function adicionar(layout: SlideLivre["layout"]) {
    const l = novoSlideLivre(layout);
    inserir({ id: l.id, tipo: "livre", ativo: true }, { livres: [...roteiro.livres, l] });
  }

  function adicionarPremio() {
    const p = novoPremio();
    inserir({ id: p.id, tipo: "premio", ativo: true }, { premios: [...(roteiro.premios ?? []), p] });
  }

  function atualizarPremio(p: PremioPersonalizado) {
    onChange({ premios: (roteiro.premios ?? []).map((x) => (x.id === p.id ? p : x)) });
  }

  function adicionarSecao(tipo: TipoSecao, periodo?: "ano") {
    // Um segundo slide de destaques do mesmo período começa com as categorias que o primeiro não mostra.
    const jaTem = tipo === "destaques" && roteiro.secoes.some((x) => x.tipo === "destaques" && (x.periodo ?? "reuniao") === (periodo ?? "reuniao"));
    const destaques = jaTem ? CATEGORIAS_DESTAQUE.filter((c) => !c.padrao).map((c) => c.id) : undefined;
    inserir({ id: `s-${Math.random().toString(36).slice(2, 9)}`, tipo, ativo: true, ...(periodo ? { periodo } : {}), ...(destaques ? { destaques } : {}) });
  }

  /** Duplicar: a cópia entra logo abaixo, já aberta para editar. */
  function duplicar(id: string) {
    const premio = premios.get(id);
    if (premio) {
      const i = roteiro.secoes.findIndex((s) => s.id === id);
      const copia: PremioPersonalizado = { ...premio, id: novoPremio().id, titulo: `${premio.titulo} (cópia)`.slice(0, 60) };
      const secoes = [...roteiro.secoes];
      secoes.splice(i + 1, 0, { id: copia.id, tipo: "premio", ativo: true });
      onChange({ secoes, premios: [...(roteiro.premios ?? []), copia] });
      setAberto(copia.id);
      return;
    }
    const original = livres.get(id);
    const i = roteiro.secoes.findIndex((s) => s.id === id);
    if (!original || i < 0) return;
    const copia: SlideLivre = { ...original, id: novoSlideLivre(original.layout).id };
    const secoes = [...roteiro.secoes];
    secoes.splice(i + 1, 0, { id: copia.id, tipo: "livre", ativo: true });
    onChange({ secoes, livres: [...roteiro.livres, copia] });
    setAberto(copia.id);
  }

  function remover(id: string) {
    onChange({ secoes: roteiro.secoes.filter((s) => s.id !== id), livres: roteiro.livres.filter((l) => l.id !== id), premios: (roteiro.premios ?? []).filter((p) => p.id !== id) });
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext
        sensors={sensores}
        collisionDetection={closestCenter}
        modifiers={[soNaVertical]}
        onDragEnd={soltar}
        accessibility={{
          announcements: anuncios(nomeDe, posicaoDe),
          screenReaderInstructions: { draggable: "Para mudar de lugar, aperte espaço, use as setas para cima e para baixo e aperte espaço de novo para soltar. Esc cancela." },
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-1.5">
            {roteiro.secoes.map((s) => {
              const livre = s.tipo === "livre" ? livres.get(s.id) : undefined;
              const premio = s.tipo === "premio" ? premios.get(s.id) : undefined;
              const titulo = nomeDaSecao(s, livre, premio);
              const pesos = premio ? pesosNormalizados(premio.criterios) : [];
              const dica = premio
                ? premio.criterios.map((c, j) => `${rotuloDoCriterio(c)} ${Math.round(pesos[j])}%`).join(" · ")
                : livre
                ? {
                    divisoria: "Divisória · escrito pelo comitê",
                    enquete: "Enquete ao vivo",
                    conteudo: "Conteúdo · escrito pelo comitê",
                    fala: "Fala de uma pessoa",
                    retrospectiva: "Retrospectiva de fotos do computador",
                  }[livre.layout]
                : s.periodo === "ano"
                  ? `${TITULO_SECAO[s.tipo as Exclude<typeof s.tipo, "livre">].dica}, do ano até agora`
                  : TITULO_SECAO[s.tipo as Exclude<typeof s.tipo, "livre">].dica;
              // Slides de números repetidos (ex.: destaques do ano além dos do trimestre) podem sair do roteiro.
              const removivel = !livre && (!!premio || roteiro.secoes.filter((x) => x.tipo === s.tipo).length > 1);
              const expandido = aberto === s.id;
              return (
                <ItemArrastavel key={s.id} id={s.id} titulo={titulo} className={cn("rounded-[var(--radius)] border bg-bg-card", s.ativo ? "border-border" : "border-dashed border-border opacity-60")}>
                  {(alca) => (
                    <>
                      <div className="flex items-center gap-1 pl-1">
                        {alca}
                        <button
                          type="button"
                          onClick={() => {
                            setAberto(expandido ? null : s.id);
                            if (s.ativo) onIrPara?.(s.id);
                          }}
                          className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left hover:bg-bg-inset/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-expanded={expandido}
                          title={s.ativo ? "Mostrar na prévia" : undefined}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-text">{titulo}</span>
                            <span className="block truncate text-xs text-text-light">{dica}</span>
                          </span>
                          {roteiro.tempos?.[s.id] ? <span className="shrink-0 text-xs tabular-nums text-text-muted">{String(roteiro.tempos[s.id]).replace(".", ",")} min</span> : null}
                          <ChevronDown className={cn("size-4 shrink-0 text-text-muted transition-transform", expandido && "rotate-180")} aria-hidden="true" />
                        </button>
                        {livre || premio ? (
                          <button type="button" onClick={() => duplicar(s.id)} aria-label={`Duplicar ${titulo}`} title="Duplicar" className="flex size-9 items-center justify-center rounded text-text-muted hover:bg-bg-inset hover:text-text">
                            <Copy className="size-4" />
                          </button>
                        ) : null}
                        {livre || removivel ? (
                          <button type="button" onClick={() => remover(s.id)} aria-label={`Remover ${titulo}`} className="flex size-9 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger">
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                        <Switch ativo={s.ativo} onChange={(ativo) => atualizarSecao(s.id, { ativo })} rotulo={`Mostrar ${titulo}`} />
                      </div>
                      {expandido && livre ? (
                        <>
                          <EditorLivre livre={livre} imagem={livre.imagemId ? imagens[livre.imagemId] : undefined} onChange={atualizarLivre} />
                          <div className="px-3 pb-3">
                            <TempoPlanejado minutos={roteiro.tempos?.[s.id]} onChange={(m) => onChange({ tempos: tempoNovo(roteiro.tempos, s.id, m) })} />
                          </div>
                        </>
                      ) : expandido && premio ? (
                        <>
                          <EditorPremio premio={premio} resultado={resultados?.[premio.id]} onChange={atualizarPremio} />
                          <div className="px-3 pb-3">
                            <TempoPlanejado minutos={roteiro.tempos?.[s.id]} onChange={(m) => onChange({ tempos: tempoNovo(roteiro.tempos, s.id, m) })} />
                          </div>
                        </>
                      ) : expandido ? (
                        <EditorSecao secao={s} roteiro={roteiro} onChange={onChange} />
                      ) : null}
                    </>
                  )}
                </ItemArrastavel>
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>
      <Button type="button" variant="secondary" className="w-full" onClick={() => setGaleria(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Adicionar slide
      </Button>
      <GaleriaDeSlides aberta={galeria} onFechar={() => setGaleria(false)} onLivre={adicionar} onSecao={adicionarSecao} onPremio={adicionarPremio} />
    </div>
  );
}
