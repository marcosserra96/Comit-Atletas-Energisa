"use client";

import { dataIsoLocal } from "@/lib/date";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  Bike,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock4,
  Footprints,
  ListChecks,
  Sparkles,
  UserX,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { db } from "@/lib/firebase";
import { formatBRL, formatDecimal, formatShortDate, formatKm, plural } from "@/lib/format";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { calcularEstatisticasDashboard } from "@/lib/dashboardStats";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { calcularPosicoesRanking } from "@/lib/rankingPosition";
import { ExportarRelatorioDropdown } from "./ExportarRelatorioDropdown";
import type {
  AtletaDoc,
  DespesaDoc,
  EventoDoc,
  HistoricoMensalDoc,
  HistoricoPontoDoc,
  RegraPontuacaoDoc,
  SolicitacaoAcessoDoc,
} from "@/lib/types";
import { modalidadeLabel } from "@/lib/labels";

/** Arredonda o teto do eixo Y pra um número "redondo" (1/2/5 × potência de 10) e devolve os ticks de 0 até ele. */
function calcularTicksGrafico(valorMaximo: number, alvoTicks = 4): number[] {
  const maximo = Math.max(1, valorMaximo);
  const bruto = maximo / Math.max(1, alvoTicks - 1);
  // Contagens são sempre inteiras — nunca vale a pena um passo menor que 1.
  const potencia = Math.max(1, Math.pow(10, Math.floor(Math.log10(bruto))));
  const fracao = bruto / potencia;
  const passo = (fracao < 1.5 ? 1 : fracao < 3 ? 2 : fracao < 7 ? 5 : 10) * potencia;
  const teto = Math.ceil(maximo / passo) * passo;
  const ticks: number[] = [];
  for (let v = 0; v <= teto + passo * 0.001; v += passo) ticks.push(Math.round(v));
  return ticks;
}

