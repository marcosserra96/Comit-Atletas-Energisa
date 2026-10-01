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
  CalendarCheck,
  Newspaper,
  MapPin,
  Check,
  Award,
  AlertCircle,
  Navigation,
  Users,
  CalendarOff,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useAthleteDirectoryCollection } from "@/lib/session/useAthleteDirectory";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { isWaitlisted, modalidadeFromEquipe } from "@/lib/labels";
import { dataIsoLocal } from "@/lib/date";
import { motion } from "framer-motion";
import { formatDataTreino, formatDistancia, formatKm, formatPontos, formatShortDate, plural } from "@/lib/format";
import { calcularInsightsAtleta } from "@/lib/athleteStats";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import {
  normalizarRankingVisibility,
  rankingOcultoAgora,
} from "@/lib/rankingVisibility";
import { noticiaVisivel } from "@/lib/noticias";
import { useDiasTreino } from "@/lib/useDiasTreino";
import { aderenciaDoAtleta } from "@/lib/aderencia";
import { useRegrasDeTreino } from "@/lib/useRegrasDeTreino";
import type {
  AtletaPublicoDoc,
  EventoDoc,
  HistoricoMensalDoc,
  HistoricoPontoDoc,
  NoticiaDoc,
  RankingVisibilityConfigDoc,
} from "@/lib/types";
import { modalidadeLabel } from "@/lib/labels";

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
  const [meuHistoricoMensal, setMeuHistoricoMensal] = useState<HistoricoMensalDoc[] | null>(null);
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

    Promise.all([
      getDocs(query(collection(db, "historico_pontos"), where("atletaId", "==", atleta.id))),
      getDocs(query(collection(db, "historico_mensal"), where("atletaId", "==", atleta.id))),
    ])
      .then(([snapLancamentos, snapMensal]) => {
        if (active) {
          setMeusLancamentos(
            snapLancamentos.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc),
          );
          setMeuHistoricoMensal(
            snapMensal.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoMensalDoc),
          );
          setErroHistorico(false);
        }
      })
      .catch(() => {
        if (active) {
          setMeusLancamentos([]);
          setMeuHistoricoMensal([]);
          setErroHistorico(true);
        }
      });

    // Busca algumas a mais porque as que já saíram do ar são descartadas aqui.
    getDocs(query(collection(db, "noticias"), orderBy("criadoEm", "desc"), limit(12)))
      .then((snap) => {
        if (active) {
          setNoticias(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() }) as NoticiaDoc)
              .filter((n) => noticiaVisivel(n))
              .slice(0, 2),
          );
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

  const regrasTreino = useRegrasDeTreino();
  const insights = useMemo(() => {
    const companheirosParaInsights = rankingIndisponivel ? [] : companheiros;
    if (
      companheirosParaInsights === null ||
      meusLancamentos === null ||
      meuHistoricoMensal === null ||
      regrasTreino === null
    ) return null;
    return calcularInsightsAtleta({
      atleta,
      companheiros: companheirosParaInsights,
      meusLancamentos,
      historicoMensal: meuHistoricoMensal,
      regrasTreino,
    });
  }, [atleta, companheiros, meusLancamentos, meuHistoricoMensal, rankingIndisponivel, regrasTreino]);

  const diasTreino = useDiasTreino();
  const aderenciaMes = useMemo(() => {
    const modalidade = modalidadeFromEquipe(atleta.equipe);
    if (!diasTreino || !meusLancamentos || !modalidade || !regrasTreino) return null;
    const hoje = dataIsoLocal();
    return aderenciaDoAtleta({
      modalidade,
      config: diasTreino,
      lancamentos: meusLancamentos,
      resumosMensais: meuHistoricoMensal ?? [],
      de: `${hoje.slice(0, 7)}-01`,
      ate: hoje,
      regrasTreino,
    });
  }, [atleta.equipe, diasTreino, meusLancamentos, meuHistoricoMensal, regrasTreino]);

  const ultimosLancamentos = useMemo(
    () => [...(meusLancamentos ?? [])].sort((a, b) => b.dataTreino.localeCompare(a.dataTreino)).slice(0, 5),
    [meusLancamentos],
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

  const nomeCurto = atleta.nome.split(" ")[0];
  const nomeModalidade =
    modalidade === "bicicleta" || modalidade === "corrida"
      ? modalidadeLabel[modalidade]
      : "Modalidade não definida";
  const statusPrograma = waitlisted ? "Fila de espera" : atleta.ativo ? "Ativo no programa" : "Inativo";
  const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const ultimasAtividades = ultimosLancamentos.slice(0, 3);

  /** Linha do ranking dentro do resumo — texto claro para cada situação. */
  const linhaRanking = (() => {
    if (rankingDesativado) return { texto: "Ranking indisponível no momento", link: false };
    if (rankingOcultoAtual) return { texto: "Ranking em fechamento para conferência", link: false };
    if (waitlisted || !modalidade) return null;
    if (!insights?.posicao) return null;
    return {
      texto: `${insights.posicao}º lugar na ${nomeModalidade} · ${formatPontos(atleta.pontuacaoTotal)} ${atleta.pontuacaoTotal === 1 ? "ponto" : "pontos"} no total`,
      link: true,
    };
  })();

  return (
    <>
      {/*
        Uma única tela para celular e computador. No celular a capa ocupa a largura
        toda e o conteúdo "sobe" sobre ela; a partir de `sm` a capa vira um cartão e o
        conteúdo se organiza em duas colunas.
      */}
      <section className="superficie-escura relative isolate -mx-4 -mt-4 overflow-hidden bg-navy px-4 pb-10 pt-4 text-white sm:mx-0 sm:mt-0 sm:rounded-[var(--radius-xl)] sm:px-8 sm:py-7">
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
          className="absolute -bottom-5 -right-8 -z-10 size-44 text-white/[0.05] sm:right-10"
          strokeWidth={1}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent"
        />

        <div className="flex items-start justify-between gap-4 sm:hidden">
          <Image
            src="/logos/logo-comite-branca-trim.png"
            alt="Atletas Energisa"
            width={156}
            height={48}
            priority
            className="h-auto w-[120px]"
          />
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
            {statusPrograma}
          </span>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:mt-0 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/75">Olá,</p>
            <h1 className="mt-0.5 text-3xl font-black tracking-tight sm:text-4xl">{nomeCurto}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/80">
              <ModalidadeIcon className="size-4 shrink-0 text-secondary" aria-hidden="true" />
              <span>{nomeModalidade}</span>
            </p>
            {insights?.leitura ? (
              <p className="mt-3 max-w-xl text-sm text-white/85 [text-wrap:pretty]">{insights.leitura}</p>
            ) : null}
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-3 sm:flex">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
              {statusPrograma}
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-secondary">
              Movimento que conecta
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-secondary sm:hidden">
          Movimento que conecta
        </p>
      </section>

      <div className="relative -mx-4 -mt-5 rounded-t-[28px] bg-bg px-4 pt-6 sm:mx-0 sm:mt-6 sm:rounded-none sm:p-0">
        {erroDados ? (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-[var(--radius)] border border-danger/20 bg-danger/5 p-3 text-sm text-text-light"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
            <p>
              Não foi possível carregar: {fontesComErro.join(", ")}. Atualize a página; se o
              problema continuar, fale com o comitê.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Coluna principal: como estou e o que vem pela frente. */}
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <section className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Seu mês</p>
                  <h2 className="mt-0.5 text-lg font-extrabold text-text first-letter:uppercase">
                    {mesAtual}
                  </h2>
                </div>
                <Link
                  href={withPreview("/desempenho")}
                  className="flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Ver análise
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </div>

              {insights ? (
                <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-[var(--radius)] bg-bg-inset py-3 text-center">
                  <div className="px-2">
                    <dd className="text-2xl font-black tabular-nums text-text">{insights.treinosMes}</dd>
                    <dt className="text-xs text-text-muted">{insights.treinosMes === 1 ? "treino" : "treinos"}</dt>
                  </div>
                  <div className="px-2">
                    <dd className="text-2xl font-black tabular-nums text-text">{formatDistancia(insights.kmMes)}</dd>
                    <dt className="text-xs text-text-muted">km</dt>
                  </div>
                  <div className="px-2">
                    <dd className="text-2xl font-black tabular-nums text-text">{formatPontos(insights.pontosMes)}</dd>
                    <dt className="text-xs text-text-muted">{insights.pontosMes === 1 ? "ponto" : "pontos"}</dt>
                  </div>
                </dl>
              ) : (
                <div className="mt-4 h-[76px] animate-pulse rounded-[var(--radius)] bg-bg-inset" />
              )}

              {aderenciaMes?.percentual != null ? (
                <div className="mt-3 px-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-text">Aderência aos treinos</span>
                    <span className="font-bold tabular-nums text-text">{aderenciaMes.percentual}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-inset" aria-hidden="true">
                    <motion.div
                      className="h-full origin-left rounded-full bg-secondary"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: aderenciaMes.percentual / 100 }}
                      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-light">
                    {aderenciaMes.informada
                      ? "Informada pelo comitê no histórico do mês"
                      : `${aderenciaMes.feitos} de ${plural(aderenciaMes.previstos, "treino previsto", "treinos previstos")} até hoje`}
                  </p>
                </div>
              ) : null}

              {linhaRanking ? (
                linhaRanking.link ? (
                  <Link
                    href={withPreview("/ranking")}
                    className="group mt-3 flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ranking-gold-bg text-ranking-gold-text">
                      <Trophy className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 font-semibold text-text group-hover:text-primary">
                      {linhaRanking.texto}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="mt-3 flex min-h-11 items-center gap-3 px-1 text-sm text-text-light">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bg-inset text-text-muted">
                      <Trophy className="size-4" aria-hidden="true" />
                    </span>
                    {linhaRanking.texto}
                  </p>
                )
              ) : null}
            </section>

            <section className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Próximo evento</p>
                  <h2 className="mt-0.5 text-lg font-extrabold text-text">Na sua agenda</h2>
                </div>
                <Link
                  href={withPreview("/eventos")}
                  className="flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Ver todos
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </div>

              {proximoEvento === null ? (
                <div className="mt-3 h-36 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
              ) : evento ? (
                <div className="mt-3">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => setEventoAbertoId(evento.id)}
                    className="flex min-h-20 w-full cursor-pointer items-center gap-3 rounded-[var(--radius)] bg-bg-inset p-3 text-left transition-colors hover:bg-border-subtle active:bg-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-[var(--radius)] bg-bg-card shadow-sm">
                      <span className="text-xs font-bold uppercase text-primary">{dataEvento?.mes}</span>
                      <span className="text-xl font-black leading-none text-text">{dataEvento?.dia}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-bold text-text">{evento.titulo}</span>
                      <span className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{evento.local}</span>
                      </span>
                    </span>
                    {jaConfirmado ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-subtle px-2 py-1 text-xs font-bold text-success">
                        <Check className="size-3.5" aria-hidden="true" />
                        Confirmado
                      </span>
                    ) : (
                      <ChevronRight className="size-5 shrink-0 text-text-muted" aria-hidden="true" />
                    )}
                  </button>
                  <Button
                    variant={jaConfirmado ? "secondary" : "primary"}
                    className="mt-3 w-full"
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

                  {eventosPosteriores.length > 0 ? (
                    <div className="mt-4 border-t border-border-subtle pt-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Depois</p>
                      <ul className="mt-1 flex flex-col">
                        {eventosPosteriores.slice(0, 2).map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              onClick={() => setEventoAbertoId(item.id)}
                              className="group flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[var(--radius)] px-1 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <span className="w-14 shrink-0 text-xs font-bold uppercase tabular-nums text-primary">
                                {formatShortDate(item.data)}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text group-hover:text-primary">
                                {item.titulo}
                              </span>
                              <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-[var(--radius)] bg-bg-inset p-4 text-center text-sm text-text-muted">
                  Nenhum evento agendado no momento.
                </p>
              )}
            </section>
          </div>

          {/* Coluna lateral: ações e contexto. */}
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <Link
              href={withPreview("/justificativas")}
              className="group flex min-h-20 items-center gap-3 rounded-[var(--radius-lg)] border border-secondary/20 bg-gradient-to-r from-secondary/10 to-bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-secondary/40 active:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                <CalendarOff className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-text">Vai ficar sem treinar?</strong>
                <span className="mt-0.5 block text-xs text-text-light">
                  Informe o período e acompanhe a análise do Comitê.
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>

            <section className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Histórico</p>
                  <h2 className="mt-0.5 text-lg font-extrabold text-text">Atividade recente</h2>
                </div>
                <Link
                  href={withPreview("/desempenho")}
                  className="flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Ver tudo
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </div>

              {meusLancamentos === null ? (
                <div className="mt-3 h-24 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
              ) : ultimasAtividades.length === 0 ? (
                <p className="mt-3 rounded-[var(--radius)] bg-bg-inset p-4 text-center text-sm text-text-muted">
                  Assim que o comitê lançar seus pontos, eles aparecem aqui.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col divide-y divide-border">
                  {ultimasAtividades.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3 last:pb-0">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full",
                          item.estornado ? "bg-bg-inset text-text-muted" : "bg-primary-subtle text-primary",
                        )}
                      >
                        {item.tipoLancamento === "treino" ? (
                          <ModalidadeIcon className="size-5" aria-hidden="true" />
                        ) : (
                          <Award className="size-5" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm font-semibold text-text",
                            item.estornado && "text-text-muted line-through",
                          )}
                        >
                          {item.regraDesc}
                        </span>
                        <span className="mt-0.5 block text-xs text-text-light">
                          {formatDataTreino(item.dataTreino, item.dataAproximada)}
                          {item.estornado ? " · estornado" : ""}
                        </span>
                      </span>
                      {!item.estornado ? (
                        <span className="shrink-0 text-sm font-bold tabular-nums text-success">
                          +{formatPontos(item.pontos)} pts
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Novidades</p>
                  <h2 className="mt-0.5 text-lg font-extrabold text-text">Últimas notícias</h2>
                </div>
                <Link
                  href={withPreview("/noticias")}
                  className="flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Ver todas
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </div>

              {noticias === null ? (
                <div className="mt-3 h-20 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
              ) : noticias.length === 0 ? (
                <p className="mt-3 rounded-[var(--radius)] bg-bg-inset p-4 text-center text-sm text-text-muted">
                  Nenhuma notícia publicada no momento.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col divide-y divide-border">
                  {noticias.slice(0, 2).map((noticia) => (
                    <li key={noticia.id}>
                      <Link
                        href={withPreview(`/noticias/${noticia.id}`)}
                        className="group flex min-h-16 items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                          <Newspaper className="size-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-semibold text-text group-hover:text-primary">
                            {noticia.titulo}
                          </span>
                          {noticia.resumo ? (
                            <span className="mt-0.5 block truncate text-xs text-text-light">{noticia.resumo}</span>
                          ) : null}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
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
                      ? "Corrida e bike"
                      : eventoAberto.modalidade === "bicicleta"
                        ? modalidadeLabel.bicicleta
                        : "Corrida"}
                    {eventoAberto.km ? ` · ${formatKm(eventoAberto.km)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Participação</p>
                  <p className="mt-0.5 text-sm font-semibold text-text">
                    {plural(eventoAberto.inscritos?.length ?? 0, "confirmado")}
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
