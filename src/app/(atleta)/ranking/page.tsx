"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { AlertCircle, EyeOff, RefreshCw, Search, Trophy } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useAthleteDirectoryCollection } from "@/lib/session/useAthleteDirectory";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SportBadge } from "@/components/ui/SportBadge";
import { RankingPosition } from "@/components/ui/RankingPosition";
import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import { normalizarRankingPeriods } from "@/lib/rankingPeriods";
import {
  modalidadeDoAtleta,
  normalizarRankingVisibility,
  rankingOcultoAgora,
} from "@/lib/rankingVisibility";
import type {
  AtletaPublicoDoc,
  Modalidade,
  RankingPeriodKey,
  RankingPeriodsConfigDoc,
  RankingResultadoDoc,
  RankingVisibilityConfigDoc,
} from "@/lib/types";

interface RankingEntry extends AtletaPublicoDoc {
  treinos?: number;
  km?: number;
}

interface RankedAtleta extends RankingEntry {
  rank: number;
}

function Place({
  atleta,
  position,
  height,
  maxWidth,
}: {
  atleta?: RankedAtleta;
  position: 1 | 2 | 3;
  height: string;
  maxWidth: string;
}) {
  const color =
    position === 1
      ? "var(--color-ranking-gold)"
      : position === 2
        ? "var(--color-ranking-silver)"
        : "var(--color-ranking-bronze)";
  const background =
    position === 1
      ? "var(--color-ranking-gold-bg)"
      : position === 2
        ? "var(--color-ranking-silver-bg)"
        : "var(--color-ranking-bronze-bg)";

  return (
    <div
      className="relative flex w-1/3 flex-col items-center justify-end"
      style={{ height, maxWidth }}
    >
      {atleta ? (
        <>
          <div className="mb-2 flex w-full flex-col items-center px-1 text-center">
            <RankingPosition
              position={position}
              size={position === 1 ? "lg" : "md"}
              className={position === 1 ? "mb-2 scale-110 shadow-md sm:scale-125" : "mb-2"}
            />
            <span className="w-full truncate text-xs font-bold text-text sm:text-sm">
              {atleta.nome}
            </span>
            <span className="text-xs font-extrabold sm:text-sm" style={{ color }}>
              {atleta.pontuacaoTotal} pts
            </span>
            {atleta.treinos !== undefined ? (
              <span className="mt-0.5 text-[10px] text-text-muted">
                {atleta.treinos} treinos · {atleta.km?.toFixed(1)} km
              </span>
            ) : null}
          </div>
          <div
            className="relative h-full w-full overflow-hidden rounded-t-[var(--radius-lg)] border-2 shadow-sm"
            style={{ backgroundColor: background, borderColor: color }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
          </div>
        </>
      ) : (
        <div className="h-full w-full rounded-t-[var(--radius-lg)] border-2 border-dashed border-border bg-bg-inset opacity-50" />
      )}
    </div>
  );
}

function Podium({ atletas }: { atletas: RankedAtleta[] }) {
  if (atletas.length === 0) return null;
  const [primeiro, segundo, terceiro] = atletas;



  return (
    <div className="mb-12 mt-12 flex h-56 items-end justify-center gap-2 px-2 sm:h-64 sm:gap-4">
      <Place atleta={segundo} position={2} height="75%" maxWidth="120px" />
      <Place atleta={primeiro} position={1} height="100%" maxWidth="140px" />
      <Place atleta={terceiro} position={3} height="60%" maxWidth="120px" />
    </div>
  );
}

export default function RankingPage() {
  const { atleta: myAtleta } = useAthleteView();
  const { usuario } = useActiveSession();
  const athleteDirectory = useAthleteDirectoryCollection();
  const isStaff = usuario.role === "administrador" || usuario.role === "comite";
  const athleteModality = modalidadeDoAtleta(myAtleta.equipe);

  const [modalidade, setModalidade] = useState<Modalidade>(athleteModality ?? "corrida");
  const [periodo, setPeriodo] = useState<RankingPeriodKey>("geral");
  const [legacy, setLegacy] = useState<AtletaPublicoDoc[] | null>(null);
  const [resultados, setResultados] = useState<RankingResultadoDoc[] | null>(null);
  const [search, setSearch] = useState("");
  const [erroRanking, setErroRanking] = useState(false);
  const [visibility, setVisibility] = useState<RankingVisibilityConfigDoc | null | undefined>(
    undefined,
  );
  const [periods, setPeriods] = useState<RankingPeriodsConfigDoc | null | undefined>(undefined);
  const [erroConfig, setErroConfig] = useState(false);

  useEffect(() => {
    const unsubVisibility = onSnapshot(
      doc(db, "configuracoes", "ranking_visibilidade"),
      (snap) => {
        setVisibility(
          snap.exists()
            ? normalizarRankingVisibility(snap.data() as Partial<RankingVisibilityConfigDoc>)
            : null,
        );
        setErroConfig(false);
      },
      () => {
        setVisibility(null);
        setErroConfig(true);
      },
    );
    const unsubPeriods = onSnapshot(
      doc(db, "configuracoes", "ranking_periodos"),
      (snap) => {
        setPeriods(
          snap.exists()
            ? normalizarRankingPeriods(snap.data() as Partial<RankingPeriodsConfigDoc>)
            : null,
        );
        setErroConfig(false);
      },
      () => {
        setPeriods(null);
        setErroConfig(true);
      },
    );
    return () => {
      unsubVisibility();
      unsubPeriods();
    };
  }, []);

  const periodoEfetivo: RankingPeriodKey =
    periodo === "trimestre" && periods?.trimestre.ativo ? "trimestre" : "geral";
  const possuiResultadosPublicados = Boolean(periods?.geracaoPublicada);
  const corridaOculta =
    !isStaff && visibility ? rankingOcultoAgora(visibility, "corrida") : false;
  const bicicletaOculta =
    !isStaff && visibility ? rankingOcultoAgora(visibility, "bicicleta") : false;
  const rankingOcultoAtual = modalidade === "corrida" ? corridaOculta : bicicletaOculta;
  const mensagemOcultacao =
    visibility?.[modalidade].mensagem.trim() ||
    "O ranking está em fechamento para conferência dos resultados e premiações.";
  const podeConsultar = isStaff || athleteModality === modalidade;

  useEffect(() => {
    if (
      !possuiResultadosPublicados ||
      !periods?.geracaoPublicada ||
      !podeConsultar ||
      rankingOcultoAtual ||
      (!isStaff && (visibility === undefined || erroConfig))
    ) {
      return;
    }

    const q = query(
      collection(db, "ranking_resultados"),
      where("geracaoId", "==", periods.geracaoPublicada),
      where("periodoId", "==", periodoEfetivo),
      where("equipe", "==", modalidade),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setResultados(snap.docs.map((item) => item.data() as RankingResultadoDoc));
        setErroRanking(false);
      },
      () => {
        setResultados([]);
        setErroRanking(true);
      },
    );
    return unsubscribe;
  }, [
    erroConfig,
    isStaff,
    modalidade,
    podeConsultar,
    periodoEfetivo,
    periods?.geracaoPublicada,
    possuiResultadosPublicados,
    rankingOcultoAtual,
    visibility,
  ]);

  useEffect(() => {
    if (
      possuiResultadosPublicados ||
      periods === undefined ||
      !athleteDirectory ||
      !podeConsultar ||
      rankingOcultoAtual ||
      (!isStaff && (visibility === undefined || erroConfig))
    ) {
      return;
    }

    const q = query(
      collection(db, athleteDirectory),
      where("equipe", "==", modalidade),
      orderBy("pontuacaoTotal", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLegacy(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as AtletaPublicoDoc));
        setErroRanking(false);
      },
      () => {
        setLegacy([]);
        setErroRanking(true);
      },
    );
    return unsubscribe;
  }, [
    athleteDirectory,
    erroConfig,
    isStaff,
    modalidade,
    periods,
    podeConsultar,
    possuiResultadosPublicados,
    rankingOcultoAtual,
    visibility,
  ]);

  const atletasAtuais = useMemo<RankingEntry[] | null>(() => {
    const lista: RankingEntry[] | null = possuiResultadosPublicados ? resultados : legacy;
    if (!lista) return null;
    return [...lista].sort(
      (a, b) =>
        b.pontuacaoTotal - a.pontuacaoTotal ||
        (b.treinos ?? 0) - (a.treinos ?? 0) ||
        (b.km ?? 0) - (a.km ?? 0) ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [legacy, possuiResultadosPublicados, resultados]);

  const atletasComRank = useMemo<RankedAtleta[] | null>(() => {
    if (!atletasAtuais) return null;
    return atletasAtuais.map((atleta, index) => ({ ...atleta, rank: index + 1 }));
  }, [atletasAtuais]);

  const filteredAtletas = useMemo(() => {
    if (!atletasComRank) return null;
    const termo = search.trim().toLocaleLowerCase("pt-BR");
    return termo
      ? atletasComRank.filter((atleta) =>
          atleta.nome.toLocaleLowerCase("pt-BR").includes(termo),
        )
      : atletasComRank;
  }, [atletasComRank, search]);

  const top3 = atletasComRank?.slice(0, 3) ?? [];
  const myRankAtleta = atletasComRank?.find((atleta) => atleta.id === myAtleta.id);
  const trimestreDisponivel =
    Boolean(periods?.geracaoPublicada) && periods?.trimestre.ativo === true;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Ranking"
        subtitle={
          isStaff
            ? "Classificação publicada por período e modalidade."
            : "Classificação publicada da sua modalidade."
        }
        icon={Trophy}
        badge={<SportBadge modalidade={modalidade} size="md" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {trimestreDisponivel ? (
              <SegmentedControl
                value={periodoEfetivo}
                onChange={(value) => {
                  setPeriodo(value as RankingPeriodKey);
                  setResultados(null);
                  setSearch("");
                }}
                options={[
                  { value: "geral", label: "Geral" },
                  { value: "trimestre", label: periods?.trimestre.nome ?? "Trimestre" },
                ]}
              />
            ) : null}
            {isStaff ? (
              <SegmentedControl
                value={modalidade}
                onChange={(value) => {
                  setModalidade(value as Modalidade);
                  setResultados(null);
                  setLegacy(null);
                  setSearch("");
                }}
                options={[
                  { value: "corrida", label: "Corrida" },
                  { value: "bicicleta", label: "Ciclismo" },
                ]}
              />
            ) : null}
          </div>
        }
      />

      {periodoEfetivo === "trimestre" && periods?.trimestre.ativo ? (
        <div className="rounded-[var(--radius)] border border-border bg-bg-card px-4 py-3 text-sm text-text-light">
          <strong className="text-text">{periods.trimestre.nome}</strong>
          <span className="mx-2 text-text-muted">·</span>
          {formatShortDate(periods.trimestre.inicio)} a {formatShortDate(periods.trimestre.fim)}
        </div>
      ) : null}

      {!isStaff && !athleteModality ? (
        <EmptyState
          icon={Trophy}
          title="Modalidade não definida"
          description="Seu cadastro ainda não está vinculado a uma modalidade de corrida ou ciclismo."
        />
      ) : !isStaff && (visibility === undefined || periods === undefined) ? (
        <Card className="h-72 animate-pulse" />
      ) : !isStaff && erroConfig ? (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <AlertCircle className="size-8 text-danger" />
          <h2 className="font-bold text-text">Não foi possível verificar o ranking</h2>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </Card>
      ) : rankingOcultoAtual ? (
        <Card>
          <EmptyState
            icon={EyeOff}
            title="Ranking temporariamente oculto"
            description={mensagemOcultacao}
          />
        </Card>
      ) : atletasAtuais === null ? (
        <div className="space-y-8">
          <div className="flex h-56 items-end justify-center gap-2 px-2 sm:h-64 sm:gap-4">
            <Skeleton className="h-[75%] w-1/3 max-w-[120px] rounded-b-none rounded-t-[var(--radius-lg)]" />
            <Skeleton className="h-full w-1/3 max-w-[140px] rounded-b-none rounded-t-[var(--radius-lg)]" />
            <Skeleton className="h-[60%] w-1/3 max-w-[120px] rounded-b-none rounded-t-[var(--radius-lg)]" />
          </div>
          <Card className="p-4">
            <SkeletonLine className="h-10" />
          </Card>
        </div>
      ) : erroRanking ? (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <AlertCircle className="size-8 text-danger" />
          <h2 className="font-bold text-text">Não foi possível carregar o ranking</h2>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </Card>
      ) : atletasAtuais.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Sem ranking publicado"
          description="A gestão ainda não publicou resultados para este período."
        />
      ) : (
        <div className="flex flex-col">
          {!search.trim() ? <Podium atletas={top3} /> : null}

          <Card className="flex flex-col overflow-hidden p-0">
            <div className="border-b border-border bg-bg/50 p-4 sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  aria-label="Buscar atleta por nome"
                  placeholder="Buscar atleta por nome..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="block w-full rounded-[var(--radius)] border border-border bg-bg py-2.5 pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {filteredAtletas?.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Search}
                  title="Nenhum atleta encontrado"
                  description={`Ninguém com o nome "${search}" nesta modalidade.`}
                />
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {filteredAtletas?.map((atleta) => {
                  const isMe = atleta.id === myAtleta.id;
                  const isTop3 = atleta.rank <= 3;
                  return (
                    <li
                      key={atleta.id}
                      className={cn(
                        "flex items-center gap-3 border-l-4 px-4 py-3 transition-colors hover:bg-bg-inset sm:px-5 sm:py-4",
                        isMe
                          ? "border-l-primary bg-[var(--color-primary-subtle)]"
                          : "border-l-transparent",
                      )}
                    >
                      <RankingPosition
                        position={atleta.rank}
                        size={isTop3 ? "md" : "sm"}
                        className={cn(!isTop3 && "bg-bg text-text-muted")}
                      />
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm font-medium text-text sm:text-base",
                            isMe && "font-bold text-primary",
                          )}
                        >
                          {atleta.nome}
                          {isMe ? <span className="ml-1 text-xs font-normal">(você)</span> : null}
                        </span>
                      </div>
                      <div className="grid shrink-0 grid-cols-3 gap-2 text-right sm:gap-5">
                        <div>
                          <strong className="block text-sm text-text">
                            {atleta.treinos ?? "—"}
                          </strong>
                          <span className="text-[10px] text-text-muted">treinos</span>
                        </div>
                        <div>
                          <strong className="block text-sm text-text">
                            {atleta.km === undefined ? "—" : atleta.km.toFixed(1)}
                          </strong>
                          <span className="text-[10px] text-text-muted">km</span>
                        </div>
                        <div>
                          <strong className="block text-sm text-text sm:text-base">
                            {atleta.pontuacaoTotal}
                          </strong>
                          <span className="text-[10px] text-text-muted">pontos</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {myRankAtleta && !search && myRankAtleta.rank > 3 ? (
              <div className="border-t border-border bg-bg-inset p-3 text-center text-xs text-text-muted sm:text-sm">
                Sua posição é <strong className="text-text">{myRankAtleta.rank}º lugar</strong> com{" "}
                {myRankAtleta.pontuacaoTotal} pontos, {myRankAtleta.treinos ?? 0} treinos e{" "}
                {(myRankAtleta.km ?? 0).toFixed(1)} km.
              </div>
            ) : null}
          </Card>

          {!possuiResultadosPublicados && isStaff ? (
            <p className="mt-3 text-center text-xs text-text-muted">
              Visualização de compatibilidade. Publique os períodos para incluir treinos e quilômetros.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
