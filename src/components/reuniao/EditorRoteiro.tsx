"use client";

import { useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Plus, Trash2, Type, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/cn";
import { IMAGEM_SLIDE_LADO } from "@/lib/fotoRegras";
import { reduzirImagem } from "@/lib/fotos";
import { enviarImagemSlide, guardarImagemNoCache } from "@/lib/reuniaoCliente";
import { novoSlideLivre, TITULO_SECAO, type ReuniaoResultadosDoc, type SecaoReuniao, type SlideLivre } from "@/lib/reuniaoResultados";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Switch } from "@/components/ui/Switch";

type Roteiro = Pick<ReuniaoResultadosDoc, "secoes" | "livres">;

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
  const [enviando, setEnviando] = useState(false);
  const conteudo = livre.layout === "conteudo";

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

  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle px-3 pb-3 pt-3">
      <div className="flex gap-1 rounded-[var(--radius)] bg-bg-inset p-1" role="radiogroup" aria-label="Tipo do slide">
        {(
          [
            { v: "divisoria", t: "Divisória", d: "Título grande", I: Type },
            { v: "conteudo", t: "Conteúdo", d: "Lista e/ou imagem", I: LayoutTemplate },
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
      {conteudo ? null : (
        <TextField
          label="Linha de cima (laranja)"
          value={livre.sobretitulo}
          maxLength={60}
          placeholder="Ex.: Fala da"
          onChange={(e) => onChange({ ...livre, sobretitulo: e.target.value })}
        />
      )}
      <TextField
        label={conteudo ? "Título" : "Título (azul)"}
        value={livre.titulo}
        maxLength={120}
        placeholder={conteudo ? "Ex.: Relembrando nossos combinados" : "Ex.: Diretoria"}
        onChange={(e) => onChange({ ...livre, titulo: e.target.value })}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idTexto} className="text-sm font-medium text-text">
          {conteudo ? "Itens (um por linha)" : "Texto abaixo do título"} <span className="font-normal text-text-muted">(opcional)</span>
        </label>
        <textarea
          id={idTexto}
          rows={conteudo ? 5 : 2}
          maxLength={1500}
          value={livre.texto}
          onChange={(e) => onChange({ ...livre, texto: e.target.value })}
          className="w-full resize-y rounded-[var(--radius)] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>
      {conteudo ? (
        <div className="flex items-center gap-3">
          {imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagem} alt="" className="h-14 w-24 rounded-[var(--radius-sm)] border border-border object-cover" />
          ) : null}
          <input ref={entrada} type="file" accept="image/*" className="sr-only" onChange={(e) => void escolherImagem(e.target.files?.[0])} aria-label="Escolher imagem" />
          <Button type="button" size="sm" variant="secondary" loading={enviando} onClick={() => entrada.current?.click()}>
            <ImagePlus className="size-4" aria-hidden="true" />
            {livre.imagemId ? "Trocar imagem" : "Adicionar imagem"}
          </Button>
          {livre.imagemId ? (
            <button type="button" onClick={() => onChange({ ...livre, imagemId: null })} className="min-h-9 text-xs font-semibold text-text-light hover:text-danger">
              Tirar imagem
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Lista das seções: ligar/desligar, subir/descer, editar e incluir slides livres. */
export function EditorRoteiro({
  roteiro,
  imagens,
  onChange,
}: {
  roteiro: Roteiro;
  imagens: Record<string, string>;
  onChange: (r: Roteiro) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const livres = new Map(roteiro.livres.map((l) => [l.id, l]));

  function mover(i: number, delta: number) {
    const secoes = [...roteiro.secoes];
    const j = i + delta;
    if (j < 0 || j >= secoes.length) return;
    [secoes[i], secoes[j]] = [secoes[j], secoes[i]];
    onChange({ ...roteiro, secoes });
  }

  function atualizarSecao(id: string, campos: Partial<SecaoReuniao>) {
    onChange({ ...roteiro, secoes: roteiro.secoes.map((s) => (s.id === id ? { ...s, ...campos } : s)) });
  }

  function atualizarLivre(l: SlideLivre) {
    onChange({ ...roteiro, livres: roteiro.livres.map((x) => (x.id === l.id ? l : x)) });
  }

  function adicionar(layout: SlideLivre["layout"]) {
    const l = novoSlideLivre(layout);
    // Entra antes do "Obrigado", se houver.
    const fim = roteiro.secoes.findIndex((s) => s.tipo === "obrigado");
    const secoes = [...roteiro.secoes];
    secoes.splice(fim >= 0 ? fim : secoes.length, 0, { id: l.id, tipo: "livre", ativo: true });
    onChange({ secoes, livres: [...roteiro.livres, l] });
    setAberto(l.id);
  }

  function remover(id: string) {
    onChange({ secoes: roteiro.secoes.filter((s) => s.id !== id), livres: roteiro.livres.filter((l) => l.id !== id) });
  }

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1.5">
        {roteiro.secoes.map((s, i) => {
          const livre = s.tipo === "livre" ? livres.get(s.id) : undefined;
          const titulo = livre
            ? [livre.sobretitulo, livre.titulo].filter(Boolean).join(" ") || "Slide livre"
            : TITULO_SECAO[s.tipo as Exclude<typeof s.tipo, "livre">].titulo;
          const dica = livre ? (livre.layout === "divisoria" ? "Divisória · escrito pelo comitê" : "Conteúdo · escrito pelo comitê") : TITULO_SECAO[s.tipo as Exclude<typeof s.tipo, "livre">].dica;
          const expandido = aberto === s.id && !!livre;
          return (
            <li key={s.id} className={cn("rounded-[var(--radius)] border bg-bg-card", s.ativo ? "border-border" : "border-dashed border-border opacity-60")}>
              <div className="flex items-center gap-1 pl-2">
                <div className="flex flex-col">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${titulo}`} className="flex size-7 items-center justify-center rounded text-text-muted hover:bg-bg-inset hover:text-text disabled:opacity-30">
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === roteiro.secoes.length - 1} aria-label={`Descer ${titulo}`} className="flex size-7 items-center justify-center rounded text-text-muted hover:bg-bg-inset hover:text-text disabled:opacity-30">
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={!livre}
                  onClick={() => setAberto(expandido ? null : s.id)}
                  className={cn("flex min-h-14 min-w-0 flex-1 items-center gap-2 px-2 text-left", livre && "cursor-pointer")}
                  aria-expanded={livre ? expandido : undefined}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{titulo}</span>
                    <span className="block truncate text-xs text-text-light">{dica}</span>
                  </span>
                  {livre ? <ChevronDown className={cn("size-4 shrink-0 text-text-muted transition-transform", expandido && "rotate-180")} aria-hidden="true" /> : null}
                </button>
                {livre ? (
                  <button type="button" onClick={() => remover(s.id)} aria-label={`Remover ${titulo}`} className="flex size-9 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger">
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
                <Switch ativo={s.ativo} onChange={(ativo) => atualizarSecao(s.id, { ativo })} rotulo={`Mostrar ${titulo}`} />
              </div>
              {expandido && livre ? (
                <EditorLivre livre={livre} imagem={livre.imagemId ? imagens[livre.imagemId] : undefined} onChange={atualizarLivre} />
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => adicionar("divisoria")}>
          <Plus className="size-4" aria-hidden="true" />
          Divisória
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => adicionar("conteudo")}>
          <Plus className="size-4" aria-hidden="true" />
          Slide de conteúdo
        </Button>
      </div>
    </div>
  );
}
