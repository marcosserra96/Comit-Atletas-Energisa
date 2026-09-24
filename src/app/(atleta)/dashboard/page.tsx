"use client";

import { useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Trophy,
  Bike,
  ChevronRight,
  Footprints,
  History,
  CalendarCheck,
  Newspaper,
  MapPin,
  Check,
  TrendingUp,
  Award,
  AlertCircle,
  Navigation,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { consolidarAtividades } from "@/lib/activityConsolidation";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useAthleteDirectoryCollection } from "@/lib/session/useAthleteDirectory";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { SportBadge } from "@/components/ui/SportBadge";
import { SkeletonCard, SkeletonMetric } from "@/components/ui/Skeleton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/cn";
import { isWaitlisted, modalidadeFromEquipe } from "@/lib/labels";
import { formatDataTreino, formatLongDate, formatShortDate } from "@/lib/format";
import { calcularInsightsAtleta } from "@/lib/athleteStats";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import {
  normalizarRankingVisibility,
  rankingOcultoAgora,
} from "@/lib/rankingVisibility";
import type {
  AtletaPublicoDoc,
  EventoDoc,
  HistoricoPontoDoc,
  NoticiaDoc,
  RankingVisibilityConfigDoc,
} from "@/lib/types";

function hojeIsoLocal() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return ano + "-" + mes + "-" + dia;
}

function partesDataEvento(valor: string) {
  const data = new Date(valor + "T00:00:00");
  if (Number.isNaN(data.getTime())) return { mes: "—", dia: "—" };
  return {
    mes: data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    dia: data.getDate(),
  };
}

