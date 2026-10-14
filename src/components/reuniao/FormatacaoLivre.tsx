"use client";

import { useId, useState, type ReactNode } from "react";
import { AlignCenter, AlignLeft, Ban, ChevronDown, List, ListOrdered, Paintbrush, PanelLeft, PanelRight, Pilcrow } from "lucide-react";
import { cn } from "@/lib/cn";
import { estiloDoLivre, estiloSalvo, FONTES_SLIDE, type EstiloLivre, type FonteSlide, type FundoLivre, type SlideLivre } from "@/lib/reuniaoResultados";

/** Cores da marca primeiro; o seletor livre fica no fim. */
const PALETA = [
  { cor: "#0b2c5f", nome: "Azul-marinho" },
  { cor: "#1462c4", nome: "Azul" },
  { cor: "#f37021", nome: "Laranja" },
  { cor: "#2fa84f", nome: "Verde" },
  { cor: "#e7a913", nome: "Dourado" },
  { cor: "#d93636", nome: "Vermelho" },
  { cor: "#1f2937", nome: "Grafite" },
  { cor: "#ffffff", nome: "Branco" },
];

const FUNDOS: { valor: Exclude<FundoLivre, "cor">; nome: string; imagem: string }[] = [
  { valor: "conteudo", nome: "Céu claro", imagem: "/reuniao/fundo-conteudo.webp" },
  { valor: "claro", nome: "Corrida clara", imagem: "/reuniao/fundo-claro.webp" },
  { valor: "divisoria", nome: "Corrida e bike", imagem: "/reuniao/fundo-divisoria.webp" },
  { valor: "resultados", nome: "Resultados", imagem: "/reuniao/fundo-resultados.webp" },
  { valor: "premiacao", nome: "Premiação", imagem: "/reuniao/fundo-premiacao.webp" },
  { valor: "agenda", nome: "Agenda", imagem: "/reuniao/fundo-agenda.webp" },
];

const TAMANHOS: { valor: EstiloLivre["tamanho"]; rotulo: string; nome: string }[] = [
  { valor: "auto", rotulo: "Auto", nome: "Automático" },
  { valor: "p", rotulo: "P", nome: "Pequeno" },
  { valor: "m", rotulo: "M", nome: "Médio" },
  { valor: "g", rotulo: "G", nome: "Grande" },
  { valor: "gg", rotulo: "GG", nome: "Muito grande" },
];

const grupo = "flex gap-1 rounded-[var(--radius)] bg-bg-inset p-1";
const opcao = (ativo: boolean) =>
  cn(
    "flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    ativo ? "bg-bg-card text-text shadow-sm" : "text-text-light hover:text-text",
  );

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-text-light">{rotulo}</p>
      {children}
    </div>
  );
}

/** Bolinhas de cor + "padrão" + seletor livre. */
function SeletorCor({ rotulo, valor, onChange, permitePadrao = true }: { rotulo: string; valor: string | null; onChange: (cor: string | null) => void; permitePadrao?: boolean }) {
  const id = useId();
  const foraDaPaleta = !!valor && !PALETA.some((p) => p.cor === valor);
  const bolinha = (ativo: boolean) =>
    cn(
      "relative flex size-7 shrink-0 items-center justify-center rounded-full border transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      ativo ? "ring-2 ring-primary ring-offset-2 ring-offset-bg-card" : "hover:ring-2 hover:ring-border-strong hover:ring-offset-1",
    );
  return (
    <Campo rotulo={rotulo}>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={rotulo}>
        {permitePadrao ? (
          <button type="button" role="radio" aria-checked={valor === null} title="Cor padrão" onClick={() => onChange(null)} className={cn(bolinha(valor === null), "border-border bg-bg")}>
            <Ban className="size-3.5 text-text-muted" aria-hidden="true" />
            <span className="sr-only">Padrão</span>
          </button>
        ) : null}
        {PALETA.map((p) => (
          <button
            key={p.cor}
            type="button"
            role="radio"
            aria-checked={valor === p.cor}
            title={p.nome}
            onClick={() => onChange(p.cor)}
            className={cn(bolinha(valor === p.cor), p.cor === "#ffffff" ? "border-border-strong" : "border-transparent")}
            style={{ background: p.cor }}
          >
            <span className="sr-only">{p.nome}</span>
          </button>
        ))}
        <label htmlFor={id} title="Outra cor" className={cn(bolinha(foraDaPaleta), "cursor-pointer overflow-hidden border-border")} style={{ background: foraDaPaleta ? valor! : "conic-gradient(#f37021, #e7a913, #2fa84f, #1462c4, #8b5cf6, #d93636, #f37021)" }}>
          <span className="sr-only">Outra cor</span>
          <input id={id} type="color" value={valor ?? "#0b2c5f"} onChange={(e) => onChange(e.target.value.toLowerCase())} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </Campo>
  );
}

