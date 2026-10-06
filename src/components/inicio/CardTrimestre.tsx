"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Trophy } from "lucide-react";
import { formatDistancia, formatPontos, formatShortDate, plural } from "@/lib/format";
import { textoTempoDoPeriodo } from "@/lib/tempoPeriodo";
import type { TrimestreDoAtleta } from "@/lib/trimestre";

/**
 * Trimestre em destaque no Início: é o período que vale na premiação.
 * A barra mostra quanto do trimestre já passou (não é meta de pontos).
 */
export function CardTrimestre({
  trimestre,
  nomeModalidade,
  hrefRanking,
  rankingFechado,
}: {
  /** `undefined` carregando. */
  trimestre: TrimestreDoAtleta | undefined;
  nomeModalidade: string;
  hrefRanking: string;
  /** Ranking oculto para conferência ou desativado. */
  rankingFechado: boolean;
}) {
  if (trimestre === undefined) {
    return <div className="h-[212px] animate-pulse rounded-[var(--radius-lg)] border border-border bg-bg-card" aria-hidden="true" />;
  }

  const { tempo } = trimestre;
  const linhaPosicao = rankingFechado
    ? "Ranking em fechamento para conferência"
    : trimestre.posicao
      ? `de ${plural(trimestre.totalNoRanking, "atleta")} na ${nomeModalidade}`
      : "Pontue no trimestre para entrar no ranking";

  return (
    <section
      aria-labelledby="titulo-trimestre"
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-ranking-gold/40 bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ranking-gold-text">
            <Trophy className="size-3.5" aria-hidden="true" />
            Vale para a premiação
          </p>
          <h2 id="titulo-trimestre" className="mt-0.5 text-lg font-extrabold text-text first-letter:uppercase">
            {trimestre.nome}
          </h2>
        </div>
        <Link
          href={hrefRanking}
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Ver ranking
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-[var(--radius)] bg-bg-inset py-3 text-center">
        <div className="px-2">
          <dd className="text-2xl font-black tabular-nums text-ranking-gold-text">
            {trimestre.posicao && !rankingFechado ? `${trimestre.posicao}º` : "—"}
          </dd>
          <dt className="text-xs text-text-muted">posição</dt>
        </div>
        <div className="px-2">
          <dd className="text-2xl font-black tabular-nums text-text">{formatPontos(trimestre.pontos)}</dd>
          <dt className="text-xs text-text-muted">{trimestre.pontos === 1 ? "ponto" : "pontos"}</dt>
        </div>
        <div className="px-2">
          <dd className="text-2xl font-black tabular-nums text-text">{trimestre.treinos}</dd>
          <dt className="text-xs text-text-muted">{trimestre.treinos === 1 ? "treino" : "treinos"}</dt>
        </div>
      </dl>

      <p className="mt-3 px-1 text-sm text-text-light">
        {linhaPosicao}
        {trimestre.km > 0 ? <span className="text-text-muted"> · {formatDistancia(trimestre.km)} km</span> : null}
      </p>

      <div className="mt-3 px-1">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-text-light">
            {formatShortDate(trimestre.inicio)} a {formatShortDate(trimestre.fim)}
          </span>
          <span className="font-semibold text-text">{textoTempoDoPeriodo(tempo)}</span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-inset"
          role="progressbar"
          aria-label="Quanto do trimestre já passou"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(tempo.progresso * 100)}
        >
          <motion.div
            className="h-full origin-left rounded-full bg-ranking-gold"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: tempo.progresso }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          />
        </div>
        {trimestre.premiacaoTexto ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-text-light">
            <Trophy className="size-3.5 shrink-0 text-ranking-gold-text" aria-hidden="true" />
            Premiação em <strong className="font-semibold text-text">{trimestre.premiacaoTexto}</strong>
          </p>
        ) : null}
      </div>
    </section>
  );
}
