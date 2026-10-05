"use client";

import type { ReactNode } from "react";
import { Bike, Footprints } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDistancia, formatPontos, plural } from "@/lib/format";
import { calcularPosicoesRanking } from "@/lib/rankingPosition";
import type { ModalidadeStats } from "@/lib/dashboardStats";
import type { AtletaDoc } from "@/lib/types";

type Mod = "corrida" | "bicicleta";

const IDENTIDADE: Record<Mod, { nome: string; icon: typeof Bike; caixa: string; barra: string }> = {
  corrida: { nome: "Corrida", icon: Footprints, caixa: "bg-sport-running-subtle text-sport-running", barra: "bg-sport-running" },
  bicicleta: { nome: "Bike", icon: Bike, caixa: "bg-sport-cycling-subtle text-sport-cycling", barra: "bg-sport-cycling" },
};

const MEDALHA = [
  "bg-ranking-gold-bg text-ranking-gold-text",
  "bg-ranking-silver-bg text-ranking-silver-text",
  "bg-ranking-bronze-bg text-ranking-bronze-text",
];

/** Linha da tabela: rótulo à esquerda e o valor de cada modalidade alinhado em coluna. */
function Linha({ rotulo, ajuda, corrida, bicicleta }: { rotulo: string; ajuda?: string; corrida: ReactNode; bicicleta: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 py-3 sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text">{rotulo}</p>
        {ajuda ? <p className="hidden text-xs text-text-muted sm:block">{ajuda}</p> : null}
      </div>
      <div className="min-w-0">{corrida}</div>
      <div className="min-w-0">{bicicleta}</div>
    </div>
  );
}

function Valor({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-base font-bold tabular-nums text-text sm:text-lg">{children}</p>
      {sub ? <p className="truncate text-xs text-text-light">{sub}</p> : null}
    </div>
  );
}

function Percentual({ valor, mod, sub }: { valor: number | null; mod: Mod; sub?: ReactNode }) {
  if (valor === null) return <Valor sub="sem agenda">—</Valor>;
  return (
    <div className="min-w-0">
      <p className="text-base font-bold tabular-nums text-text sm:text-lg">{valor}%</p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-inset" aria-hidden="true">
        <div className={cn("h-full rounded-full", IDENTIDADE[mod].barra)} style={{ width: `${Math.min(100, valor)}%` }} />
      </div>
      {sub ? <p className="mt-1 truncate text-xs text-text-light">{sub}</p> : null}
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="pt-4 text-xs font-bold uppercase tracking-wide text-text-muted">{titulo}</p>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Podio({ atletas }: { atletas: AtletaDoc[] }) {
  if (atletas.length === 0) return <p className="text-sm text-text-light">Sem pontuação ainda.</p>;
  const posicoes = calcularPosicoesRanking(atletas.map((a) => a.pontuacaoTotal));
  return (
    <ol className="flex flex-col gap-2">
      {atletas.map((a, i) => (
        <li key={a.id} className="flex items-center gap-2.5 text-sm">
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", MEDALHA[Math.min(posicoes[i], 3) - 1])}>
            {posicoes[i]}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-text">{a.nome}</span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-text-light">{formatPontos(a.pontuacaoTotal)} pts</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Corrida × Bike numa tabela só: cada número fica na mesma linha para as duas,
 * com o período escrito no grupo (últimos 30 dias / desde o início).
 */
export function ComparativoModalidades({
  corrida,
  bicicleta,
  podioCorrida,
  podioBicicleta,
  aderencia,
  className,
}: {
  corrida: ModalidadeStats;
  bicicleta: ModalidadeStats;
  podioCorrida: AtletaDoc[];
  podioBicicleta: AtletaDoc[];
  aderencia: { corrida: number | null; bicicleta: number | null };
  className?: string;
}) {
  const cabecalho = (mod: Mod, s: ModalidadeStats) => {
    const { nome, icon: Icon, caixa } = IDENTIDADE[mod];
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn("hidden size-9 shrink-0 items-center justify-center rounded-[var(--radius)] sm:flex", caixa)}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-text">{nome}</p>
          <p className="truncate text-xs text-text-light">{plural(s.total, "atleta")}</p>
        </div>
      </div>
    );
  };

  return (
    <section
      aria-labelledby="titulo-modalidades"
      className={cn("rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5", className)}
    >
      <h2 id="titulo-modalidades" className="text-base font-bold text-text">
        Corrida e Bike
      </h2>

      <div className="mt-3 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-3 border-b border-border pb-3 sm:gap-6">
        <span aria-hidden="true" />
        {cabecalho("corrida", corrida)}
        {cabecalho("bicicleta", bicicleta)}
      </div>

      <Grupo titulo="Últimos 30 dias">
        <Linha
          rotulo="Treinando"
          ajuda="Com ao menos uma participação"
          corrida={<Percentual valor={corrida.engajamento} mod="corrida" sub={`${corrida.ativos30d} de ${corrida.total}`} />}
          bicicleta={<Percentual valor={bicicleta.engajamento} mod="bicicleta" sub={`${bicicleta.ativos30d} de ${bicicleta.total}`} />}
        />
        <Linha
          rotulo="Aderência"
          ajuda="Presença nos dias de treino"
          corrida={<Percentual valor={aderencia.corrida} mod="corrida" />}
          bicicleta={<Percentual valor={aderencia.bicicleta} mod="bicicleta" />}
        />
      </Grupo>

      <Grupo titulo="Desde o início">
        <Linha rotulo="Participações" corrida={<Valor>{corrida.participacoes}</Valor>} bicicleta={<Valor>{bicicleta.participacoes}</Valor>} />
        <Linha
          rotulo="Pontos"
          corrida={<Valor sub={`${formatPontos(corrida.media)} por atleta`}>{formatPontos(corrida.pontos)}</Valor>}
          bicicleta={<Valor sub={`${formatPontos(bicicleta.media)} por atleta`}>{formatPontos(bicicleta.pontos)}</Valor>}
        />
        <Linha
          rotulo="Quilometragem"
          corrida={<Valor>{corrida.km > 0 ? formatDistancia(corrida.km) : "—"}</Valor>}
          bicicleta={<Valor>{bicicleta.km > 0 ? formatDistancia(bicicleta.km) : "—"}</Valor>}
        />
      </Grupo>

      {/* Pódio nas mesmas colunas da tabela. */}
      <div className="mt-1 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-6">
        <p className="hidden text-xs font-bold uppercase tracking-wide text-text-muted sm:block">Pódio</p>
        {(
          [
            ["Corrida", podioCorrida],
            ["Bike", podioBicicleta],
          ] as const
        ).map(([nome, podio]) => (
          <div key={nome} className="min-w-0">
            {/* No celular cada pódio vem com o nome da modalidade; no computador a coluna já diz. */}
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted sm:hidden">Pódio · {nome}</p>
            <Podio atletas={podio} />
          </div>
        ))}
      </div>
    </section>
  );
}
