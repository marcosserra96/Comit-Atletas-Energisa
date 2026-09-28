import { cn } from "@/lib/cn";

export interface NumeroDoPainel {
  rotulo: string;
  valor: string;
  detalhe?: string;
  /** Cor do valor quando ele próprio é o sinal (ex.: desvio negativo). */
  tom?: "success" | "danger";
}

const COLUNAS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

const COLUNAS_SM: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * Faixa de números de um painel: um card só, com as células separadas por
 * linhas finas. Substitui a pilha de cards coloridos, que no celular virava
 * uma coluna de caixas altas com o valor quebrando em duas linhas.
 */
export function PainelNumeros({
  itens,
  emLinhasNoCelular = false,
  className,
}: {
  itens: NumeroDoPainel[];
  /** Para valores longos (ex.: reais): no celular, uma linha por número, com o valor à direita. */
  emLinhasNoCelular?: boolean;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border shadow-[var(--shadow-card)]",
        emLinhasNoCelular
          ? cn("grid-cols-1", COLUNAS_SM[itens.length] ?? "sm:grid-cols-3")
          : (COLUNAS[itens.length] ?? "grid-cols-2 sm:grid-cols-3"),
        className,
      )}
    >
      {itens.map((item) => (
        <div
          key={item.rotulo}
          className={cn(
            "flex min-w-0 flex-col bg-bg-card p-3.5 sm:p-5",
            emLinhasNoCelular && "max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:items-baseline max-sm:gap-x-3 max-sm:py-3",
          )}
        >
          <dt className="truncate text-xs font-semibold text-text-light">{item.rotulo}</dt>
          <dd
            className={cn(
              "mt-1 truncate text-lg font-extrabold tabular-nums sm:text-xl",
              emLinhasNoCelular && "max-sm:mt-0 max-sm:text-right max-sm:text-base",
              item.tom === "success" ? "text-success" : item.tom === "danger" ? "text-danger" : "text-text",
            )}
          >
            {item.valor}
          </dd>
          {item.detalhe ? (
            <dd className={cn("mt-0.5 line-clamp-2 text-xs text-text-light", emLinhasNoCelular && "max-sm:col-span-2")}>
              {item.detalhe}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
