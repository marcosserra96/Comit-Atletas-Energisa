"use client";

import { useId, useRef, useState } from "react";
import { Award, BarChart3, Bold, ImagePlus, Images, LayoutTemplate, MessageSquareQuote, Sparkles, TrendingUp, Trophy, Type } from "lucide-react";
import { arrayMove } from "@dnd-kit/sortable";
import { GRADE_EDITOR } from "@/components/reuniao/estiloEditor";
import { FormatacaoLivre } from "@/components/reuniao/FormatacaoLivre";
import { EditorPremio } from "@/components/reuniao/EditorPremio";
import { novoPremio, type PremioPersonalizado, type ResultadoPremio } from "@/lib/premiacaoPersonalizada";
import { cn } from "@/lib/cn";
import { IMAGEM_SLIDE_LADO } from "@/lib/fotoRegras";
import { reduzirImagem } from "@/lib/fotos";
import { enviarImagemSlide, guardarImagemNoCache } from "@/lib/reuniaoCliente";
import {
  CAMPOS_DE_TEXTO,
  CATEGORIAS_DESTAQUE,
  categoriasDaSecao,
  MODOS_REVELAR_DESTAQUES,
  novoSlideLivre,
  SECOES_COM_PERIODO,
  TEXTOS_PADRAO,
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

export type Roteiro = Pick<ReuniaoResultadosDoc, "secoes" | "livres"> & Partial<Pick<ReuniaoResultadosDoc, "textos" | "tempos" | "contagem" | "premios">>;

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
    <div className={GRADE_EDITOR}>
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
        <fieldset className="col-span-full flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium text-text">Quais destaques entram</legend>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
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
      {secao.tipo === "destaques" ? (
        <div className="col-span-full flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Como aparecem ao apresentar</span>
          <SegmentedControl
            value={secao.revelar ?? "junto"}
            onChange={(v) => mudarSecao({ revelar: v === "junto" ? undefined : v })}
            className="w-full [&>button]:flex-1"
            options={MODOS_REVELAR_DESTAQUES.map((m) => ({ value: m.id, label: m.nome }))}
          />
          <p className="text-xs text-text-light">{MODOS_REVELAR_DESTAQUES.find((m) => m.id === (secao.revelar ?? "junto"))?.dica} Nas miniaturas e no PDF, tudo aparece.</p>
        </div>
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
      <div className={GRADE_EDITOR}>
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
    <div className={GRADE_EDITOR}>
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
export function GaleriaDeSlides({
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

/** Ações sobre o roteiro: incluir, duplicar, remover, mudar de lugar e editar um slide. */
export function useAcoesDoRoteiro(roteiro: Roteiro, onChange: (r: Partial<Roteiro>) => void, aoCriar?: (secaoId: string) => void) {
  const livres = new Map(roteiro.livres.map((l) => [l.id, l]));
  const premios = new Map((roteiro.premios ?? []).map((p) => [p.id, p]));

  /** Novos slides entram logo depois do selecionado (ou antes do "Obrigado"). */
  function inserir(secao: SecaoReuniao, extra: Partial<Roteiro> = {}, depoisDe?: string | null) {
    const secoes = [...roteiro.secoes];
    const i = depoisDe ? secoes.findIndex((s) => s.id === depoisDe) : -1;
    const fim = secoes.findIndex((s) => s.tipo === "obrigado");
    secoes.splice(i >= 0 ? i + 1 : fim >= 0 ? fim : secoes.length, 0, secao);
    onChange({ secoes, ...extra });
    aoCriar?.(secao.id);
  }

  return {
    livres,
    premios,
    adicionarLivre(layout: SlideLivre["layout"], depoisDe?: string | null) {
      const l = novoSlideLivre(layout);
      inserir({ id: l.id, tipo: "livre", ativo: true }, { livres: [...roteiro.livres, l] }, depoisDe);
    },
    adicionarPremio(depoisDe?: string | null) {
      const p = novoPremio();
      inserir({ id: p.id, tipo: "premio", ativo: true }, { premios: [...(roteiro.premios ?? []), p] }, depoisDe);
    },
    adicionarSecao(tipo: TipoSecao, periodo?: "ano", depoisDe?: string | null) {
      // Um segundo slide de destaques do mesmo período começa com as categorias que o primeiro não mostra.
      const jaTem = tipo === "destaques" && roteiro.secoes.some((x) => x.tipo === "destaques" && (x.periodo ?? "reuniao") === (periodo ?? "reuniao"));
      const destaques = jaTem ? CATEGORIAS_DESTAQUE.filter((c) => !c.padrao).map((c) => c.id) : undefined;
      inserir({ id: `s-${Math.random().toString(36).slice(2, 9)}`, tipo, ativo: true, ...(periodo ? { periodo } : {}), ...(destaques ? { destaques } : {}) }, {}, depoisDe);
    },
    /** Só slides escritos e prêmios se duplicam; a cópia entra logo abaixo. */
    podeDuplicar: (id: string) => livres.has(id) || premios.has(id),
    duplicar(id: string) {
      const i = roteiro.secoes.findIndex((s) => s.id === id);
      if (i < 0) return;
      const premio = premios.get(id);
      const original = livres.get(id);
      const secoes = [...roteiro.secoes];
      if (premio) {
        const copia: PremioPersonalizado = { ...premio, id: novoPremio().id, titulo: `${premio.titulo} (cópia)`.slice(0, 60) };
        secoes.splice(i + 1, 0, { id: copia.id, tipo: "premio", ativo: true });
        onChange({ secoes, premios: [...(roteiro.premios ?? []), copia] });
        aoCriar?.(copia.id);
      } else if (original) {
        const copia: SlideLivre = { ...original, id: novoSlideLivre(original.layout).id };
        secoes.splice(i + 1, 0, { id: copia.id, tipo: "livre", ativo: true });
        onChange({ secoes, livres: [...roteiro.livres, copia] });
        aoCriar?.(copia.id);
      }
    },
    /** Slides escritos, prêmios e números repetidos saem; os automáticos únicos só se escondem. */
    podeRemover(id: string) {
      const s = roteiro.secoes.find((x) => x.id === id);
      if (!s) return false;
      return s.tipo === "livre" || s.tipo === "premio" || roteiro.secoes.filter((x) => x.tipo === s.tipo).length > 1;
    },
    remover(id: string) {
      onChange({ secoes: roteiro.secoes.filter((s) => s.id !== id), livres: roteiro.livres.filter((l) => l.id !== id), premios: (roteiro.premios ?? []).filter((p) => p.id !== id) });
    },
    mostrar(id: string, ativo: boolean) {
      onChange({ secoes: roteiro.secoes.map((s) => (s.id === id ? { ...s, ativo } : s)) });
    },
    mover(de: number, para: number) {
      if (de === para || de < 0 || para < 0) return;
      onChange({ secoes: arrayMove(roteiro.secoes, de, para) });
    },
  };
}

/** Os campos do slide escolhido: escrito pelo comitê, prêmio ou slide de números. */
export function EditorDoSlide({
  secao,
  roteiro,
  imagens,
  resultados,
  onChange,
}: {
  secao: SecaoReuniao;
  roteiro: Roteiro;
  imagens: Record<string, string>;
  resultados?: Record<string, ResultadoPremio>;
  onChange: (r: Partial<Roteiro>) => void;
}) {
  const livre = secao.tipo === "livre" ? roteiro.livres.find((l) => l.id === secao.id) : undefined;
  const premio = secao.tipo === "premio" ? roteiro.premios?.find((p) => p.id === secao.id) : undefined;
  const tempo = <TempoPlanejado minutos={roteiro.tempos?.[secao.id]} onChange={(m) => onChange({ tempos: tempoNovo(roteiro.tempos, secao.id, m) })} />;
  if (livre) {
    return (
      <div className="flex flex-col gap-4">
        <EditorLivre livre={livre} imagem={livre.imagemId ? imagens[livre.imagemId] : undefined} onChange={(l) => onChange({ livres: roteiro.livres.map((x) => (x.id === l.id ? l : x)) })} />
        {tempo}
      </div>
    );
  }
  if (premio) {
    return (
      <div className="flex flex-col gap-4">
        <EditorPremio premio={premio} resultado={resultados?.[premio.id]} onChange={(p) => onChange({ premios: (roteiro.premios ?? []).map((x) => (x.id === p.id ? p : x)) })} />
        {tempo}
      </div>
    );
  }
  return <EditorSecao secao={secao} roteiro={roteiro} onChange={onChange} />;
}
