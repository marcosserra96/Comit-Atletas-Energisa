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
import type { LucideIcon } from "lucide-react";
import {
  Trophy,
  Bike,
  Footprints,
  History,
  CalendarCheck,
  Newspaper,
  MapPin,
  Check,
  TrendingUp,
  Award,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
import type { AtletaDoc, EventoDoc, HistoricoPontoDoc, NoticiaDoc } from "@/lib/types";

export default function DashboardPage() {
  const { atleta } = useActiveSession();
  const { show } = useToast();
  const modalidade = modalidadeFromEquipe(atleta.equipe);
  const waitlisted = isWaitlisted(atleta.equipe);
  const ModalidadeIcon = modalidade === "bicicleta" ? Bike : Footprints;

  const [companheiros, setCompanheiros] = useState<AtletaDoc[] | null>(() => (modalidade ? null : []));
  const [meusLancamentos, setMeusLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [proximoEvento, setProximoEvento] = useState<EventoDoc[] | null>(null);
  const [noticias, setNoticias] = useState<NoticiaDoc[] | null>(null);
  const [inscrevendo, setInscrevendo] = useState(false);

  useEffect(() => {
    if (!modalidade) return;
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), where("equipe", "==", atleta.equipe), orderBy("pontuacaoTotal", "desc")),
      (snap) => setCompanheiros(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
      () => setCompanheiros([]),
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- modalidade deriva de atleta.equipe, mesma dependência
  }, [atleta.equipe]);

  useEffect(() => {
    let active = true;

    getDocs(query(collection(db, "historico_pontos"), where("atletaId", "==", atleta.id)))
      .then((snap) => {
        if (active) setMeusLancamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc));
      })
      .catch(() => {
        if (active) setMeusLancamentos([]);
      });

    getDocs(query(collection(db, "noticias"), orderBy("criadoEm", "desc"), limit(3)))
      .then((snap) => {
        if (active) setNoticias(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoticiaDoc));
      })
      .catch(() => {
        if (active) setNoticias([]);
      });

    return () => {
      active = false;
    };
  }, [atleta.id]);

  useEffect(() => {
    const isoHoje = new Date().toISOString().slice(0, 10);
    const unsubscribe = onSnapshot(
      query(collection(db, "agenda_eventos"), where("data", ">=", isoHoje), orderBy("data", "asc"), limit(1)),
      (snap) => setProximoEvento(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc)),
      () => setProximoEvento([]),
    );
    return unsubscribe;
  }, []);

  const insights = useMemo(() => {
    if (companheiros === null || meusLancamentos === null) return null;
    return calcularInsightsAtleta({ atleta, companheiros, meusLancamentos });
  }, [atleta, companheiros, meusLancamentos]);

  const ultimosLancamentos = useMemo(
    () => [...(meusLancamentos ?? [])].sort((a, b) => b.dataTreino.localeCompare(a.dataTreino)).slice(0, 5),
    [meusLancamentos],
  );

  const participacoesTotais = useMemo(() => {
    return meusLancamentos?.filter(l => !l.estornado).length ?? 0;
  }, [meusLancamentos]);

  const kmAcumulado = useMemo(() => {
    return meusLancamentos?.filter(l => !l.estornado).reduce((acc, curr) => acc + (curr.kmPercorrido || 0), 0) || 0;
  }, [meusLancamentos]);

  const evento = proximoEvento?.[0];
  const jaConfirmado = !!evento?.inscritos?.includes(atleta.id);

  async function handleRsvp() {
    if (!evento) return;
    setInscrevendo(true);
    try {
      await updateDoc(doc(db, "agenda_eventos", evento.id), {
        inscritos: jaConfirmado ? arrayRemove(atleta.id) : arrayUnion(atleta.id),
      });
      show("success", jaConfirmado ? "Presença cancelada." : "Presença confirmada!");
    } catch {
      show("error", "Não foi possível atualizar agora. Tente novamente.");
    } finally {
      setInscrevendo(false);
    }
  }

  const maxSerie = Math.max(1, ...(insights?.seriesMensal.map((s) => s.pontos) ?? [1]));
  const isTop3 = insights?.posicao && insights.posicao <= 3;
  const medalColor = insights?.posicao === 1 ? "var(--color-ranking-gold)" 
                   : insights?.posicao === 2 ? "var(--color-ranking-silver)" 
                   : insights?.posicao === 3 ? "var(--color-ranking-bronze)" 
                   : "var(--color-text-muted)";

  return (
    <div className="flex flex-col">
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
              value={!modalidade ? "—" : insights?.posicao ? `${insights.posicao}º` : "…"}
              icon={Award}
              iconColor={isTop3 ? medalColor : undefined}
              subtitle={modalidade && insights?.totalNoRanking ? `de ${insights.totalNoRanking} atletas` : undefined}
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
          <Card className="flex flex-col min-h-[300px]">
            <SectionHeader title="Próximo evento" icon={CalendarCheck} />
            {proximoEvento === null ? (
              <div className="flex flex-col gap-4 mt-4 h-full">
                <SkeletonCard className="h-32" />
                <SkeletonCard className="h-12 mt-auto" />
              </div>
            ) : !evento ? (
              <EmptyState
                icon={CalendarCheck}
                title="Nenhum evento agendado"
                description="Quando o comitê publicar um evento, ele aparece aqui."
              />
            ) : (
              <div className="flex flex-col flex-1 mt-2">
                <div className="bg-[var(--color-bg-inset)] rounded-[var(--radius-lg)] p-6 flex flex-col items-center justify-center text-center mb-5">
                  <span className="text-[var(--color-primary)] text-sm font-bold uppercase tracking-wider mb-1">
                    {new Date(evento.data).toLocaleDateString('pt-BR', { month: 'short' })}
                  </span>
                  <span className="text-4xl font-black text-[var(--color-text)] leading-none">
                    {new Date(evento.data).getDate()}
                  </span>
                </div>
                <p className="font-semibold text-[var(--color-text)] line-clamp-2 text-lg">{evento.titulo}</p>
                <p className="mt-3 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <MapPin className="size-4 shrink-0" />
                  <span className="truncate">{evento.local}</span>
                </p>
                <div className="mt-auto pt-6">
                  <Button
                    variant={jaConfirmado ? "secondary" : "primary"}
                    className="w-full justify-center"
                    onClick={handleRsvp}
                    loading={inscrevendo}
                  >
                    {jaConfirmado ? (
                      <>
                        <Check className="size-4 mr-2" />
                        Presença confirmada
                      </>
                    ) : (
                      "Confirmar presença"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* NEWS PREVIEW */}
          <Card className="flex flex-col">
            <SectionHeader 
              title="Notícias" 
              icon={Newspaper} 
              action={
                <Link href="/noticias" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
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
                  <Link key={noticia.id} href={`/noticias/${noticia.id}`} className="group flex flex-col gap-1.5 p-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-inset)] hover:bg-[var(--color-bg-hover)] transition-colors border border-transparent hover:border-[var(--color-border-subtle)]">
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
  );
}
