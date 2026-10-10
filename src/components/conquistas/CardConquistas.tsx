"use client";

import Link from "next/link";
import { ChevronRight, Flame, Share2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatShortDate, plural } from "@/lib/format";
import { textoProgresso, type MedalhaDoAtleta, type Sequencia } from "@/lib/conquistas";
import { Button } from "@/components/ui/Button";
import { Medalha } from "./Medalha";

/** Início: a sequência em destaque, a próxima medalha e as últimas conquistas. */
export function CardConquistas({
  carregando,
  sequencia,
  proxima,
  recentes,
  conquistadas,
  total,
  hrefTodas,
  onCompartilhar,
}: {
  carregando: boolean;
  sequencia: Sequencia | null;
  proxima: MedalhaDoAtleta | null;
  recentes: MedalhaDoAtleta[];
  conquistadas: number;
  total: number;
  hrefTodas: string;
  onCompartilhar?: () => void;
}) {
  if (carregando) {
    return <div className="h-[260px] animate-pulse rounded-[var(--radius-lg)] border border-border bg-bg-card" aria-hidden="true" />;
  }
  const semanas = sequencia?.atual ?? 0;
  const dicaSequencia = !sequencia
    ? ""
    : semanas === 0
      ? "Treine esta semana para começar uma sequência."
      : !sequencia.treinouEstaSemana
        ? "Treine esta semana para manter a sequência."
        : sequencia.melhor > semanas
          ? `Sua melhor: ${plural(sequencia.melhor, "semana")}.`
          : "Sua melhor sequência até agora.";

  return (
    <section aria-labelledby="titulo-conquistas" className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-conquistas" className="text-lg font-extrabold text-text">
          Conquistas
        </h2>
        <Link
          href={hrefTodas}
          className="flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {conquistadas} de {total}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {/* A sequência é o número que mais muda o hábito: fica em destaque. */}
      <div className="mt-3 flex items-center gap-3.5 rounded-[var(--radius)] bg-bg-inset p-3.5">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full",
            semanas > 0 ? "bg-accent text-white shadow-[0_6px_16px_rgba(243,112,33,0.3)]" : "bg-bg-card text-text-muted",
          )}
        >
          <Flame className="size-6" aria-hidden="true" fill={semanas > 0 ? "currentColor" : "none"} />
        </span>
        <div className="min-w-0">
          <p className="text-text">
            <span className="text-2xl font-black tabular-nums">{semanas}</span>{" "}
            <span className="font-bold">{semanas === 1 ? "semana seguida" : "semanas seguidas"}</span>
          </p>
          <p className="text-xs text-text-light">{dicaSequencia}</p>
        </div>
      </div>

      {proxima ? (
        <div className="mt-3 flex items-center gap-3.5 px-1">
          <Medalha icone={proxima.icone} nivel={proxima.nivel} conquistada={false} progresso={proxima.progresso.atual / proxima.progresso.meta} tamanho={48} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text-light">
              Próxima: <span className="font-bold text-text">{proxima.titulo}</span>
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-inset" role="progressbar" aria-label={`Progresso para ${proxima.titulo}`} aria-valuemin={0} aria-valuemax={proxima.progresso.meta} aria-valuenow={proxima.progresso.atual}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (proxima.progresso.atual / proxima.progresso.meta) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs tabular-nums text-text-muted">{textoProgresso(proxima)}</p>
          </div>
        </div>
      ) : null}

      {recentes.length ? (
        <ul className="mt-4 flex gap-3 border-t border-border-subtle pt-4" aria-label="Últimas conquistas">
          {recentes.map((m) => (
            <li key={m.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
              <Medalha icone={m.icone} nivel={m.nivel} conquistada tamanho={44} />
              <span className="line-clamp-2 text-xs font-semibold leading-tight text-text">{m.titulo}</span>
              {m.em ? <span className="text-[11px] text-text-muted">{formatShortDate(m.em)}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-border-subtle pt-4 text-sm text-text-light">Seu primeiro treino já vale medalha.</p>
      )}

      {onCompartilhar ? (
        <Button variant="secondary" className="mt-4 w-full" onClick={onCompartilhar}>
          <Share2 className="size-4" aria-hidden="true" />
          Compartilhar meu mês
        </Button>
      ) : null}
    </section>
  );
}
