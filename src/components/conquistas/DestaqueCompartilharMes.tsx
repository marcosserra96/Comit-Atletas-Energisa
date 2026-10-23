"use client";

import { useEffect, useMemo, useState } from "react";
import { Share2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDistancia, plural } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { CartaoDoMes } from "./CartaoDoMes";
import { periodoDoMes, periodoQueFechou, type IdPeriodoResumo } from "@/lib/resumoPeriodo";
import { dadosDoCartaoDoMes, Previa, type ParamsCartaoDoMes } from "./CompartilharMes";

function ler(chave: string) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

/**
 * "Compartilhe seu mês", fixo no Início, com a miniatura da imagem de verdade
 * para o atleta ver que dá para compartilhar. No dia a dia mostra o mês atual,
 * avisando que ainda não fechou. Logo depois de um fechamento (o ano de 1 a 7
 * de janeiro, o trimestre 7 dias depois do fim, o mês nos dias 1 a 7) vira o
 * destaque daquele período; fechar o destaque volta para o mês atual.
 */
export function DestaqueCompartilharMes({
  params,
  hoje,
  onAbrir,
  className,
}: {
  params: ParamsCartaoDoMes;
  hoje: string;
  onAbrir: (periodo: IdPeriodoResumo) => void;
  className?: string;
}) {
  const fechou = useMemo(() => periodoQueFechou(hoje, params.trimestres), [hoje, params.trimestres]);
  const dadosFechou = useMemo(() => (fechou ? dadosDoCartaoDoMes(params, fechou) : null), [fechou, params]);
  const atual = useMemo(() => periodoDoMes(hoje, 0), [hoje]);
  const dadosAtual = useMemo(() => dadosDoCartaoDoMes(params, atual), [atual, params]);
  const chave = `destaque-resumo:${params.atleta.id}:${fechou?.arquivo ?? ""}`;

  // Lido depois de montar: o servidor não tem o localStorage.
  const [dispensado, setDispensado] = useState<boolean | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setDispensado(ler(chave) === "fechado"), 0);
    return () => window.clearTimeout(id);
  }, [chave]);

  const destaque = !!fechou && !!dadosFechou && dadosFechou.treinos > 0 && dispensado === false;
  const periodo = destaque ? fechou! : atual;
  const dados = destaque ? dadosFechou! : dadosAtual;
  const abrir = () => onAbrir(periodo.id);
  const km = dados.km >= 1 ? ` e ${formatDistancia(dados.km)} km` : "";
  const nome = periodo.id === "este" || periodo.id === "passado" ? periodo.titulo.toLowerCase() : periodo.titulo;
  const onde = periodo.id === "ano" ? "no ano" : periodo.id === "trimestre" ? "no trimestre" : "no mês";

  function dispensar() {
    try {
      window.localStorage.setItem(chave, "fechado");
    } catch {
      /* segue só nesta visita */
    }
    setDispensado(true);
  }

  return (
    <section
      aria-labelledby="destaque-mes-titulo"
      className={cn(
        "relative flex items-center gap-4 overflow-hidden rounded-[var(--radius-lg)] border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:gap-5 sm:p-5",
        destaque ? "border-accent/30" : "border-border",
        className,
      )}
    >
      {destaque ? <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/10 to-transparent" aria-hidden="true" /> : null}
      <button
        type="button"
        onClick={abrir}
        aria-label={`Ver a imagem: ${periodo.titulo}`}
        className="relative shrink-0 rounded-[var(--radius)] transition-transform hover:-rotate-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
      >
        <Previa className="w-[76px] rotate-[-4deg] rounded-[var(--radius)] sm:w-[92px]">
          <CartaoDoMes dados={dados} />
        </Previa>
      </button>
      <div className="relative min-w-0 flex-1">
        <h2 id="destaque-mes-titulo" className={cn("text-lg font-extrabold leading-tight text-text [text-wrap:balance]", destaque && "pr-8")}>
          {destaque ? `Seu ${nome} virou imagem` : "Compartilhe seu mês"}
        </h2>
        {destaque ? (
          <p className="mt-1 text-sm text-text-secondary [text-wrap:pretty]">
            {plural(dados.treinos, "treino")}
            {km} {onde}. Compartilhe no status do WhatsApp ou nos stories.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-text-secondary [text-wrap:pretty]">
              Uma imagem com os seus treinos, pronta para mostrar sua evolução no status ou nos stories.
            </p>
            {/* O mês ainda está aberto: os números são até hoje (a imagem também avisa). */}
            <p className="mt-1.5 text-xs font-semibold text-text-light">
              {dados.treinos > 0
                ? `${periodo.titulo} até agora: ${plural(dados.treinos, "treino")}${km}`
                : `Seu primeiro treino de ${nome} já entra nela`}
            </p>
          </>
        )}
        <Button className="mt-3" size="sm" onClick={abrir}>
          <Share2 className="size-4" aria-hidden="true" />
          Ver e compartilhar
        </Button>
      </div>
      {destaque ? (
        <button
          type="button"
          onClick={dispensar}
          aria-label="Fechar o destaque e voltar ao mês atual"
          className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pointer-coarse:size-11"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}