export default function DashboardPage() {
  const { atleta, isPreview, withPreview } = useAthleteView();
  const { usuario } = useActiveSession();
  const { show } = useToast();
  const athleteDirectory = useAthleteDirectoryCollection();
  const isStaff = usuario.role === "administrador" || usuario.role === "comite";
  const modalidade = modalidadeFromEquipe(atleta.equipe);
  const waitlisted = isWaitlisted(atleta.equipe);
  const ModalidadeIcon = modalidade === "bicicleta" ? Bike : Footprints;

  const [companheiros, setCompanheiros] = useState<AtletaPublicoDoc[] | null>(() => (modalidade ? null : []));
  const [meusLancamentos, setMeusLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [proximoEvento, setProximoEvento] = useState<EventoDoc[] | null>(null);
  const [noticias, setNoticias] = useState<NoticiaDoc[] | null>(null);
  const [inscrevendo, setInscrevendo] = useState(false);
  const [eventoAbertoId, setEventoAbertoId] = useState<string | null>(null);
  const [rankingVisibility, setRankingVisibility] = useState<
    RankingVisibilityConfigDoc | null | undefined
  >(undefined);
  const [erroRanking, setErroRanking] = useState(false);
  const [erroHistorico, setErroHistorico] = useState(false);
  const [erroEventos, setErroEventos] = useState(false);
  const [erroNoticias, setErroNoticias] = useState(false);

  const rankingOcultoAtual = Boolean(
    !isStaff &&
      modalidade &&
      rankingVisibility &&
      rankingOcultoAgora(rankingVisibility, modalidade),
  );
  const rankingDesativado = Boolean(
    !isStaff && rankingVisibility?.exibirParaAtletas === false,
  );
  const rankingIndisponivel = rankingDesativado || rankingOcultoAtual || waitlisted;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "configuracoes", "ranking_visibilidade"),
      (snapshot) => {
        setRankingVisibility(
          snapshot.exists()
            ? normalizarRankingVisibility(
                snapshot.data() as Partial<RankingVisibilityConfigDoc>,
              )
            : null,
        );
      },
      () => setRankingVisibility(null),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!modalidade || !athleteDirectory) return;
    if (!isStaff && rankingVisibility === undefined) return;
    if (rankingIndisponivel) return;

    const unsubscribe = onSnapshot(
      query(collection(db, athleteDirectory), where("equipe", "==", modalidade)),
      (snap) => {
        const lista = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AtletaPublicoDoc)
          .filter(perfilAtletaVisivel)
          .sort(
            (a, b) =>
              b.pontuacaoTotal - a.pontuacaoTotal ||
              a.nome.localeCompare(b.nome, "pt-BR"),
          );
        setCompanheiros(lista);
        setErroRanking(false);
      },
      () => {
        setCompanheiros([]);
        setErroRanking(true);
      },
    );
    return unsubscribe;
  }, [athleteDirectory, isStaff, modalidade, rankingIndisponivel, rankingVisibility]);

  useEffect(() => {
    let active = true;

    getDocs(query(collection(db, "historico_pontos"), where("atletaId", "==", atleta.id)))
      .then((snap) => {
        if (active) {
          setMeusLancamentos(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc),
          );
          setErroHistorico(false);
        }
      })
      .catch(() => {
        if (active) {
          setMeusLancamentos([]);
          setErroHistorico(true);
        }
      });

    getDocs(query(collection(db, "noticias"), orderBy("criadoEm", "desc"), limit(3)))
      .then((snap) => {
        if (active) {
          setNoticias(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoticiaDoc));
          setErroNoticias(false);
        }
      })
      .catch(() => {
        if (active) {
          setNoticias([]);
          setErroNoticias(true);
        }
      });

    return () => {
      active = false;
    };
  }, [atleta.id]);

  useEffect(() => {
    const isoHoje = hojeIsoLocal();
    const unsubscribe = onSnapshot(
      query(collection(db, "agenda_eventos"), where("data", ">=", isoHoje), orderBy("data", "asc"), limit(12)),
      (snap) => {
        setProximoEvento(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc));
        setErroEventos(false);
      },
      () => {
        setProximoEvento([]);
        setErroEventos(true);
      },
    );
    return unsubscribe;
  }, []);

  const insights = useMemo(() => {
    const companheirosParaInsights = rankingIndisponivel ? [] : companheiros;
    if (companheirosParaInsights === null || meusLancamentos === null) return null;
    return calcularInsightsAtleta({
      atleta,
      companheiros: companheirosParaInsights,
      meusLancamentos,
    });
  }, [atleta, companheiros, meusLancamentos, rankingIndisponivel]);

  const ultimosLancamentos = useMemo(
    () => [...(meusLancamentos ?? [])].sort((a, b) => b.dataTreino.localeCompare(a.dataTreino)).slice(0, 5),
    [meusLancamentos],
  );

  const atividadesConsolidadas = useMemo(
    () => consolidarAtividades(meusLancamentos ?? []),
    [meusLancamentos],
  );
  const participacoesTotais = atividadesConsolidadas.length;
  const kmAcumulado = atividadesConsolidadas.reduce(
    (soma, atividade) => soma + atividade.km,
    0,
  );

  const eventosDoAtleta = useMemo(() => {
    const todos = proximoEvento ?? [];
    if (!modalidade) return todos;
    const relevantes = todos.filter(
      (item) => item.modalidade === "ambas" || item.modalidade === modalidade,
    );
    return relevantes.length > 0 ? relevantes : todos;
  }, [modalidade, proximoEvento]);

  const evento = eventosDoAtleta[0];
  const eventosPosteriores = eventosDoAtleta.slice(1, 4);
  const dataEvento = evento ? partesDataEvento(evento.data) : null;
  const jaConfirmado = !!evento?.inscritos?.includes(atleta.id);
  const eventoAberto = eventosDoAtleta.find((item) => item.id === eventoAbertoId);
  const eventoAbertoConfirmado = !!eventoAberto?.inscritos?.includes(atleta.id);

  async function handleRsvp(eventoAlvo = evento) {
    if (!eventoAlvo || isPreview) return;
    const confirmado = !!eventoAlvo.inscritos?.includes(atleta.id);
    setInscrevendo(true);
    try {
      await updateDoc(doc(db, "agenda_eventos", eventoAlvo.id), {
        inscritos: confirmado ? arrayRemove(atleta.id) : arrayUnion(atleta.id),
      });
      show("success", confirmado ? "Presença cancelada." : "Presença confirmada!");
    } catch {
      show("error", "Não foi possível atualizar agora. Tente novamente.");
    } finally {
      setInscrevendo(false);
    }
  }

  const fontesComErro = [
    erroHistorico ? "histórico" : null,
    erroEventos ? "eventos" : null,
    erroNoticias ? "notícias" : null,
    erroRanking && !rankingIndisponivel ? "ranking" : null,
  ].filter((fonte): fonte is string => fonte !== null);
  const erroDados = fontesComErro.length > 0;

  const maxSerie = Math.max(1, ...(insights?.seriesMensal.map((s) => s.pontos) ?? [1]));
  const isTop3 = insights?.posicao && insights.posicao <= 3;
  const medalColor = insights?.posicao === 1 ? "var(--color-ranking-gold)" 
                   : insights?.posicao === 2 ? "var(--color-ranking-silver)" 
                   : insights?.posicao === 3 ? "var(--color-ranking-bronze)" 
                   : "var(--color-text-muted)";

  return (
    <>
      <div className="-mx-4 -mt-4 sm:hidden">
        <section className="relative isolate overflow-hidden bg-navy px-4 pb-7 pt-4 text-white">
          <div className="absolute inset-0 -z-20 bg-gradient-to-br from-navy via-navy-light to-navy" />
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-24 -z-10 size-64 rounded-full border-[32px] border-primary/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-28 -left-20 -z-10 size-56 rounded-full border-[28px] border-secondary/10"
          />
          <ModalidadeIcon
            aria-hidden="true"
            className="absolute -bottom-5 -right-8 -z-10 size-44 text-white/[0.05]"
            strokeWidth={1}
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent"
          />

          <div className="flex items-start justify-between gap-4">
            <Image
              src="/logos/logo-comite-branca-trim.png"
              alt="Atletas Energisa"
              width={156}
              height={48}
              priority
              className="h-9 w-auto"
            />
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold backdrop-blur-sm">
              {waitlisted ? "Fila de espera" : atleta.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>

          <div className="mt-8">
            <p className="text-sm font-medium text-white/75">Olá,</p>
            <h1 className="mt-0.5 text-3xl font-black tracking-tight">
              {atleta.nome.split(" ")[0]}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-white/80">
              <ModalidadeIcon className="size-4 text-secondary" />
              <span>
                {modalidade === "bicicleta"
                  ? "Ciclismo"
                  : modalidade === "corrida"
                    ? "Corrida"
                    : "Modalidade não definida"}
              </span>
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Movimento que conecta
            </p>
          </div>
        </section>

        <div className="-mt-4 rounded-t-[28px] bg-bg px-4 pb-4 pt-6">
          {erroDados ? (
            <div className="mb-4 flex items-start gap-3 rounded-[var(--radius)] border border-danger/20 bg-danger/5 p-3 text-sm text-text-light">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" />
              <p>Não foi possível carregar: {fontesComErro.join(", ")}.</p>
            </div>
          ) : null}

          <section className="mt-5 rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                  Seu mês
                </p>
                <h2 className="mt-0.5 text-lg font-extrabold text-text">Resumo de desempenho</h2>
              </div>
              <Link
                href={withPreview("/desempenho")}
                className="flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-bold text-primary"
              >
                Ver análise
                <ChevronRight className="size-4" />
              </Link>
            </div>

            {insights ? (
              <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-[var(--radius)] bg-bg-inset py-3 text-center">
                <div className="px-2">
                  <strong className="block text-xl font-black tabular-nums text-text">
                    {insights.treinosMes}
                  </strong>
                  <span className="text-[11px] text-text-muted">treinos</span>
                </div>
                <div className="px-2">
                  <strong className="block text-xl font-black tabular-nums text-text">
                    {insights.kmMes.toFixed(1)}
                  </strong>
                  <span className="text-[11px] text-text-muted">km</span>
                </div>
                <div className="px-2">
                  <strong className="block text-xl font-black tabular-nums text-text">
                    {insights.pontosMes}
                  </strong>
                  <span className="text-[11px] text-text-muted">pontos</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 h-20 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
            )}
          </section>

          <section className="mt-5 rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                  Próximo evento
                </p>
                <h2 className="mt-0.5 text-lg font-extrabold text-text">Na sua agenda</h2>
              </div>
              <Link
                href={withPreview("/eventos")}
                className="flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-bold text-primary"
              >
                Ver todos
                <ChevronRight className="size-4" />
              </Link>
            </div>

            {proximoEvento === null ? (
              <div className="mt-3 h-24 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
            ) : evento ? (
              <div className="mt-3">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setEventoAbertoId(evento.id)}
                  className="flex min-h-20 w-full items-center gap-3 rounded-[var(--radius)] bg-bg-inset p-3 text-left transition-colors active:bg-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-[var(--radius)] bg-bg-card shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-primary">
                      {dataEvento?.mes}
                    </span>
                    <span className="text-xl font-black leading-none text-text">
                      {dataEvento?.dia}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-text">{evento.titulo}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{evento.local}</span>
                    </p>
                  </div>
                  {jaConfirmado ? (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success">
                      <Check className="size-4" />
                    </span>
                  ) : (
                    <ChevronRight className="size-5 shrink-0 text-text-muted" aria-hidden="true" />
                  )}
                </button>
                <Button
                  variant={jaConfirmado ? "secondary" : "primary"}
                  className="mt-3 min-h-11 w-full justify-center"
                  onClick={() => handleRsvp()}
                  loading={inscrevendo}
                  disabled={isPreview}
                >
                  {isPreview
                    ? "Somente visualização"
                    : jaConfirmado
                      ? "Cancelar presença"
                      : "Confirmar presença"}
                </Button>
              </div>
            ) : (
              <p className="mt-3 rounded-[var(--radius)] bg-bg-inset p-4 text-center text-sm text-text-muted">
                Nenhum evento agendado no momento.
              </p>
            )}
          </section>

          <section className="mt-5 rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                  Novidades
                </p>
                <h2 className="mt-0.5 text-lg font-extrabold text-text">Últimas notícias</h2>
              </div>
              <Link
                href={withPreview("/noticias")}
                className="flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-bold text-primary"
              >
                Ver todas
                <ChevronRight className="size-4" />
              </Link>
            </div>

            {noticias === null ? (
              <div className="mt-3 h-20 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
            ) : noticias.length === 0 ? (
              <p className="mt-3 rounded-[var(--radius)] bg-bg-inset p-4 text-center text-sm text-text-muted">
                Nenhuma notícia publicada no momento.
              </p>
            ) : (
              <div className="mt-3 flex flex-col divide-y divide-border">
                {noticias.slice(0, 2).map((noticia) => (
                  <Link
                    key={noticia.id}
                    href={withPreview(`/noticias/${noticia.id}`)}
                    className="group flex min-h-16 items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                      <Newspaper className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-text group-active:text-primary">
                        {noticia.titulo}
                      </strong>
                      <span className="mt-0.5 block truncate text-xs text-text-muted">
                        {noticia.resumo}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-text-muted" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="hidden flex-col sm:flex">
      <PageHeader
        title={`Olá, ${atleta.nome.split(" ")[0]} 👋`}
        subtitle={insights?.leitura || formatLongDate(new Date())}
        badge={<SportBadge modalidade={modalidade} size="sm" />}
        actions={
          <Badge tone={waitlisted ? "warning" : atleta.ativo ? "success" : "neutral"}>
            {waitlisted ? "Na fila de espera" : atleta.ativo ? "Ativo no programa" : "Inativo"}
          </Badge>
        }
        className="mb-6"
      />

      {erroDados && (
        <div className="mb-6 flex items-start gap-3 rounded-[var(--radius)] border border-danger/20 bg-danger/5 p-4 text-sm text-text-light">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" />
          <p>
            Não foi possível carregar: {fontesComErro.join(", ")}. Atualize a página; se o
            problema continuar, fale com o comitê.
          </p>
        </div>
      )}

      {/* METRIC CARDS ROW */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {!insights ? (
          <>
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </>
        ) : (
          <>
            <MetricCard
              label="Pontuação total"
              value={atleta.pontuacaoTotal}
              icon={Trophy}
              iconColor="var(--color-primary)"
              trend={insights?.vsMediaEquipePct !== null && insights?.vsMediaEquipePct !== undefined ? { value: insights.vsMediaEquipePct, label: "vs equipe" } : undefined}
            />
            <MetricCard
              label="Posição no ranking"
              value={
                rankingDesativado
                  ? "Indisponível"
                  : rankingOcultoAtual
                  ? "Oculto"
                  : !modalidade || waitlisted
                    ? "—"
                    : insights?.posicao
                      ? `${insights.posicao}º`
                      : "…"
              }
              icon={Award}
              iconColor={!rankingIndisponivel && isTop3 ? medalColor : undefined}
              subtitle={
                rankingDesativado
                  ? "Desativado pelo administrador"
                  : rankingOcultoAtual
                  ? "Fechamento em andamento"
                  : modalidade && insights?.totalNoRanking
                    ? `de ${insights.totalNoRanking} atletas`
                    : undefined
              }
            />
            <MetricCard
              label="KM Acumulado"
              value={kmAcumulado > 0 ? kmAcumulado.toFixed(1) : (insights.kmMes > 0 ? insights.kmMes.toFixed(1) : "0")}
              icon={ModalidadeIcon}
              iconColor="var(--color-secondary)"
              subtitle="Total registrado"
            />
            <MetricCard
              label="Participações"
              value={participacoesTotais}
              icon={History}
              iconColor="var(--color-accent)"
              subtitle="Atividades validadas"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MAIN COLUMN (2 cols lg) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* EVOLUTION CHART */}
          <Card className="flex flex-col">
            <SectionHeader title="Sua evolução" icon={TrendingUp} />
            <div className="mt-2 text-sm text-[var(--color-text-secondary)] mb-6">
              Pontos acumulados por mês (últimos 6 meses)
            </div>
            {!insights ? (
              <SkeletonCard className="h-[200px]" />
            ) : (
              <div className="flex h-[200px] items-end gap-2 relative mt-2">
                <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-[10px] text-[var(--color-text-muted)] border-r border-[var(--color-border-subtle)] pr-1 text-right">
                  <span>{maxSerie}</span>
                  <span>{Math.round(maxSerie / 2)}</span>
                  <span>0</span>
                </div>
                
                <div className="flex flex-1 items-end gap-2 ml-10 h-full pb-6">
                  {(insights.seriesMensal).map((s) => {
                    const heightPct = Math.max(0, (s.pontos / maxSerie) * 100);
                    const isActive = s.pontos > 0;
                    return (
                      <div key={s.label} className="flex flex-1 flex-col items-center gap-2 h-full group relative">
                        {isActive && (
                          <div className="absolute -top-8 bg-[var(--color-bg-inverse)] text-[var(--color-text-inverse)] text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 font-medium">
                            {s.pontos} pts
                          </div>
                        )}
                        <div className="flex h-full w-full items-end justify-center">
                          <div
                            className={cn(
                              "w-full max-w-[40px] rounded-t-[var(--radius-sm)] transition-all",
                              isActive 
                                ? "bg-[var(--color-primary)] opacity-80 group-hover:opacity-100 group-hover:bg-[var(--color-primary-hover)] cursor-pointer" 
                                : "bg-[var(--color-bg-inset)] h-[4px]"
                            )}
                            style={isActive ? { height: `${heightPct}%` } : undefined}
                          />
                        </div>
                        <span className="absolute bottom-0 text-[10px] font-medium uppercase text-[var(--color-text-secondary)]">
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* RECENT ACTIVITY */}
          <Card className="flex flex-col">
            <SectionHeader title="Atividade recente" icon={History} />
            {meusLancamentos === null ? (
              <div className="flex flex-col gap-4 mt-4">
                <SkeletonCard className="h-16" />
                <SkeletonCard className="h-16" />
                <SkeletonCard className="h-16" />
              </div>
            ) : ultimosLancamentos.length === 0 ? (
              <EmptyState
                icon={History}
                title="Nenhum lançamento ainda"
                description="Assim que o comitê lançar pontos, seu histórico aparece aqui."
              />
            ) : (
              <div className="mt-2 flex flex-col">
                {ultimosLancamentos.map((item, i) => (
                  <div key={item.id} className={cn("flex items-start gap-4 py-4", i !== ultimosLancamentos.length - 1 && "border-b border-[var(--color-border-subtle)]")}>
                    <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", item.estornado ? "bg-[var(--color-bg-inset)] text-[var(--color-text-muted)]" : "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]")}>
                      {item.tipoLancamento === 'treino' ? <ModalidadeIcon className="size-5" /> : <Award className="size-5" />}
                    </div>
                    <div className="flex flex-1 flex-col min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className={cn("text-sm font-semibold truncate", item.estornado && "line-through text-[var(--color-text-muted)]")}>{item.regraDesc}</p>
                        <span className={cn("text-sm font-bold whitespace-nowrap", item.estornado ? "text-[var(--color-text-muted)]" : "text-[var(--color-success)]")}>
                          {item.estornado ? "" : "+"}{item.pontos} pts
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{formatDataTreino(item.dataTreino, item.dataAproximada)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* SIDE COLUMN (1 col lg) */}
        <div className="flex flex-col gap-6">
          {/* NEXT EVENT */}
          <Card className="flex flex-col">
            <SectionHeader
              title="Próximo evento"
              icon={CalendarCheck}
              action={
                <Link href={withPreview("/eventos")} className="text-xs font-semibold text-primary hover:underline">
                  Agenda completa
                </Link>
              }
            />
            {proximoEvento === null ? (
              <div className="mt-4 flex flex-col gap-4">
                <SkeletonCard className="h-40" />
                <SkeletonCard className="h-16" />
                <SkeletonCard className="h-16" />
              </div>
            ) : !evento ? (
              <EmptyState
                icon={CalendarCheck}
                title="Nenhum evento agendado"
                description="Quando o comitê publicar um evento, ele aparecerá aqui."
              />
            ) : (
              <div className="mt-4 flex flex-col">
                <div className="rounded-[var(--radius-lg)] border border-primary/15 bg-gradient-to-br from-primary/10 via-bg-card to-secondary/10 p-4">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => setEventoAbertoId(evento.id)}
                    className="w-full rounded-[var(--radius)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="flex items-start gap-4">
                    <div className="flex size-18 shrink-0 flex-col items-center justify-center rounded-[var(--radius)] bg-bg-card shadow-sm">
                      <span className="text-xs font-bold uppercase tracking-wide text-primary">
                        {dataEvento?.mes}
                      </span>
                      <span className="text-3xl font-black leading-none text-text">
                        {dataEvento?.dia}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-lg font-bold leading-tight text-text">
                        {evento.titulo}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-text-light">
                        <MapPin className="size-4 shrink-0" />
                        <span className="truncate">{evento.local}</span>
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {evento.modalidade === "ambas" ? (
                          <Badge tone="neutral">Todas as modalidades</Badge>
                        ) : (
                          <SportBadge modalidade={evento.modalidade} size="sm" />
                        )}
                        {jaConfirmado && (
                          <Badge tone="success">
                            <Check className="mr-1 size-3" />
                            Confirmado
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                    <span className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-primary">
                      Ver detalhes
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </span>
                  </button>
                  <Button
                    variant={jaConfirmado ? "secondary" : "primary"}
                    className="mt-4 w-full justify-center"
                    onClick={() => handleRsvp()}
                    loading={inscrevendo}
                    disabled={isPreview}
                  >
                    {isPreview
                      ? "Somente visualização"
                      : jaConfirmado
                        ? "Cancelar presença"
                        : "Confirmar presença"}
                  </Button>
                </div>

                {eventosPosteriores.length > 0 && (
                  <div className="mt-5 border-t border-border-subtle pt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">
                      Depois
                    </p>
                    <div className="flex flex-col gap-2">
                      {eventosPosteriores.map((item) => (
                        <Link
                          key={item.id}
                          href={withPreview("/eventos")}
                          className="group flex items-center gap-3 rounded-[var(--radius)] border border-transparent p-2.5 transition-colors hover:border-border hover:bg-bg-inset"
                        >
                          <div className="flex w-14 shrink-0 flex-col items-center rounded-[var(--radius-sm)] bg-bg-inset px-2 py-2">
                            <span className="text-[10px] font-bold uppercase text-primary">
                              {partesDataEvento(item.data).mes}
                            </span>
                            <span className="text-lg font-extrabold leading-none text-text">
                              {partesDataEvento(item.data).dia}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-text transition-colors group-hover:text-primary">
                              {item.titulo}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-text-muted">
                              {formatShortDate(item.data)} · {item.local}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold text-text-muted">
                            {item.modalidade === "ambas"
                              ? "Todas"
                              : item.modalidade === "bicicleta"
                                ? "Ciclismo"
                                : "Corrida"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* NEWS PREVIEW */}
          <Card className="flex flex-col">
            <SectionHeader 
              title="Notícias" 
              icon={Newspaper} 
              action={
                <Link href={withPreview("/noticias")} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
                  Ver todas
                </Link>
              } 
            />
            <div className="mt-3 flex flex-col gap-3">
              {noticias === null ? (
                <>
                  <SkeletonCard className="h-16" />
                  <SkeletonCard className="h-16" />
                </>
              ) : noticias.length === 0 ? (
                <EmptyState
                  icon={Newspaper}
                  title="Nenhuma notícia"
                  description="Comunicados vão aparecer aqui."
                />
              ) : (
                noticias.map((noticia) => (
                  <Link key={noticia.id} href={withPreview(`/noticias/${noticia.id}`)} className="group flex flex-col gap-1.5 p-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-inset)] hover:bg-[var(--color-bg-hover)] transition-colors border border-transparent hover:border-[var(--color-border-subtle)]">
                    <p className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2 leading-snug">{noticia.titulo}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{noticia.resumo}</p>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>

      <Modal
        open={Boolean(eventoAberto)}
        onClose={() => setEventoAbertoId(null)}
        title={eventoAberto?.titulo ?? "Detalhes do evento"}
        description={eventoAberto ? formatShortDate(eventoAberto.data) : undefined}
        size="md"
        mobileSheet
      >
        {eventoAberto ? (
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 rounded-[var(--radius-lg)] bg-bg-inset p-4">
              <div className="flex items-start gap-3">
                <CalendarCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Data</p>
                  <p className="mt-0.5 text-sm font-semibold text-text">
                    {formatShortDate(eventoAberto.data)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Local</p>
                  <p className="mt-0.5 break-words text-sm font-semibold text-text">
                    {eventoAberto.local}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ModalidadeIcon className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Modalidade</p>
                  <p className="mt-0.5 text-sm font-semibold text-text">
                    {eventoAberto.modalidade === "ambas"
                      ? "Corrida e ciclismo"
                      : eventoAberto.modalidade === "bicicleta"
                        ? "Ciclismo"
                        : "Corrida"}
                    {eventoAberto.km ? ` · ${eventoAberto.km} km` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Participação</p>
                  <p className="mt-0.5 text-sm font-semibold text-text">
                    {eventoAberto.inscritos?.length ?? 0} confirmado(s)
                  </p>
                </div>
              </div>
            </div>

            {eventoAbertoConfirmado ? (
              <div className="flex items-center gap-2 rounded-[var(--radius)] bg-success-subtle px-3 py-2.5 text-sm font-semibold text-success">
                <Check className="size-4 shrink-0" aria-hidden="true" />
                Sua presença está confirmada
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <a
                href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(eventoAberto.local)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-border px-3 text-sm font-semibold text-text-light transition-colors hover:bg-bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Navigation className="size-4 text-primary" aria-hidden="true" />
                Abrir no Maps
              </a>
              <Link
                href={withPreview("/eventos")}
                onClick={() => setEventoAbertoId(null)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-border px-3 text-sm font-semibold text-text-light transition-colors hover:bg-bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Agenda completa
              </Link>
            </div>

            <Button
              variant={eventoAbertoConfirmado ? "secondary" : "primary"}
              className="min-h-11 w-full justify-center"
              onClick={() => handleRsvp(eventoAberto)}
              loading={inscrevendo}
              disabled={isPreview}
            >
              {isPreview
                ? "Somente visualização"
                : eventoAbertoConfirmado
                  ? "Cancelar presença"
                  : "Confirmar presença"}
            </Button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
