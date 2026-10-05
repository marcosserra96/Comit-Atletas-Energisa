"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock4,
  ListChecks,
  Moon,
  Sparkles,
  UserX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { SportBadge } from "@/components/ui/SportBadge";
import { formatPontos, formatShortDate, plural } from "@/lib/format";
import { equipeLabel } from "@/lib/labels";
import { ehReuniao, horarioDoEvento } from "@/lib/eventos";
import { RequestCard } from "./atletas/RequestCard";
import { FichaAtletaModal } from "./atletas/ficha/FichaAtletaModal";
import type { AtletaDoc, EventoDoc, RegraPontuacaoDoc, SolicitacaoAcessoDoc } from "@/lib/types";

type ChaveAtencao = "solicitacoes" | "fila" | "eventos" | "inativos" | "semParticipacao" | "criterios";

export interface DadosAtencao {
  solicitacoes: SolicitacaoAcessoDoc[] | null;
  atletasSemVinculo: AtletaDoc[];
  fila: AtletaDoc[];
  eventosPendentes: EventoDoc[];
  inativos30d: AtletaDoc[];
  semParticipacao: AtletaDoc[];
  criteriosSemUso: RegraPontuacaoDoc[];
}

export interface PermissoesAtencao {
  admin: boolean;
  atletas: boolean;
  registrar: boolean;
}

interface Item {
  chave: ChaveAtencao;
  icon: typeof Clock4;
  titulo: string;
  dica: string;
  destaque?: boolean;
}

function modalidadeDaEquipe(equipe: string) {
  return equipe.includes("bicicleta") ? "bicicleta" : equipe.includes("corrida") ? "corrida" : null;
}

/* ---------- Linhas reutilizadas nas listas ---------- */

