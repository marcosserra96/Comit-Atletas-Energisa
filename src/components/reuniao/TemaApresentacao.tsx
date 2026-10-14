"use client";

import { cn } from "@/lib/cn";
import { Switch } from "@/components/ui/Switch";
import { FONTES_SLIDE, temaDaReuniao, type FonteSlide, type TemaReuniao, type TransicaoSlide } from "@/lib/reuniaoResultados";

const TRANSICOES: { valor: TransicaoSlide; nome: string }[] = [
  { valor: "nenhuma", nome: "Nenhuma" },
  { valor: "esmaecer", nome: "Esmaecer" },
  { valor: "deslizar", nome: "Deslizar" },
  { valor: "zoom", nome: "Aproximar" },
];

const grupo = "grid gap-1 rounded-[var(--radius)] bg-bg-inset p-1";
const opcao = (ativo: boolean) =>
  cn(
    "flex min-h-9 items-center justify-center rounded-[calc(var(--radius)-2px)] px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    ativo ? "bg-bg-card text-text shadow-sm" : "text-text-light hover:text-text",
  );

/**
 * Aparência da apresentação inteira: fonte de todos os slides, transição entre
 * eles e animações (entrada dos elementos e pódio revelado no clique).
 */
export function TemaApresentacao({ tema: salvo, onChange }: { tema: Partial<TemaReuniao> | undefined; onChange: (tema: TemaReuniao) => void }) {
  const tema = temaDaReuniao(salvo);
  const mudar = (campos: Partial<TemaReuniao>) => onChange({ ...tema, ...campos });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-text-light">Fonte dos slides</p>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Fonte dos slides">
          {(Object.keys(FONTES_SLIDE) as FonteSlide[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={tema.fonte === f}
              onClick={() => mudar({ fonte: f })}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                tema.fonte === f ? "border-primary bg-primary-subtle text-text" : "border-border text-text-light hover:border-border-strong hover:text-text",
              )}
            >
              <span className="text-lg font-extrabold leading-none" style={{ fontFamily: FONTES_SLIDE[f].familia }} aria-hidden="true">
                Aa
              </span>
              <span className="truncate text-xs font-semibold">{FONTES_SLIDE[f].nome}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-text-light">Transição entre slides</p>
        <div className={cn(grupo, "grid-cols-4")} role="radiogroup" aria-label="Transição entre slides">
          {TRANSICOES.map((t) => (
            <button key={t.valor} type="button" role="radio" aria-checked={tema.transicao === t.valor} onClick={() => mudar({ transicao: t.valor })} className={opcao(tema.transicao === t.valor)}>
              {t.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col divide-y divide-border-subtle rounded-[var(--radius)] border border-border">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">Animar a entrada</p>
            <p className="text-xs text-text-light">Título, números e fotos entram um a um.</p>
          </div>
          <Switch ativo={tema.animacoes} onChange={(animacoes) => mudar({ animacoes })} rotulo="Animar a entrada" />
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">Revelar o pódio no clique</p>
            <p className="text-xs text-text-light">Cada clique mostra um lugar: 3º, 2º e por fim o 1º.</p>
          </div>
          <Switch ativo={tema.revelarPodio} onChange={(revelarPodio) => mudar({ revelarPodio })} rotulo="Revelar o pódio no clique" />
        </div>
      </div>

      <p className="text-xs text-text-muted">
        Cores, fundo e tamanho de cada slide escrito pelo comitê ficam no roteiro: abra o slide e toque em <span className="font-semibold text-text-light">Formatar</span>.
      </p>
    </div>
  );
}
