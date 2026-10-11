"use client";

import { useEffect } from "react";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import { textoProgresso } from "@/lib/conquistas";
import { diasRestantes, noPeriodo, textoMeta, textoPeriodo, type DesafioDoAtleta } from "@/lib/desafios";
import type { Modalidade } from "@/lib/types";
import { Medalha } from "./Medalha";

/** "22 dias restantes", "Último dia" (em laranja quando aperta e ainda falta). */
function Prazo({ item, hoje }: { item: DesafioDoAtleta; hoje: string }) {
  const dias = diasRestantes(item.desafio, hoje);
  const urgente = dias <= 3 && !item.progresso.concluidoEm;
  return (
    <span className={cn("flex shrink-0 items-center gap-1 font-semibold", urgente ? "text-accent" : "text-text-light")}>
      <CalendarClock className="size-3.5" aria-hidden="true" />
      {dias === 1 ? "Último dia" : `${dias} dias restantes`}
    </span>
  );
}

function LinhaDesafio({ item, modalidade, hoje }: { item: DesafioDoAtleta; modalidade: Modalidade; hoje: string }) {
  const { desafio, progresso, medalha } = item;
  const concluido = progresso.concluidoEm !== null;
  const fracao = progresso.atual / progresso.meta;
  return (
    <li className="flex gap-3.5 py-4 first:pt-0 last:pb-0">
      <Medalha
        icone={medalha.icone}
        nivel={medalha.nivel}
        conquistada={concluido}
        progresso={fracao}
        tamanho={56}
        rotulo={`${desafio.titulo}: ${concluido ? "concluído" : textoProgresso(medalha)}`}
      />
      <div className="min-w-0 flex-1">
        <p className="pt-0.5 text-md font-extrabold leading-tight text-text">{desafio.titulo}</p>
        <p className="mt-0.5 text-sm text-text-light">
          {textoMeta(desafio, modalidade)} {noPeriodo(desafio)}
        </p>
        {item.status === "agendado" ? (
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-text-light">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Começa em {textoPeriodo({ inicio: desafio.inicio, fim: desafio.inicio })}
          </p>
        ) : (
          <>
            <div
              className="mt-2.5 h-2 overflow-hidden rounded-full bg-bg-inset"
              role="progressbar"
              aria-label={`Progresso em ${desafio.titulo}`}
              aria-valuemin={0}
              aria-valuemax={progresso.meta}
              aria-valuenow={progresso.atual}
            >
              <div
                className={cn("h-full rounded-full", concluido ? "bg-success" : "bg-primary")}
                style={{ width: `${fracao > 0 ? Math.max(4, fracao * 100) : 0}%` }}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs tabular-nums">
              {concluido ? (
                <span className="flex items-center gap-1 font-semibold text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Concluído em {formatShortDate(progresso.concluidoEm!)}
                </span>
              ) : (
                <span className="font-semibold text-text">{textoProgresso(medalha)}</span>
              )}
              {concluido ? null : <Prazo item={item} hoje={hoje} />}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

/** Início: os desafios do comitê em andamento (e os que vão começar), com prazo e progresso. */
export function CardDesafios({ itens, modalidade, hoje }: { itens: DesafioDoAtleta[]; modalidade: Modalidade; hoje: string }) {
  const visiveis = itens.filter((i) => i.status !== "encerrado");
  const tem = visiveis.length > 0;
  // Vindo do aviso de desafio novo (#desafios): o card só aparece depois dos dados, então rola aqui.
  useEffect(() => {
    if (tem && window.location.hash === "#desafios") document.getElementById("desafios")?.scrollIntoView({ block: "start" });
  }, [tem]);
  if (!tem) return null;
  return (
    <section
      id="desafios"
      aria-labelledby="titulo-desafios"
      className="scroll-mt-24 rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <h2 id="titulo-desafios" className="text-lg font-extrabold text-text">
        {visiveis.length === 1 ? "Desafio do comitê" : "Desafios do comitê"}
      </h2>
      <ul className="mt-4 divide-y divide-border-subtle">
        {visiveis.map((item) => (
          <LinhaDesafio key={item.desafio.id} item={item} modalidade={modalidade} hoje={hoje} />
        ))}
      </ul>
    </section>
  );
}