function LinhaAtleta({
  atleta,
  detalhe,
  onAbrir,
  posicao,
}: {
  atleta: AtletaDoc;
  detalhe?: ReactNode;
  /** Sem permissão de Atletas a linha só informa (a ficha exige essa permissão). */
  onAbrir?: () => void;
  posicao?: number;
}) {
  // Na fila a lista já vem separada por modalidade: o selo seria repetição.
  const modalidade = posicao === undefined ? modalidadeDaEquipe(atleta.equipe) : null;
  const Raiz = onAbrir ? "button" : "div";
  return (
    <li>
      <Raiz
        {...(onAbrir ? { type: "button" as const, onClick: onAbrir } : {})}
        className="group flex w-full min-h-14 items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-2"
      >
        {posicao !== undefined ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bg-inset text-xs font-bold tabular-nums text-text-light">
            {posicao}º
          </span>
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-sm font-bold text-primary">
            {atleta.nome.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">{atleta.nome}</span>
          {detalhe ? <span className="block truncate text-xs text-text-light">{detalhe}</span> : null}
        </span>
        {modalidade ? <SportBadge modalidade={modalidade} /> : null}
        {onAbrir ? (
          <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-primary">
            <span className="hidden sm:inline">Abrir ficha</span>
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        ) : null}
      </Raiz>
    </li>
  );
}

function Lista({ children }: { children: ReactNode }) {
  return <ul className="-mx-1 flex flex-col divide-y divide-border sm:-mx-2">{children}</ul>;
}

function LinkRodape({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-text-light hover:text-text">
      {children}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

/* ---------- Painel ---------- */

/**
 * "Precisa da sua atenção": cada item abre a lista de verdade, com a ação ali
 * mesmo (aprovar acesso, abrir a ficha, lançar os pontos do evento), sem
 * mandar para uma tela genérica.
 */
export function PainelAtencao({
  carregando,
  dados,
  permissoes,
  className,
}: {
  carregando: boolean;
  dados: DadosAtencao;
  permissoes: PermissoesAtencao;
  className?: string;
}) {
  const [aberto, setAberto] = useState<ChaveAtencao | null>(null);
  const [ficha, setFicha] = useState<AtletaDoc | null>(null);

  const itens: Item[] = [];
  const nSolic = dados.solicitacoes?.length ?? 0;
  if (permissoes.admin && nSolic > 0) {
    itens.push({
      chave: "solicitacoes",
      icon: Clock4,
      titulo: plural(nSolic, "pedido de acesso", "pedidos de acesso"),
      dica: "Aprovar ou recusar",
      destaque: true,
    });
  }
  if (permissoes.registrar && dados.eventosPendentes.length > 0) {
    itens.push({
      chave: "eventos",
      icon: CalendarClock,
      titulo: plural(dados.eventosPendentes.length, "evento sem pontos", "eventos sem pontos"),
      dica: "Lançar a pontuação",
      destaque: true,
    });
  }
  if (dados.inativos30d.length > 0) {
    itens.push({
      chave: "inativos",
      icon: Moon,
      titulo: plural(dados.inativos30d.length, "atleta parado", "atletas parados"),
      dica: "Sem atividade há mais de 30 dias",
    });
  }
  if (dados.semParticipacao.length > 0) {
    itens.push({
      chave: "semParticipacao",
      icon: UserX,
      titulo: plural(dados.semParticipacao.length, "atleta sem participação", "atletas sem participação"),
      dica: "Nunca teve um lançamento",
    });
  }
  if (permissoes.atletas && dados.fila.length > 0) {
    itens.push({
      chave: "fila",
      icon: Users,
      titulo: `${dados.fila.length} na fila de espera`,
      dica: "Ver a ordem de entrada",
    });
  }
  if (permissoes.admin && dados.criteriosSemUso.length > 0) {
    itens.push({
      chave: "criterios",
      icon: ListChecks,
      titulo: plural(dados.criteriosSemUso.length, "critério nunca usado", "critérios nunca usados"),
      dica: "Revisar ou remover",
    });
  }

  const abrirFicha = (a: AtletaDoc) => (permissoes.atletas ? () => setFicha(a) : undefined);
  const itemAberto = itens.find((i) => i.chave === aberto) ?? null;

  function conteudo(chave: ChaveAtencao) {
    switch (chave) {
      case "solicitacoes":
        return (
          <div className="flex flex-col gap-3">
            {(dados.solicitacoes ?? []).map((s) => (
              <RequestCard key={s.uid} solicitacao={s} atletasSemVinculo={dados.atletasSemVinculo} />
            ))}
          </div>
        );
      case "eventos":
        return (
          <Lista>
            {dados.eventosPendentes.map((e) => {
              const reuniao = ehReuniao(e);
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 py-3 sm:px-2">
                  <span className="w-16 shrink-0 whitespace-nowrap text-xs font-bold uppercase tabular-nums text-primary">{formatShortDate(e.data)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{e.titulo}</span>
                    <span className="block truncate text-xs text-text-light">
                      {reuniao ? `Reunião · ${horarioDoEvento(e)}` : e.local || "Evento esportivo"} ·{" "}
                      {plural(e.inscritos?.length ?? 0, "confirmado")}
                    </span>
                  </span>
                  <Link
                    href={reuniao ? `/gestao/eventos/${e.id}/presenca` : `/gestao/pontuacao?evento=${encodeURIComponent(e.id)}`}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius)] bg-primary px-3 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
                  >
                    {reuniao ? "Ver presenças" : "Lançar pontos"}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </Lista>
        );
      case "inativos":
        return (
          <Lista>
            {dados.inativos30d.map((a) => (
              <LinhaAtleta key={a.id} atleta={a} detalhe={equipeLabel[a.equipe] ?? a.equipe} onAbrir={abrirFicha(a)} />
            ))}
          </Lista>
        );
      case "semParticipacao":
        return (
          <Lista>
            {dados.semParticipacao.map((a) => (
              <LinhaAtleta
                key={a.id}
                atleta={a}
                detalhe={a.anoEntrada ? `No programa desde ${a.anoEntrada}` : equipeLabel[a.equipe] ?? a.equipe}
                onAbrir={abrirFicha(a)}
              />
            ))}
          </Lista>
        );
      case "fila": {
        const grupos = [
          { titulo: "Bike", atletas: dados.fila.filter((a) => a.equipe === "fila_bicicleta") },
          { titulo: "Corrida", atletas: dados.fila.filter((a) => a.equipe === "fila_corrida") },
        ].filter((g) => g.atletas.length > 0);
        return (
          <div className="flex flex-col gap-5">
            {grupos.map((g) => (
              <div key={g.titulo}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-text-light">
                  Fila · {g.titulo} ({g.atletas.length})
                </p>
                <Lista>
                  {g.atletas.map((a, i) => (
                    <LinhaAtleta key={a.id} atleta={a} posicao={i + 1} onAbrir={abrirFicha(a)} />
                  ))}
                </Lista>
              </div>
            ))}
          </div>
        );
      }
      case "criterios":
        return (
          <Lista>
            {dados.criteriosSemUso.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-1 py-3 sm:px-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text">{r.descricao}</span>
                  <span className="block truncate text-xs text-text-light">
                    {r.modalidade === "ambas" ? "Corrida e Bike" : r.modalidade === "bicicleta" ? "Bike" : "Corrida"}
                  </span>
                </span>
                <Badge tone="neutral">{formatPontos(r.pontos)} pts</Badge>
              </li>
            ))}
          </Lista>
        );
    }
  }

  const rodape: Partial<Record<ChaveAtencao, ReactNode>> = {
    solicitacoes: <LinkRodape href="/gestao/atletas?tab=pendentes">Ver também as recusadas</LinkRodape>,
    eventos: <p className="text-xs text-text-muted">Eventos dos últimos 7 dias ainda sem lançamento.</p>,
    inativos: <p className="text-xs text-text-muted">Abra a ficha para ver o histórico e registrar um comentário.</p>,
    fila: <LinkRodape href="/gestao/atletas?tab=equipes">Reordenar as filas</LinkRodape>,
    criterios: <LinkRodape href="/gestao/criterios">Editar critérios</LinkRodape>,
  };

  return (
    <section
      aria-labelledby="titulo-atencao"
      className={cn("rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5", className)}
    >
      <h2 id="titulo-atencao" className="flex items-center gap-2 text-base font-bold text-text">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        Precisa da sua atenção
      </h2>
      {carregando ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-text-light">
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
          Tudo em ordem — nenhuma ação pendente.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {itens.map((item) => (
            <li key={item.chave}>
              <button
                type="button"
                onClick={() => setAberto(item.chave)}
                className={cn(
                  "group flex w-full min-h-16 items-center gap-3 rounded-[var(--radius)] border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  item.destaque
                    ? "border-accent/30 bg-accent-subtle hover:border-accent/50"
                    : "border-border bg-bg hover:bg-bg-inset",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)]",
                    item.destaque ? "bg-accent/15 text-accent" : "bg-bg-inset text-text-light",
                  )}
                >
                  <item.icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-text">{item.titulo}</span>
                  <span className="block truncate text-xs text-text-light">{item.dica}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={itemAberto !== null}
        onClose={() => setAberto(null)}
        title={itemAberto?.titulo ?? ""}
        description={itemAberto?.dica}
        size="lg"
        mobileSheet
        footer={itemAberto && rodape[itemAberto.chave] ? <div className="flex w-full justify-start">{rodape[itemAberto.chave]}</div> : undefined}
      >
        {itemAberto ? conteudo(itemAberto.chave) : null}
      </Modal>
      <FichaAtletaModal atleta={ficha} onClose={() => setFicha(null)} />
    </section>
  );
}
