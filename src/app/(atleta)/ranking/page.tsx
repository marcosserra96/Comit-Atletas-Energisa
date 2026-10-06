"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, EyeOff, RefreshCw, Search, Trophy } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useAthleteDirectoryCollection } from "@/lib/session/useAthleteDirectory";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SportBadge } from "@/components/ui/SportBadge";
import { RankingPosition } from "@/components/ui/RankingPosition";
import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDistancia, formatKm, formatPontos, formatRelativeTime, formatShortDate, plural } from "@/lib/format";
import { competenciaAtualBrasil, normalizarRankingPeriods, somarMeses } from "@/lib/rankingPeriods";
import { calcularPosicoesRanking, montarPodio, type DegrauDoPodio } from "@/lib/rankingPosition";
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
import { modalidadeLabel } from "@/lib/labels";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface RankingEntry extends AtletaPublicoDoc {
  treinos?: number;
  km?: number;
}

interface RankedAtleta extends RankingEntry {
  rank: number;
}

// `texto`: tom escuro da medalha, legível sobre o fundo (o tom puro é só para bordas).
const COR_POSICAO: Record<number, { cor: string; fundo: string; texto: string; barra: string }> = {
  1: { cor: "var(--color-ranking-gold)", fundo: "var(--color-ranking-gold-bg)", texto: "var(--color-ranking-gold-text)", barra: "h-24 sm:h-36" },
  2: { cor: "var(--color-ranking-silver)", fundo: "var(--color-ranking-silver-bg)", texto: "var(--color-ranking-silver-text)", barra: "h-16 sm:h-24" },
  3: { cor: "var(--color-ranking-bronze)", fundo: "var(--color-ranking-bronze-bg)", texto: "var(--color-ranking-bronze-text)", barra: "h-11 sm:h-16" },
};

/** "Lucas de Paula Resende" → "Lucas Resende" (o pódio é estreito; a tabela mostra o nome todo). */
function nomeDoPodio(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : nome.trim();
}

