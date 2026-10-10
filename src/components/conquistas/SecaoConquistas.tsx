"use client";

import { useEffect } from "react";
import { Flame, Medal as MedalIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatShortDate, plural } from "@/lib/format";
import { textoProgresso, type MedalhaDoAtleta, type Sequencia } from "@/lib/conquistas";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Medalha } from "./Medalha";

const GRUPOS: { id: MedalhaDoAtleta["grupo"]; titulo: string }[] = [
  { id: "treinos", titulo: "Treinos" },
  { id: "distancia", titulo: "Distância" },
  { id: "constancia", titulo: "Constância" },
  { id: "especiais", titulo: "Especiais" },
];

/** Desempenho: todas as medalhas, conquistadas com a data e bloqueadas com o quanto falta. */
export function SecaoConquistas({
  medalhas,
  sequencia,
  conquistadas,
}: {
  medalhas: MedalhaDoAtleta[];
  sequencia: Sequencia | null;
  conquistadas: number;
}) {
  // Vindo de "Ver conquistas" (#conquistas): a seção só aparece depois dos dados, então rola aqui.
  useEffect(() => {
    if (window.location.hash === "#conquistas") document.getElementById("conquistas")?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <Card id="conquistas" className="scroll-mt-24">
      <SectionHeader title="Conquistas" icon={MedalIcon} action={<Badge tone="neutral">{conquistadas} de {medalhas.length}</Badge>} />
      {sequencia ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius)] bg-bg-inset px-4 py-3">
          <span className="flex items-center gap-2 text-text">
            <Flame className={cn("size-5", sequencia.atual ? "text-accent" : "text-text-muted")} fill={sequencia.atual ? "currentColor" : "none"} aria-hidden="true" />
            <span className="text-xl font-black tabular-nums">{sequencia.atual}</span>
            <span className="text-sm font-semibold">{sequencia.atual === 1 ? "semana seguida agora" : "semanas seguidas agora"}</span>
          </span>
          <span className="text-sm text-text-light">
            Melhor sequência: <strong className="font-semibold text-text">{plural(sequencia.melhor, "semana")}</strong>
          </span>
          <span className="text-xs text-text-muted">Semana com justificativa aprovada não quebra a sequência.</span>
        </div>
      ) : null}
      <div className="mt-5 flex flex-col gap-6">
        {GRUPOS.map((g) => {
          const itens = medalhas.filter((m) => m.grupo === g.id);
          if (itens.length === 0) return null;
          return (
            <section key={g.id} aria-label={g.titulo}>
              <h3 className="mb-3 text-sm font-bold text-text">{g.titulo}</h3>
              <ul className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-5">
                {itens.map((m) => (
                  <li key={m.id} className="flex flex-col items-center gap-2 text-center" title={m.descricao}>
                    <Medalha
                      icone={m.icone}
                      nivel={m.nivel}
                      conquistada={m.conquistada}
                      progresso={m.progresso.atual / m.progresso.meta}
                      tamanho={60}
                      rotulo={`${m.titulo}: ${m.conquistada ? "conquistada" : textoProgresso(m)}`}
                    />
                    <span className={cn("text-xs font-bold leading-tight", m.conquistada ? "text-text" : "text-text-light")}>{m.titulo}</span>
                    <span className="-mt-1 text-[11px] leading-tight text-text-muted">
                      {m.conquistada ? (m.em ? formatShortDate(m.em) : "Conquistada") : m.doServidor ? m.descricao.replace(/\.$/, "") : textoProgresso(m)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Card>
  );
}