export function VisaoEstrategica() {
  const { usuario } = useActiveSession();
  const isAdmin = usuario.role === "administrador";

  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [historicoMensal, setHistoricoMensal] = useState<HistoricoMensalDoc[] | null>(null);
  const [despesas, setDespesas] = useState<DespesaDoc[] | null>(null);
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [regras, setRegras] = useState<RegraPontuacaoDoc[] | null>(null);
  const [pendentes, setPendentes] = useState<SolicitacaoAcessoDoc[] | null>(null);
  const [mesHover, setMesHover] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "atletas"),
      (snap) =>
        setAtletas(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
            .filter(perfilAtletaVisivel),
        ),
      () => setAtletas([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "historico_pontos")),
      getDocs(collection(db, "historico_mensal")),
    ]).then(([snapLancamentos, snapMensal]) => {
      setLancamentos(
        snapLancamentos.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc),
      );
      setHistoricoMensal(
        snapMensal.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoMensalDoc),
      );
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "despesas"),
      (snap) => setDespesas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DespesaDoc)),
      () => setDespesas([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "agenda_eventos"), orderBy("data", "asc")),
      (snap) => setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc)),
      () => setEventos([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "solicitacoes_acesso"), where("status", "==", "pendente")),
      (snap) => setPendentes(snap.docs.map((d) => d.data() as SolicitacaoAcessoDoc)),
      () => setPendentes([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "regras_pontuacao"),
      (snap) => setRegras(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc)),
      () => setRegras([]),
    );
    return unsubscribe;
  }, []);

  const stats = useMemo(
    () =>
      calcularEstatisticasDashboard({
        atletas: atletas ?? [],
        lancamentos: lancamentos ?? [],
        resumosMensais: historicoMensal ?? [],
        despesas: despesas ?? [],
        eventos: eventos ?? [],
        regras: regras ?? [],
      }),
    [atletas, lancamentos, historicoMensal, despesas, eventos, regras],
  );

  const lancamentosVisiveis = useMemo(() => {
    if (!atletas || !lancamentos) return [];
    const atletaIds = new Set(atletas.map((item) => item.id));
    return lancamentos.filter((item) => atletaIds.has(item.atletaId));
  }, [atletas, lancamentos]);

  const proximosEventos = useMemo(
    () => (eventos ?? []).filter((e) => e.data >= dataIsoLocal()).slice(0, 5),
    [eventos],
  );

  const carregando =
    atletas === null ||
    lancamentos === null ||
    historicoMensal === null ||
    despesas === null;
  const ticksGrafico = calcularTicksGrafico(Math.max(...stats.seriesMensal.map((s) => s.count)));
  const tetoGrafico = ticksGrafico[ticksGrafico.length - 1];
  const mesAtualIdx = stats.seriesMensal.length - 1;

  const prioridades: Prioridade[] = [
    ...(isAdmin && (pendentes?.length ?? 0) > 0
      ? [{
          href: "/gestao/atletas?tab=pendentes",
          icon: Clock4,
          texto: plural(pendentes!.length, "solicitação de acesso", "solicitações de acesso"),
          destaque: true,
        }]
      : []),
    ...(stats.filaAguardando > 0
      ? [{ href: "/gestao/atletas?tab=equipes", icon: Users, texto: `${stats.filaAguardando} na fila de espera` }]
      : []),
    ...(stats.eventosPendentesLancamento > 0
      ? [{
          href: "/gestao/pontuacao",
          icon: CalendarClock,
          texto: plural(stats.eventosPendentesLancamento, "evento sem pontos lançados", "eventos sem pontos lançados"),
        }]
      : []),
    ...(stats.atletasSemAtividade > 0
      ? [{
          href: "/gestao/atletas?tab=ver",
          icon: UserX,
          texto: plural(stats.atletasSemAtividade, "atleta sem nenhuma participação", "atletas sem nenhuma participação"),
        }]
      : []),
    ...(isAdmin && stats.regrasSemUso > 0
      ? [{
          href: "/gestao/criterios",
          icon: ListChecks,
          texto: plural(stats.regrasSemUso, "critério nunca usado", "critérios nunca usados"),
        }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-text">Visão estratégica</h1>
          <p className="mt-0.5 text-sm text-text-light">
            {carregando
              ? "Carregando o programa…"
              : stats.ativosCount === 0
                ? "Cadastre atletas para começar a acompanhar o programa."
                : `${plural(stats.ativosCount, "atleta ativo", "atletas ativos")} · ${stats.engajamento30d}% engajados nos últimos 30 dias`}
          </p>
        </div>
        {isAdmin && !carregando && (
          <ExportarRelatorioDropdown
            stats={stats}
            eventos={eventos ?? []}
            lancamentos={lancamentosVisiveis}
            atletas={atletas ?? []}
          />
        )}
      </div>

      {/* 1. O que precisa de ação agora — vem antes dos números. */}
      <section aria-labelledby="titulo-atencao" className={painel}>
        <h2 id="titulo-atencao" className="flex items-center gap-2 text-base font-bold text-text">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Precisa da sua atenção
        </h2>
        {carregando ? (
          <div className="mt-3 h-12 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
        ) : prioridades.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-text-light">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            Tudo em ordem — nenhuma ação pendente.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {prioridades.map((item) => (
              <li key={item.href + item.texto}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex min-h-12 items-center gap-3 rounded-[var(--radius)] border px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    item.destaque
                      ? "border-accent/30 bg-accent-subtle hover:bg-accent/15"
                      : "border-border bg-bg hover:bg-bg-inset",
                  )}
                >
                  <item.icon
                    className={cn("size-4 shrink-0", item.destaque ? "text-accent" : "text-text-light")}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 font-medium text-text">{item.texto}</span>
                  <ChevronRight className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Números do programa — mesmo estilo para todos, sem cores competindo. */}
      <section
        aria-label="Números do programa"
        className="overflow-hidden rounded-[var(--radius-lg)] border border-border shadow-[var(--shadow-card)]"
      >
        {/* gap-px sobre fundo de borda desenha as linhas divisórias em qualquer número de colunas. */}
        <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
          <Numero rotulo="Engajamento" valor={`${stats.engajamento30d}%`} detalhe={`${stats.ativosRecentesCount} de ${plural(stats.ativosCount, "ativo")} em 30 dias`} barra={stats.engajamento30d} />
          <Numero rotulo="Participações" valor={String(stats.participacoesTotal)} />
          <Numero rotulo="Quilometragem" valor={formatKm(stats.kmTotal)} />
          <Numero rotulo="Custo realizado" valor={formatBRL(stats.investimentoTotal)} />
          <Numero rotulo="Custo por atleta" valor={formatBRL(stats.custoPorAtleta)} />
          <Numero rotulo="Custo médio" valor={formatBRL(stats.custoParticipacao)} detalhe={`por participação${stats.custoKm > 0 ? ` · ${formatBRL(stats.custoKm)} por km` : ""}`} />
        </dl>
      </section>

      {!carregando && stats.analisesExecutivas.length > 0 && (
        <section aria-labelledby="titulo-leitura" className={painel}>
          <h2 id="titulo-leitura" className="text-base font-bold text-text">Leitura do mês</h2>
          <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 lg:grid-cols-2">
            {stats.analisesExecutivas.map((texto, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-text-secondary">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {texto}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="titulo-evolucao" className={cn(painel, "min-w-0")}>
          <h2 id="titulo-evolucao" className="flex items-center gap-2 text-base font-bold text-text">
            <Activity className="size-4 text-primary" aria-hidden="true" />
            Evolução mensal
          </h2>
          <p className="mt-0.5 text-sm text-text-light">
            Participações por mês · toque ou passe o mouse numa barra para ver o total
          </p>

          {/* Espaço no topo para a marca máxima do eixo e o rótulo da barra não encostarem no subtítulo. */}
          <div className="mt-9 flex gap-2">
            <div className="relative h-[176px] w-7 shrink-0">
              {ticksGrafico.map((t) => (
                <span
                  key={t}
                  className="absolute right-1.5 -translate-y-1/2 text-xs tabular-nums text-text-muted"
                  style={{ bottom: `${(t / tetoGrafico) * 100}%` }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="relative h-[176px] flex-1">
              {ticksGrafico.map((t) => (
                <div
                  key={t}
                  className="pointer-events-none absolute inset-x-0 border-t border-border"
                  style={{ bottom: `${(t / tetoGrafico) * 100}%` }}
                />
              ))}
              <div className="relative flex h-full items-end gap-3 sm:gap-5">
                {stats.seriesMensal.map((s, i) => {
                  const isAtual = i === mesAtualIdx;
                  const pct = s.count === 0 ? 3 : Math.max(6, (s.count / tetoGrafico) * 100);
                  return (
                    <div
                      key={s.label}
                      className="group relative flex h-full flex-1 flex-col items-center justify-end"
                      onMouseEnter={() => setMesHover(i)}
                      onMouseLeave={() => setMesHover((atual) => (atual === i ? null : atual))}
                      onClick={() => setMesHover((atual) => (atual === i ? null : i))}
                    >
                      {isAtual && (
                        <span className="absolute -top-6 right-0 whitespace-nowrap text-xs font-extrabold tabular-nums text-text">
                          {plural(s.count, "participação", "participações")}
                        </span>
                      )}
                      {!isAtual && mesHover === i && (
                        <div
                          className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-text px-2.5 py-1.5 text-xs font-semibold text-bg-card shadow-lg"
                          style={{ bottom: `calc(${pct}% + 10px)` }}
                        >
                          {s.label.toUpperCase()} · {plural(s.count, "participação", "participações")}
                          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-text" />
                        </div>
                      )}
                      <div
                        className="w-full max-w-7 rounded-t-[var(--radius-sm)] transition-[filter] duration-150 group-hover:brightness-110"
                        style={{
                          height: `${pct}%`,
                          backgroundColor:
                            s.count > 0
                              ? "var(--color-primary)"
                              : "color-mix(in srgb, var(--color-primary) 22%, var(--color-bg-card))",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <div className="w-7 shrink-0" />
            <div className="flex flex-1 gap-3 sm:gap-5">
              {stats.seriesMensal.map((s, i) => (
                <span
                  key={s.label}
                  className={cn(
                    "flex-1 text-center text-xs font-semibold uppercase",
                    i === mesAtualIdx ? "text-primary" : "text-text-light",
                  )}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="titulo-proximos" className={painel}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="titulo-proximos" className="flex items-center gap-2 text-base font-bold text-text">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              Próximos eventos
            </h2>
            <Link href="/gestao/eventos" className="text-sm font-bold text-primary hover:underline">
              Agenda
            </Link>
          </div>
          {eventos === null ? (
            <div className="mt-3 h-20 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
          ) : proximosEventos.length === 0 ? (
            <p className="mt-3 text-sm text-text-light">Sem eventos próximos.</p>
          ) : (
            <ul className="mt-2 flex flex-col divide-y divide-border">
              {proximosEventos.map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <span className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tabular-nums text-primary">
                    {formatShortDate(e.data)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-text">{e.titulo}</span>
                  <span className="shrink-0 text-xs text-text-light">
                    {plural(e.inscritos?.length ?? 0, "confirmado")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 3. Corrida × Bike lado a lado, com pódio e inativos de cada uma. */}
      <section aria-labelledby="titulo-modalidades" className={painel}>
        <h2 id="titulo-modalidades" className="text-base font-bold text-text">Modalidades</h2>
        <p className="mt-0.5 text-xs text-text-light">
          Pontos, participações e km desde o início, os mesmos do Ranking geral. Atividade: últimos 30 dias.
        </p>
        <div className="mt-4 grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
          <ColunaModalidade
            modalidade="corrida"
            stats={stats.corrida}
            podio={stats.podioCorrida}
            className="pb-5 md:pb-0 md:pr-6"
          />
          <ColunaModalidade
            modalidade="bicicleta"
            stats={stats.bike}
            podio={stats.podioBike}
            className="pt-5 md:pl-6 md:pt-0"
          />
        </div>
      </section>
    </div>
  );
}

const painel =
  "rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5";

interface Prioridade {
  href: string;
  icon: typeof Clock4;
  texto: string;
  destaque?: boolean;
}

function Numero({
  rotulo,
  valor,
  detalhe,
  barra,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  barra?: number;
}) {
  return (
    <div className="bg-bg-card p-4 sm:p-5">
      <dt className="truncate text-xs font-semibold text-text-light">{rotulo}</dt>
      <dd className="mt-1 text-xl font-extrabold tabular-nums text-text">{valor}</dd>
      {barra !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-inset" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, barra)}%` }} />
        </div>
      ) : null}
      {detalhe ? <dd className="mt-1 text-xs text-text-light">{detalhe}</dd> : null}
    </div>
  );
}

interface ModStats {
  total: number;
  engajamento: number;
  ativos30d: number;
  inativos: number;
  participacoes: number;
  pontos: number;
  media: number;
  km: number;
  top: AtletaDoc | undefined;
  inativosList: AtletaDoc[];
}

const identidadeModalidade = {
  corrida: { icon: Footprints, caixa: "bg-sport-running-subtle text-sport-running" },
  bicicleta: { icon: Bike, caixa: "bg-sport-cycling-subtle text-sport-cycling" },
} as const;

const LIMITE_INATIVOS = 6;

function ColunaModalidade({
  modalidade,
  stats,
  podio,
  className,
}: {
  modalidade: "corrida" | "bicicleta";
  stats: ModStats;
  /** `pontuacaoTotal` já é a pontuação calculada (a do Ranking geral). */
  podio: AtletaDoc[];
  className?: string;
}) {
  const { icon: Icon, caixa } = identidadeModalidade[modalidade];
  const nome = modalidadeLabel[modalidade];
  const posicoes = calcularPosicoesRanking(podio.map((atleta) => atleta.pontuacaoTotal));
  const medalha = [
    "bg-ranking-gold-bg text-ranking-gold-text",
    "bg-ranking-silver-bg text-ranking-silver-text",
    "bg-ranking-bronze-bg text-ranking-bronze-text",
  ];
  const numeros: [string, string][] = [
    ["Participações", String(stats.participacoes)],
    ["Pontos", String(stats.pontos)],
    ["Por atleta", String(stats.media)],
    ...(stats.km > 0 ? ([["Km", formatDecimal(stats.km)]] as [string, string][]) : []),
  ];

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-9 items-center justify-center rounded-[var(--radius)]", caixa)}>
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-bold text-text">{nome}</h3>
            <p className="text-xs text-text-light">{plural(stats.total, "atleta")}</p>
          </div>
        </div>
        <strong className="text-2xl font-extrabold tabular-nums text-text">{stats.engajamento}%</strong>
      </div>

      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-inset" aria-hidden="true">
          <motion.div
            className="h-full origin-left rounded-full bg-primary"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.min(100, stats.engajamento) / 100 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          />
        </div>
        <p className="mt-1.5 text-xs text-text-light">
          {stats.ativos30d} de {stats.total} {stats.total === 1 ? "ativo" : "ativos"} nos últimos 30 dias
        </p>
      </div>

      <dl
        className={cn(
          "grid gap-x-4 gap-y-3",
          numeros.length === 4 ? "grid-cols-2 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4" : "grid-cols-3",
        )}
      >
        {numeros.map(([rotulo, valor]) => (
          <div key={rotulo} className="min-w-0">
            <dt className="truncate text-xs text-text-light">{rotulo}</dt>
            <dd className="text-base font-bold tabular-nums text-text">{valor}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-text-light">Pódio</h4>
        {podio.length === 0 ? (
          <p className="mt-2 text-sm text-text-light">Sem pontuação ainda.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1.5">
            {podio.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2.5 text-sm">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    medalha[Math.min(posicoes[i], 3) - 1],
                  )}
                >
                  {posicoes[i]}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-text">{a.nome}</span>
                <span className="shrink-0 font-semibold tabular-nums text-text-secondary">{a.pontuacaoTotal} pts</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-text-light">
          Sem atividade há mais de 30 dias
        </h4>
        {stats.inativosList.length === 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-text-light">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            Ninguém
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {stats.inativosList.slice(0, LIMITE_INATIVOS).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/gestao/atletas?tab=ver&ficha=${encodeURIComponent(a.id)}`}
                  aria-label={`Abrir ficha de ${a.nome}`}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-accent/30 bg-accent-subtle px-2.5 py-1 text-xs font-medium text-text transition-colors hover:border-accent/60"
                >
                  <AlertTriangle className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
                  {a.nome}
                </Link>
              </li>
            ))}
            {stats.inativosList.length > LIMITE_INATIVOS ? (
              <li>
                <Link
                  href="/gestao/atletas?tab=ver"
                  className="inline-flex min-h-8 items-center px-1.5 text-xs font-semibold text-primary hover:text-primary-hover"
                >
                  e mais {stats.inativosList.length - LIMITE_INATIVOS}
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