/** Um degrau: a posição, quem divide ela e os pontos (iguais para todos no empate). */
function Degrau({ degrau }: { degrau: DegrauDoPodio<RankedAtleta> }) {
  const { posicao, atletas, total } = degrau;
  const { cor, fundo, texto, barra } = COR_POSICAO[posicao] ?? COR_POSICAO[3];
  const empate = total > 1;
  const [primeiro] = atletas;
  const fora = total - atletas.length;

  return (
    <div className="relative flex w-1/3 flex-col items-center justify-end" style={{ maxWidth: posicao === 1 ? "170px" : "150px" }}>
      <div className="mb-2 flex w-full flex-col items-center px-1 text-center">
        <RankingPosition
          position={posicao}
          size={posicao === 1 ? "lg" : "md"}
          className={posicao === 1 ? "mb-2 scale-110 shadow-md sm:scale-125" : "mb-2"}
        />
        {empate ? (
          <span
            className="mb-1 rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ color: texto, backgroundColor: fundo, boxShadow: `inset 0 0 0 1px ${cor}` }}
          >
            Empate
          </span>
        ) : null}
        {atletas.map((a) => (
          <span key={a.id} className="w-full truncate text-xs font-bold leading-snug text-text sm:text-sm" title={a.nome}>
            {nomeDoPodio(a.nome)}
          </span>
        ))}
        {fora > 0 ? <span className="text-xs text-text-light">e mais {fora}</span> : null}
        <span className="text-xs font-extrabold sm:text-sm" style={{ color: texto }}>
          {formatPontos(primeiro.pontuacaoTotal)} pts{empate ? " cada" : ""}
        </span>
        {!empate && primeiro.treinos !== undefined ? (
          <span className="mt-0.5 text-xs text-text-muted">
            {plural(primeiro.treinos, "treino")} · {formatKm(primeiro.km ?? 0)}
          </span>
        ) : null}
      </div>
      <div
        className={cn("relative w-full shrink-0 overflow-hidden rounded-t-[var(--radius-lg)] border-2 shadow-sm", barra)}
        style={{ backgroundColor: fundo, borderColor: cor }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
      </div>
    </div>
  );
}

/**
 * Pódio pelas posições (1º, 2º e 3º lugares), não pelos 3 primeiros nomes:
 * empatados dividem o degrau, e o 3º lugar aparece mesmo com empate no 2º.
 * Mesma regra do informativo.
 */
function Podium({ atletas }: { atletas: RankedAtleta[] }) {
  const degraus = montarPodio(atletas, (a) => a.rank, (a) => a.pontuacaoTotal);
  const pessoas = degraus.reduce((soma, d) => soma + d.total, 0);
  // Com uma pessoa só, o pódio não compara nada; a tabela já mostra a posição.
  if (pessoas < 2) return null;
  const ordem = [2, 1, 3]
    .map((posicao) => degraus.find((d) => d.posicao === posicao))
    .filter((d): d is DegrauDoPodio<RankedAtleta> => d !== undefined);
  // Altura pelo conteúdo: as barras têm altura fixa por posição, o texto fica por cima.
  return (
    <div className="mb-6 mt-6 flex items-end justify-center gap-2 px-2 sm:mb-10 sm:mt-10 sm:gap-4">
      {ordem.map((degrau) => (
        <Degrau key={degrau.posicao} degrau={degrau} />
      ))}
    </div>
  );
}

function rotuloCompetencia(competencia: string) {
  return `${MESES[Number(competencia.slice(5, 7)) - 1]} de ${competencia.slice(0, 4)}`;
}

/** ‹ Setembro de 2026 › — do primeiro mês publicado até o mês atual. */
function NavegadorMes({
  competencia,
  atual,
  desde,
  onChange,
}: {
  competencia: string;
  atual: string;
  desde: string;
  onChange: (competencia: string) => void;
}) {
  const podeVoltar = competencia > desde;
  const podeAvancar = competencia < atual;
  const ehAtual = competencia === atual;
  const botao =
    "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] text-text-light transition-[background-color,color,scale] duration-150 hover:bg-bg-subtle hover:text-text active:scale-[0.96] disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-border bg-bg-card p-1.5">
      <button
        type="button"
        className={botao}
        disabled={!podeVoltar}
        onClick={() => onChange(somarMeses(competencia, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="min-w-0 flex-1 text-center" aria-live="polite">
        <p className="truncate text-base font-bold text-text">{rotuloCompetencia(competencia)}</p>
        <p className="truncate text-xs text-text-light">
          {ehAtual ? "Mês em andamento · recomeça no dia 1º" : "Mês encerrado"}
          {!ehAtual && competencia < somarMeses(atual, -1) ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => onChange(atual)}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                ir para o mês atual
              </button>
            </>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        className={botao}
        disabled={!podeAvancar}
        onClick={() => onChange(somarMeses(competencia, 1))}
        aria-label="Próximo mês"
      >
        <ChevronRight className="size-5" />
      </button>
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
  // O mês corrente é a visão padrão: é o que o atleta acompanha no dia a dia.
  const [periodo, setPeriodo] = useState<RankingPeriodKey>("mes");
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

  const mesesDesde = periods?.mesesDesde;
  const mesDisponivel = Boolean(periods?.geracaoPublicada) && Boolean(mesesDesde);
  const periodoEfetivo: RankingPeriodKey =
    periodo === "mes" && mesDisponivel
      ? "mes"
      : periodo === "trimestre" && periods?.trimestre.ativo
        ? "trimestre"
        : "geral";
  const competenciaAtual = competenciaAtualBrasil();
  // Sempre abre no mês atual; o navegador troca o mês.
  const [competenciaEscolhida, setCompetenciaEscolhida] = useState(competenciaAtual);
  const competencia =
    mesesDesde && competenciaEscolhida < mesesDesde
      ? mesesDesde
      : competenciaEscolhida > competenciaAtual
        ? competenciaAtual
        : competenciaEscolhida;
  const nomeMes = MESES[Number(competencia.slice(5, 7)) - 1];
  const ehMesAtual = competencia === competenciaAtual;
  const possuiResultadosPublicados = Boolean(periods?.geracaoPublicada);
  const corridaOculta =
    !isStaff && visibility ? rankingOcultoAgora(visibility, "corrida") : false;
  const bicicletaOculta =
    !isStaff && visibility ? rankingOcultoAgora(visibility, "bicicleta") : false;
  const rankingDesativado = !isStaff && visibility?.exibirParaAtletas === false;
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
      rankingDesativado ||
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
      ...(periodoEfetivo === "mes" ? [where("competencia", "==", competencia)] : []),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setResultados(
          snap.docs
            .map((item) => item.data() as RankingResultadoDoc)
            .filter(perfilAtletaVisivel),
        );
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
    competencia,
    periods?.geracaoPublicada,
    possuiResultadosPublicados,
    rankingDesativado,
    rankingOcultoAtual,
    visibility,
  ]);

  useEffect(() => {
    if (
      possuiResultadosPublicados ||
      periods === undefined ||
      !athleteDirectory ||
      !podeConsultar ||
      rankingDesativado ||
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
        setLegacy(
          snap.docs
            .map((item) => ({ id: item.id, ...item.data() }) as AtletaPublicoDoc)
            .filter(perfilAtletaVisivel),
        );
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
    rankingDesativado,
    rankingOcultoAtual,
    visibility,
  ]);

  const atletasAtuais = useMemo<RankingEntry[] | null>(() => {
    const lista: RankingEntry[] | null = possuiResultadosPublicados ? resultados : legacy;
    if (!lista) return null;
    return [...lista].sort(
      (a, b) =>
        b.pontuacaoTotal - a.pontuacaoTotal ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [legacy, possuiResultadosPublicados, resultados]);

  const atletasComRank = useMemo<RankedAtleta[] | null>(() => {
    if (!atletasAtuais) return null;
    const posicoes = calcularPosicoesRanking(
      atletasAtuais.map((atleta) => atleta.pontuacaoTotal),
    );
    return atletasAtuais.map((atleta, index) => ({ ...atleta, rank: posicoes[index] }));
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

  // Quem não pontuou não sobe ao pódio (no começo do mês, quase todos estão zerados).
  const comPontos = atletasComRank?.filter((atleta) => atleta.pontuacaoTotal > 0) ?? [];
  const ninguemPontuouNoMes =
    periodoEfetivo === "mes" && (atletasComRank?.every((atleta) => atleta.pontuacaoTotal <= 0) ?? false);
  const myRankAtleta = atletasComRank?.find((atleta) => atleta.id === myAtleta.id);
  const trimestreDisponivel =
    Boolean(periods?.geracaoPublicada) && periods?.trimestre.ativo === true;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Ranking"
        subtitle={
          (isStaff
            ? "Classificação publicada por período e modalidade."
            : "Classificação publicada da sua modalidade.") +
          // O ranking é um retrato publicado (atualizado a cada lançamento); dizer
          // quando foi evita a impressão de número "errado" frente ao Desempenho.
          (possuiResultadosPublicados && periods?.rankingAtualizadoEm
            ? ` Atualizado ${formatRelativeTime(periods.rankingAtualizadoEm)}.`
            : "")
        }
        icon={Trophy}
        badge={<SportBadge modalidade={modalidade} size="md" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {mesDisponivel || trimestreDisponivel ? (
              <SegmentedControl
                value={periodoEfetivo}
                onChange={(value) => {
                  setPeriodo(value as RankingPeriodKey);
                  setResultados(null);
                  setSearch("");
                }}
                options={[
                  ...(mesDisponivel ? [{ value: "mes", label: "Mensal" }] : []),
                  { value: "geral", label: "Geral" },
                  ...(trimestreDisponivel
                    ? [{ value: "trimestre", label: periods?.trimestre.nome ?? "Trimestre" }]
                    : []),
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
                  { value: "bicicleta", label: modalidadeLabel.bicicleta },
                ]}
              />
            ) : null}
          </div>
        }
      />

      {periodoEfetivo === "mes" && mesesDesde ? (
        <NavegadorMes
          competencia={competencia}
          atual={competenciaAtual}
          desde={mesesDesde}
          onChange={(novo) => {
            setCompetenciaEscolhida(novo);
            setResultados(null);
            setSearch("");
          }}
        />
      ) : null}

      {periodoEfetivo === "trimestre" && periods?.trimestre.ativo ? (
        <div className="rounded-[var(--radius)] border border-border bg-bg-card px-4 py-3 text-sm text-text-light">
          <strong className="text-text">{periods.trimestre.nome}</strong>
          <span className="mx-2 text-text-muted">·</span>
          {formatShortDate(periods.trimestre.inicio)} a {formatShortDate(periods.trimestre.fim)}
        </div>
      ) : null}

      {rankingDesativado ? (
        <Card>
          <EmptyState
            icon={EyeOff}
            title="Ranking indisponível"
            description="A consulta ao ranking está temporariamente desativada pelo administrador."
          />
        </Card>
      ) : !isStaff && !athleteModality ? (
        <EmptyState
          icon={Trophy}
          title="Modalidade não definida"
          description="Seu cadastro ainda não está vinculado a uma modalidade de corrida ou bike."
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
      ) : ninguemPontuouNoMes ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title={`Ninguém pontuou em ${nomeMes.toLowerCase()}${ehMesAtual ? " ainda" : ""}`}
            description={
              ehMesAtual
                ? "O ranking do mês aparece assim que os primeiros treinos forem lançados."
                : "Não há pontos lançados para este mês."
            }
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setPeriodo("geral");
                  setResultados(null);
                }}
              >
                Ver ranking geral
              </Button>
            }
          />
        </Card>
      ) : atletasAtuais.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Sem ranking publicado"
          description="A gestão ainda não publicou resultados para este período."
        />
      ) : (
        <div className="flex flex-col">
          {myRankAtleta ? (
            <div className="mb-3 flex items-center gap-3 rounded-[var(--radius-lg)] border border-primary/20 bg-primary-subtle p-3 sm:p-4">
              <RankingPosition
                position={myRankAtleta.rank}
                size="md"
                className="shrink-0 bg-bg-card text-primary shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  Sua posição
                </p>
                <p className="truncate text-sm font-bold text-text sm:text-base">
                  {myRankAtleta.rank}º lugar no ranking
                </p>
              </div>
              {/* Treinos e km só existem no ranking publicado; sem ele, mostrar "0"
                  contradizia a tela Desempenho. */}
              <div
                className={cn(
                  "grid shrink-0 gap-3 text-center",
                  myRankAtleta.treinos !== undefined ? "grid-cols-3" : "grid-cols-1",
                )}
              >
                <div>
                  <strong className="block text-sm tabular-nums text-text">
                    {formatPontos(myRankAtleta.pontuacaoTotal)}
                  </strong>
                  <span className="text-xs text-text-muted">pontos</span>
                </div>
                {myRankAtleta.treinos !== undefined ? (
                  <>
                    <div>
                      <strong className="block text-sm tabular-nums text-text">
                        {myRankAtleta.treinos}
                      </strong>
                      <span className="text-xs text-text-muted">
                        {myRankAtleta.treinos === 1 ? "treino" : "treinos"}
                      </span>
                    </div>
                    <div>
                      <strong className="block text-sm tabular-nums text-text">
                        {formatDistancia(myRankAtleta.km ?? 0)}
                      </strong>
                      <span className="text-xs text-text-muted">km</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : periodoEfetivo === "mes" && !isStaff ? (
            <p className="mb-3 rounded-[var(--radius-lg)] border border-dashed border-border px-4 py-3 text-sm text-text-light">
              Você não pontuou em {nomeMes.toLowerCase()}
              {ehMesAtual ? " ainda. Seus treinos lançados neste mês entram aqui." : "."}
            </p>
          ) : null}

          {!search.trim() ? <Podium atletas={comPontos} /> : null}

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
                  className="block w-full rounded-[var(--radius)] border border-border bg-bg py-2.5 pl-9 pr-3 text-base text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/50 sm:text-sm"
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
              <>
                <div className="hidden items-center border-b border-border bg-bg/50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted sm:flex">
                  <span className="flex-1 pl-11">Atleta</span>
                  <div className="grid w-[280px] shrink-0 grid-cols-3 text-center">
                    <span>Treinos</span>
                    <span>Km</span>
                    <span>Pontos</span>
                  </div>
                </div>
                <ul className="flex flex-col divide-y divide-border">
                  {filteredAtletas?.map((atleta) => {
                    const isMe = atleta.id === myAtleta.id;
                    const isTop3 = atleta.rank <= 3;
                    return (
                      <li
                        key={atleta.id}
                        aria-current={isMe ? "true" : undefined}
                        className={cn(
                          "flex items-center gap-3 border-l-4 px-3 py-3 transition-colors hover:bg-bg-inset sm:gap-4 sm:px-5 sm:py-4",
                          isMe
                            ? "border-l-primary bg-[var(--color-primary-subtle)]"
                            : "border-l-transparent",
                        )}
                      >
                        <RankingPosition
                          position={atleta.rank}
                          size={isTop3 ? "md" : "sm"}
                          className={cn("shrink-0", !isTop3 && "bg-bg text-text-muted")}
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
                          {atleta.treinos !== undefined ? (
                            <span className="block truncate text-xs text-text-light sm:hidden">
                              {plural(atleta.treinos, "treino")} · {formatKm(atleta.km ?? 0)}
                            </span>
                          ) : null}
                        </div>
                        <div
                          className="hidden w-[280px] shrink-0 grid-cols-3 text-center sm:grid"
                          aria-label={`Desempenho de ${atleta.nome}`}
                        >
                          <strong className="text-sm tabular-nums text-text">{atleta.treinos ?? "—"}</strong>
                          <strong className="text-sm tabular-nums text-text">
                            {atleta.km === undefined ? "—" : formatDistancia(atleta.km)}
                          </strong>
                          <strong className="text-base tabular-nums text-text">
                            {formatPontos(atleta.pontuacaoTotal)}
                          </strong>
                        </div>
                        <strong className="shrink-0 text-right text-base tabular-nums text-text sm:hidden">
                          {formatPontos(atleta.pontuacaoTotal)}
                          <span className="ml-0.5 text-xs font-medium text-text-muted">pts</span>
                        </strong>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

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
