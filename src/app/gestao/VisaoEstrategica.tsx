"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  Award,
  Bike,
  CalendarClock,
  CalendarDays,
  Clock4,
  Crown,
  DollarSign,
  Footprints,
  ListChecks,
  Route,
  Sparkles,
  TicketCheck,
  TrendingUp,
  UserX,
  BarChart2,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { formatBRL, formatShortDate } from "@/lib/format";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { calcularEstatisticasDashboard } from "@/lib/dashboardStats";
import { ExportarRelatorioDropdown } from "./ExportarRelatorioDropdown";
import type {
  AtletaDoc,
  DespesaDoc,
  EventoDoc,
  HistoricoPontoDoc,
  RegraPontuacaoDoc,
  SolicitacaoAcessoDoc,
} from "@/lib/types";

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
  const [despesas, setDespesas] = useState<DespesaDoc[] | null>(null);
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [regras, setRegras] = useState<RegraPontuacaoDoc[] | null>(null);
  const [pendentes, setPendentes] = useState<SolicitacaoAcessoDoc[] | null>(null);
  const [mesHover, setMesHover] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "atletas"),
      (snap) => setAtletas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
      () => setAtletas([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    getDocs(collection(db, "historico_pontos")).then((snap) => {
      setLancamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc));
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
        despesas: despesas ?? [],
        eventos: eventos ?? [],
        regras: regras ?? [],
      }),
    [atletas, lancamentos, despesas, eventos, regras],
  );

  const proximosEventos = useMemo(
    () => (eventos ?? []).filter((e) => e.data >= new Date().toISOString().slice(0, 10)).slice(0, 5),
    [eventos],
  );

  const carregando = atletas === null || lancamentos === null || despesas === null;
  const ringCircumference = 2 * Math.PI * 40;
  const ringOffset = ringCircumference - (stats.engajamento30d / 100) * ringCircumference;
  const ticksGrafico = calcularTicksGrafico(Math.max(...stats.seriesMensal.map((s) => s.count)));
  const tetoGrafico = ticksGrafico[ticksGrafico.length - 1];
  const mesAtualIdx = stats.seriesMensal.length - 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-text">Visão Estratégica</h2>
          <p className="text-sm text-text-light">Acompanhamento do programa.</p>
        </div>
        {isAdmin && !carregando && (
          <ExportarRelatorioDropdown
            stats={stats}
            eventos={eventos ?? []}
            lancamentos={lancamentos ?? []}
            atletas={atletas ?? []}
          />
        )}
      </div>

      <div className="flex items-center gap-2.5 rounded-[var(--radius)] border border-border bg-bg-card px-4 py-2.5 text-sm text-text-light shadow-[var(--shadow-card)]">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{
            backgroundColor: carregando
              ? "var(--color-text-muted)"
              : stats.ativosCount === 0
                ? "var(--color-accent)"
                : "var(--color-secondary)",
            boxShadow: !carregando && stats.ativosCount > 0 ? "var(--ring-primary)" : undefined,
          }}
        />
        <span>
          {carregando
            ? "Carregando programa…"
            : `${stats.ativosCount} atletas ativos`}
        </span>
        <span className="opacity-30">·</span>
        <span>
          {carregando
            ? "Aguardando dados"
            : stats.ativosCount === 0
              ? "Cadastre atletas para começar"
              : `${stats.engajamento30d}% engajados nos últimos 30 dias`}
        </span>
      </div>

      <div className="relative flex flex-wrap items-center gap-7 overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex shrink-0 items-center gap-4.5">
          <div className="relative size-[90px] shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-border)" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-[stroke-dashoffset] duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <strong className="text-[1.05rem] font-extrabold text-text">{stats.engajamento30d}%</strong>
              <span className="text-[.6rem] font-semibold uppercase tracking-wide text-text-light">engajados</span>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[.68rem] font-bold uppercase tracking-wide text-text-light">
              Engajamento 30 dias
            </p>
            <p className="mb-1 text-sm text-text">
              <b className="font-bold">{stats.ativosRecentesCount}</b> de{" "}
              <b className="font-bold">{stats.ativosCount}</b> atletas ativos recentemente
            </p>
          </div>
        </div>

        <div className="hidden self-stretch border-l border-border sm:block" />

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2.5 2xl:grid-cols-4">
          <HeroKpi icon={TicketCheck} color="var(--color-primary)" value={String(stats.participacoesTotal)} label="Participações" />
          <HeroKpi icon={Route} color="var(--color-accent)" value={`${stats.kmTotal.toFixed(1)} km`} label="KM acumulado" />
          <HeroKpi icon={DollarSign} color="var(--color-secondary)" value={formatBRL(stats.investimentoTotal)} label="Custo realizado" />
          <HeroKpi icon={TrendingUp} color="var(--color-info)" value={formatBRL(stats.custoPorAtleta)} label="Custo / atleta" />
        </div>
      </div>

      {!carregando && stats.analisesExecutivas.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-primary/20 bg-primary/[0.04] p-5 shadow-[var(--shadow-card)]">
          <h3 className="mb-3 flex items-center gap-1.5 text-[.95rem] font-bold text-text">
            <Sparkles className="size-[15px] text-primary" />
            Leitura do mês
          </h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 lg:grid-cols-2">
            {stats.analisesExecutivas.map((texto, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
                <p className="text-sm leading-snug text-text">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="mb-1 flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-1.5 text-[.95rem] font-bold text-text">
                  <Activity className="size-[15px] text-primary" />
                  Evolução mensal
                </h3>
                <p className="mt-0.5 text-[.8rem] text-text-light">
                  Participações registradas por mês · passe o mouse numa barra
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <div className="relative h-[176px] w-6 shrink-0">
                {ticksGrafico.map((t) => (
                  <span
                    key={t}
                    className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-text-muted"
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
                      >
                        {isAtual && (
                          <span className="absolute -top-5 whitespace-nowrap text-xs font-extrabold tabular-nums text-text">
                            {s.count} {s.count === 1 ? "participação" : "participações"}
                          </span>
                        )}
                        {!isAtual && mesHover === i && (
                          <div
                            className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-text px-2.5 py-1.5 text-[11.5px] font-semibold text-bg-card shadow-lg"
                            style={{ bottom: `calc(${pct}% + 10px)` }}
                          >
                            {s.label.toUpperCase()} · <span className="tabular-nums">{s.count}</span>{" "}
                            {s.count === 1 ? "participação" : "participações"}
                            <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-text" />
                          </div>
                        )}
                        <div
                          className="w-full max-w-6 rounded-t-[var(--radius-sm)] transition-[filter] duration-150 group-hover:brightness-110"
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
              <div className="w-6 shrink-0" />
              <div className="flex flex-1 gap-3 sm:gap-5">
                {stats.seriesMensal.map((s, i) => (
                  <span
                    key={s.label}
                    className={`flex-1 text-center text-[.7rem] font-semibold uppercase ${
                      i === mesAtualIdx ? "text-primary" : "text-text-light"
                    }`}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <ModalidadeCard
              icon={Bike}
              nome="Bicicleta"
              corVar="var(--color-primary)"
              stats={stats.bike}
            />
            <ModalidadeCard
              icon={Footprints}
              nome="Corrida"
              corVar="var(--color-secondary)"
              stats={stats.corrida}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-5 shadow-[var(--shadow-card)]">
              <h3 className="flex items-center gap-1.5 text-[.95rem] font-bold text-text">
                <Award className="size-[15px] text-primary" />
                Pódio Top 3
              </h3>
              <p className="mt-0.5 text-[.8rem] text-text-light">Por pontuação acumulada</p>
              <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PodiumColumn icon={Bike} label="Bike" atletas={stats.podioBike} />
                <PodiumColumn icon={Footprints} label="Corrida" atletas={stats.podioCorrida} />
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-5 shadow-[var(--shadow-card)]">
              <h3 className="flex items-center gap-1.5 text-[.95rem] font-bold text-text">
                <AlertTriangle className="size-[15px] text-primary" />
                Radar de Inatividade
              </h3>
              <p className="mt-0.5 text-[.8rem] text-text-light">Ausentes há mais de 30 dias</p>
              <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InactivityColumn icon={Bike} label="Bike" atletas={stats.bike.inativosList} />
                <InactivityColumn icon={Footprints} label="Corrida" atletas={stats.corrida.inativosList} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h3 className="flex items-center gap-1.5 text-[.95rem] font-bold text-text">
                <Sparkles className="size-[15px] text-primary" />
                Prioridades
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[.72rem] font-bold text-accent">
                    <b>{pendentes?.length ?? 0}</b> solicitações
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[.72rem] font-bold text-primary">
                  <b>{stats.filaAguardando}</b> fila
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {isAdmin && (pendentes?.length ?? 0) > 0 && (
                <Link
                  href="/gestao/atletas?tab=pendentes"
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-accent/25 bg-accent/5 px-3 py-2.5 text-sm hover:bg-accent/10"
                >
                  <span className="flex items-center gap-2 text-text">
                    <Clock4 className="size-3.5 text-accent" />
                    {pendentes!.length}{" "}
                    {pendentes!.length > 1 ? "solicitações de acesso" : "solicitação de acesso"}
                  </span>
                  <span className="font-semibold text-accent">Ver</span>
                </Link>
              )}
              {stats.filaAguardando > 0 && (
                <Link
                  href="/gestao/atletas?tab=equipes"
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2.5 text-sm hover:bg-primary/[0.04]"
                >
                  <span className="text-text">{stats.filaAguardando} na fila de espera</span>
                  <span className="font-semibold text-primary">Ver</span>
                </Link>
              )}
              {stats.eventosPendentesLancamento > 0 && (
                <Link
                  href="/gestao/pontuacao"
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2.5 text-sm hover:bg-primary/[0.04]"
                >
                  <span className="flex items-center gap-2 text-text">
                    <CalendarClock className="size-3.5 text-text-light" />
                    {stats.eventosPendentesLancamento}{" "}
                    {stats.eventosPendentesLancamento > 1 ? "eventos sem pontos lançados" : "evento sem pontos lançados"}
                  </span>
                  <span className="font-semibold text-primary">Ver</span>
                </Link>
              )}
              {stats.atletasSemAtividade > 0 && (
                <Link
                  href="/gestao/atletas?tab=ver"
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2.5 text-sm hover:bg-primary/[0.04]"
                >
                  <span className="flex items-center gap-2 text-text">
                    <UserX className="size-3.5 text-text-light" />
                    {stats.atletasSemAtividade}{" "}
                    {stats.atletasSemAtividade > 1 ? "atletas sem nenhuma participação" : "atleta sem nenhuma participação"}
                  </span>
                  <span className="font-semibold text-primary">Ver</span>
                </Link>
              )}
              {isAdmin && stats.regrasSemUso > 0 && (
                <Link
                  href="/gestao/criterios"
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2.5 text-sm hover:bg-primary/[0.04]"
                >
                  <span className="flex items-center gap-2 text-text">
                    <ListChecks className="size-3.5 text-text-light" />
                    {stats.regrasSemUso}{" "}
                    {stats.regrasSemUso > 1 ? "critérios nunca usados" : "critério nunca usado"}
                  </span>
                  <span className="font-semibold text-primary">Ver</span>
                </Link>
              )}
              {!carregando &&
                (pendentes?.length ?? 0) === 0 &&
                stats.filaAguardando === 0 &&
                stats.eventosPendentesLancamento === 0 &&
                stats.atletasSemAtividade === 0 &&
                (!isAdmin || stats.regrasSemUso === 0) && (
                  <p className="py-3 text-center text-sm text-text-muted">Tudo em ordem — nenhuma ação prioritária.</p>
                )}
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-5 shadow-[var(--shadow-card)]">
            <h3 className="flex items-center gap-1.5 text-[.95rem] font-bold text-text">
              <CalendarDays className="size-[15px] text-primary" />
              Próximos eventos
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              {eventos === null ? (
                <p className="py-3 text-center text-sm text-text-muted">Carregando…</p>
              ) : proximosEventos.length === 0 ? (
                <p className="py-3 text-center text-sm text-text-muted">Sem eventos próximos.</p>
              ) : (
                proximosEventos.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-sm">
                    <span className="truncate text-text">{e.titulo}</span>
                    <span className="shrink-0 text-xs font-semibold text-text-light">{formatShortDate(e.data)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-5 shadow-[var(--shadow-card)]">
            <h3 className="mb-3.5 flex items-center gap-1.5 text-[.95rem] font-bold text-text">
              <BarChart2 className="size-[15px] text-primary" />
              Eficiência financeira
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[var(--radius)] border border-border bg-bg p-3">
                <span className="mb-1 block text-[.7rem] font-semibold uppercase tracking-wide text-text-light">
                  Custo / participação
                </span>
                <strong className="whitespace-nowrap text-base font-extrabold text-text">
                  {formatBRL(stats.custoParticipacao)}
                </strong>
              </div>
              <div className="rounded-[var(--radius)] border border-border bg-bg p-3">
                <span className="mb-1 block text-[.7rem] font-semibold uppercase tracking-wide text-text-light">
                  Custo / km
                </span>
                <strong className="whitespace-nowrap text-base font-extrabold text-text">
                  {formatBRL(stats.custoKm)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroKpi({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: typeof Route;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-[var(--radius)] border border-border bg-bg-card p-3 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
      >
        <Icon className="size-[15px]" />
      </span>
      <div className="min-w-0">
        <strong className="block truncate text-[.95rem] leading-tight font-extrabold text-text sm:text-base">
          {value}
        </strong>
        <span className="block truncate text-[.65rem] font-bold uppercase tracking-wide text-text-light">
          {label}
        </span>
      </div>
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
}

function ModalidadeCard({
  icon: Icon,
  nome,
  corVar,
  stats,
}: {
  icon: typeof Bike;
  nome: string;
  corVar: string;
  stats: ModStats;
}) {
  return (
    <div
      className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-5 shadow-[var(--shadow-card)]"
      style={{ borderTop: `3px solid ${corVar}` }}
    >
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-[var(--radius-sm)]"
            style={{ backgroundColor: `color-mix(in srgb, ${corVar} 10%, transparent)`, color: corVar }}
          >
            <Icon className="size-[18px]" />
          </span>
          <div>
            <p className="text-sm font-bold text-text">{nome}</p>
            <p className="text-xs text-text-light">
              <strong className="text-text">{stats.total}</strong> atletas
            </p>
          </div>
        </div>
        <div className="text-right">
          <strong className="block text-xl font-extrabold text-text">{stats.engajamento}%</strong>
          <span className="text-[.68rem] font-semibold uppercase text-text-light">engajados</span>
        </div>
      </div>
      <div className="mb-1.5 h-[5px] overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${stats.engajamento}%`, backgroundColor: corVar }}
        />
      </div>
      <p className="mb-3.5 text-xs text-text-light">
        {stats.ativos30d} de {stats.total} ativos nos últimos 30 dias · {stats.inativos} inativos
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ModStat label="Participações" value={stats.participacoes} />
        <ModStat label="Pontos" value={stats.pontos} />
        <ModStat label="Média pts" value={stats.media} />
        <ModStat label="KM total" value={`${stats.km.toFixed(1)} km`} />
      </div>
      <div
        className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm"
        style={{
          backgroundColor: `color-mix(in srgb, ${corVar} 5%, transparent)`,
          borderLeft: `3px solid ${corVar}`,
        }}
      >
        <Crown className="size-3.5 text-warning" />
        <span className="text-text-light">Top atleta</span>
        <strong className="truncate font-bold text-text">{stats.top?.nome ?? "—"}</strong>
      </div>
    </div>
  );
}

function ModStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-border bg-bg p-2 text-center">
      <span className="mb-0.5 block text-[.65rem] font-semibold uppercase tracking-wide text-text-light">
        {label}
      </span>
      <strong className="text-sm font-extrabold text-text">{value}</strong>
    </div>
  );
}

function PodiumColumn({
  icon: Icon,
  label,
  atletas,
}: {
  icon: typeof Bike;
  label: string;
  atletas: AtletaDoc[];
}) {
  const medalStyles = [
    { bg: "var(--color-ranking-gold-bg)", border: "var(--color-ranking-gold)", color: "var(--color-ranking-gold-text)" },
    { bg: "var(--color-ranking-silver-bg)", border: "var(--color-ranking-silver)", color: "var(--color-ranking-silver-text)" },
    { bg: "var(--color-ranking-bronze-bg)", border: "var(--color-ranking-bronze)", color: "var(--color-ranking-bronze-text)" },
  ];
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-light">
        <Icon className="size-3" />
        {label}
      </p>
      {atletas.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-border bg-bg p-2.5 text-center text-xs text-text-muted">
          Sem dados ainda
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {atletas.map((a, i) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 py-1.5"
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-[.7rem] font-bold"
                style={{
                  backgroundColor: medalStyles[i].bg,
                  borderColor: medalStyles[i].border,
                  color: medalStyles[i].color,
                  borderWidth: 1,
                  borderStyle: "solid",
                }}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[.83rem] font-semibold text-text">{a.nome}</span>
              <span className="shrink-0 text-[.83rem] font-bold text-primary">{a.pontuacaoTotal}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InactivityColumn({
  icon: Icon,
  label,
  atletas,
}: {
  icon: typeof Bike;
  label: string;
  atletas: AtletaDoc[];
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-light">
        <Icon className="size-3" />
        {label}
      </p>
      {atletas.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-border bg-bg p-2.5 text-center text-xs text-text-muted">
          Nenhum atleta inativo
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {atletas.slice(0, 4).map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-bg px-2.5 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0 text-accent" />
                <span className="truncate text-[.83rem] font-medium text-text">{a.nome}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