/**
 * Formatação do slide escrito, como numa ferramenta de apresentação: fonte,
 * tamanho, cores, alinhamento, estilo da lista e fundo. Salva só o que muda.
 */
export function FormatacaoLivre({ livre, temImagem, onChange }: { livre: SlideLivre; temImagem: boolean; onChange: (l: SlideLivre) => void }) {
  const [aberto, setAberto] = useState(false);
  const estilo = estiloDoLivre(livre);
  const personalizado = !!estiloSalvo(livre.layout, livre.estilo);
  const conteudo = livre.layout === "conteudo";
  const idPainel = useId();

  function mudar(campos: Partial<EstiloLivre>) {
    const estiloNovo = estiloSalvo(livre.layout, { ...estilo, ...campos });
    const { estilo: _antigo, ...resto } = livre;
    void _antigo;
    onChange(estiloNovo ? { ...resto, estilo: estiloNovo } : resto);
  }

  return (
    <div className="rounded-[var(--radius)] border border-border">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={idPainel}
        className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius)] px-3 text-left text-sm font-semibold text-text hover:bg-bg-inset/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Paintbrush className="size-4 text-text-muted" aria-hidden="true" />
        Formatar
        <span className="ml-auto text-xs font-normal text-text-light">{personalizado ? "Personalizado" : "Padrão"}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-text-muted transition-transform", aberto && "rotate-180")} aria-hidden="true" />
      </button>
      {aberto ? (
        <div id={idPainel} className="flex flex-col gap-4 border-t border-border-subtle p-3">
          <Campo rotulo="Fonte">
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Fonte">
              {(Object.keys(FONTES_SLIDE) as FonteSlide[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={estilo.fonte === f}
                  onClick={() => mudar({ fonte: f })}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    estilo.fonte === f ? "border-primary bg-primary-subtle text-text" : "border-border text-text-light hover:border-border-strong hover:text-text",
                  )}
                >
                  <span className="text-lg font-extrabold leading-none" style={{ fontFamily: FONTES_SLIDE[f].familia }} aria-hidden="true">
                    Aa
                  </span>
                  <span className="truncate text-xs font-semibold">{f === "barlow" ? "Da apresentação" : FONTES_SLIDE[f].nome}</span>
                </button>
              ))}
            </div>
          </Campo>

          <Campo rotulo="Tamanho do texto">
            <div className={grupo} role="radiogroup" aria-label="Tamanho do texto">
              {TAMANHOS.map((t) => (
                <button key={t.valor} type="button" role="radio" aria-checked={estilo.tamanho === t.valor} aria-label={t.nome} title={t.nome} onClick={() => mudar({ tamanho: t.valor })} className={opcao(estilo.tamanho === t.valor)}>
                  {t.rotulo}
                </button>
              ))}
            </div>
          </Campo>

          <div className="flex gap-3">
            <Campo rotulo="Alinhar">
              <div className={grupo} role="radiogroup" aria-label="Alinhar">
                <button type="button" role="radio" aria-checked={estilo.alinhamento === "esquerda"} title="À esquerda" onClick={() => mudar({ alinhamento: "esquerda" })} className={opcao(estilo.alinhamento === "esquerda")}>
                  <AlignLeft className="size-4" aria-hidden="true" />
                  <span className="sr-only">À esquerda</span>
                </button>
                <button type="button" role="radio" aria-checked={estilo.alinhamento === "centro"} title="Centralizado" onClick={() => mudar({ alinhamento: "centro" })} className={opcao(estilo.alinhamento === "centro")}>
                  <AlignCenter className="size-4" aria-hidden="true" />
                  <span className="sr-only">Centralizado</span>
                </button>
              </div>
            </Campo>
            {conteudo ? (
              <div className="flex-1">
                <Campo rotulo="Itens">
                  <div className={grupo} role="radiogroup" aria-label="Itens">
                    {(
                      [
                        { v: "numerada", nome: "Numerados", I: ListOrdered },
                        { v: "marcadores", nome: "Marcadores", I: List },
                        { v: "paragrafo", nome: "Texto corrido", I: Pilcrow },
                      ] as const
                    ).map(({ v, nome, I }) => (
                      <button key={v} type="button" role="radio" aria-checked={estilo.lista === v} title={nome} onClick={() => mudar({ lista: v })} className={opcao(estilo.lista === v)}>
                        <I className="size-4" aria-hidden="true" />
                        <span className="sr-only">{nome}</span>
                      </button>
                    ))}
                  </div>
                </Campo>
              </div>
            ) : null}
          </div>

          <SeletorCor rotulo="Cor do título" valor={estilo.corTitulo} onChange={(c) => mudar({ corTitulo: c })} />
          <SeletorCor rotulo={conteudo ? "Cor do texto" : "Cor do texto de baixo"} valor={estilo.corTexto} onChange={(c) => mudar({ corTexto: c })} />
          <SeletorCor rotulo={conteudo ? "Cor de destaque (borda e marcadores)" : "Cor da linha de cima"} valor={estilo.corDestaque} onChange={(c) => mudar({ corDestaque: c })} />

          <Campo rotulo="Fundo">
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Fundo">
              {FUNDOS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  role="radio"
                  aria-checked={estilo.fundo === f.valor}
                  onClick={() => mudar({ fundo: f.valor })}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-[var(--radius-sm)] border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    estilo.fundo === f.valor ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.imagem} alt="" className="aspect-video w-full object-cover" />
                  <span className="truncate px-1.5 py-1 text-[11px] font-semibold text-text-light">{f.nome}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              role="radio"
              aria-checked={estilo.fundo === "cor"}
              onClick={() => mudar({ fundo: "cor" })}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                estilo.fundo === "cor" ? "border-primary bg-primary-subtle text-text" : "border-border text-text-light hover:border-border-strong hover:text-text",
              )}
            >
              <span className="size-4 rounded-full border border-border" style={{ background: estilo.corFundo }} aria-hidden="true" />
              Cor sólida
            </button>
            {estilo.fundo === "cor" ? <SeletorCor rotulo="Cor do fundo" valor={estilo.corFundo} onChange={(c) => c && mudar({ corFundo: c })} permitePadrao={false} /> : null}
          </Campo>

          {conteudo && temImagem ? (
            <Campo rotulo="Imagem">
              <div className={grupo} role="radiogroup" aria-label="Lado da imagem">
                <button type="button" role="radio" aria-checked={estilo.imagemLado === "esquerda"} onClick={() => mudar({ imagemLado: "esquerda" })} className={opcao(estilo.imagemLado === "esquerda")}>
                  <PanelLeft className="size-4" aria-hidden="true" />
                  À esquerda
                </button>
                <button type="button" role="radio" aria-checked={estilo.imagemLado === "direita"} onClick={() => mudar({ imagemLado: "direita" })} className={opcao(estilo.imagemLado === "direita")}>
                  <PanelRight className="size-4" aria-hidden="true" />
                  À direita
                </button>
              </div>
            </Campo>
          ) : null}

          {personalizado ? (
            <button type="button" onClick={() => mudar(estiloDoLivre({ layout: livre.layout }))} className="self-start text-xs font-semibold text-text-light hover:text-text">
              Voltar ao visual padrão
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
