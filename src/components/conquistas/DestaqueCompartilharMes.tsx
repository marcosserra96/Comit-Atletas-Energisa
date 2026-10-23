"use client";

import { useEffect, useMemo, useState } from "react";
import { Share2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDistancia, plural } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { CartaoDoMes } from "./CartaoDoMes";
import { periodoQueFechou, type IdPeriodoResumo } from "@/lib/resumoPeriodo";
import { dadosDoCartaoDoMes, Previa, type ParamsCartaoDoMes } from "./CompartilharMes";

function ler(chave: string) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

/**
 * Logo depois que um período fecha, o Início mostra a imagem dele já montada
 * (miniatura de verdade), para o atleta ver que dá para compartilhar: o ano
 * (1 a 7 de janeiro), o trimestre (7 dias depois do fim) ou o mês (dias 1 a 7).
 * Só para quem treinou no período; fechar esconde aquele período.
 */
export function DestaqueCompartilharMes({
  params,
  hoje,
  onAbrir,
  somenteLeitura,
  className,
}: {
  params: ParamsCartaoDoMes;
  hoje: string;
  onAbrir: (periodo: IdPeriodoResumo) => void;
  /** Comitê vendo como o atleta: mostra, mas fechar não grava nada. */
  somenteLeitura?: boolean;
  className?: string;
}) {
  const periodo = useMemo(() => periodoQueFechou(hoje, params.trimestres), [hoje, params.trimestres]);
  const dados = useMemo(() => (periodo ? dadosDoCartaoDoMes(params, periodo) : null), [periodo, params]);
  const chave = `destaque-resumo:${params.atleta.id}:${periodo?.arquivo ?? ""}`;

  // Lido depois de montar: o servidor não tem o localStorage.
  const [fechado, setFechado] = useState<boolean | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setFechado(!somenteLeitura && ler(chave) === "fechado"), 0);
    return () => window.clearTimeout(id);
  }, [chave, somenteLeitura]);

  if (!periodo || !dados || dados.treinos === 0 || fechado !== false) return null;
  const abrir = () => onAbrir(periodo.id);
  const onde = periodo.id === "ano" ? "no ano" : periodo.id === "trimestre" ? "no trimestre" : "no mês";

  function fechar() {
    if (!somenteLeitura) {
      try {
        window.localStorage.setItem(chave, "fechado");
      } catch {
        /* segue só nesta visita */
      }
    }
    setFechado(true);
  }

  const km = dados.km >= 1 ? ` e ${formatDistancia(dados.km)} km` : "";

  return (
    <section
      aria-labelledby="destaque-mes-titulo"
      className={cn("relative flex items-center gap-4 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:gap-5 sm:p-5", className)}
    >
      <button
        type="button"
        onClick={abrir}
        aria-label={`Ver a imagem: ${periodo.titulo}`}
        className="shrink-0 rounded-[var(--radius)] transition-transform hover:-rotate-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
      >
        <Previa className="w-[76px] rotate-[-4deg] rounded-[var(--radius)] sm:w-[92px]">
          <CartaoDoMes dados={dados} />
        </Previa>
      </button>
      <div className="min-w-0 flex-1">
        <h2 id="destaque-mes-titulo" className="pr-8 text-lg font-extrabold leading-tight text-text [text-wrap:balance]">
          {periodo.id === "este" || periodo.id === "passado" ? `Seu ${periodo.titulo.toLowerCase()}` : periodo.nomeNaFrase} virou imagem
        </h2>
        <p className="mt-1 text-sm text-text-secondary [text-wrap:pretty]">
          {plural(dados.treinos, "treino")}
          {km} {onde}. Compartilhe no status do WhatsApp ou nos stories.
        </p>
        <Button className="mt-3" size="sm" onClick={abrir}>
          <Share2 className="size-4" aria-hidden="true" />
          Ver e compartilhar
        </Button>
      </div>
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar destaque do mês"
        className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pointer-coarse:size-11"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}
