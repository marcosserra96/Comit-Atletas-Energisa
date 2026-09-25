"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Footprints,
  Gauge,
  Map,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { formatDataTreino } from "@/lib/format";
import {
  calcularDesempenhoAtleta,
  obterInicioPeriodo,
  type AnaliseDesempenho,
  type PeriodoDesempenho,
  type SerieMensalDesempenho,
} from "@/lib/athletePerformance";
import type { HistoricoPontoDoc, TipoLancamento } from "@/lib/types";

const tipoLabel: Record<TipoLancamento, string> = {
  treino: "Treino",
  evento: "Evento",
  avulso: "Avulso",
  importacao: "Importação",
};

type MetricaVolume = "km" | "pontos";
type FiltroTipo = "todos" | TipoLancamento;
type KpiDetalhe = "treinos" | "km" | "pontos" | "mediaMensal" | "mediaTreino" | "melhorMes";

function formatarNumero(valor: number, casas = 0) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);
}

function nomeMesCapitalizado(valor: string) {
  return valor.charAt(0).toUpperCase() + valor.slice(1);
}

function GraficoMensal({
  serie,
  campo,
  cor,
  formatarValor,
  vazio,
}: {
  serie: SerieMensalDesempenho[];
  campo: "treinos" | "km" | "pontos";
  cor: string;
  formatarValor: (valor: number) => string;
  vazio: string;
}) {
  const valores = serie.map((item) => item[campo]);
  const maximo = Math.max(0, ...valores);

  if (maximo <= 0) {
    return (
      <div className="flex min-h-56 items-center justify-center">
        <EmptyState icon={BarChart3} title="Ainda sem dados no período" description={vazio} />
      </div>
    );
  }

  return (
    <div className="min-w-0 pb-2">
      <div
        className="grid h-64 items-end gap-1 pt-8 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${serie.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label="Gráfico mensal de desempenho"
      >
        {serie.map((item) => {
          const valor = item[campo];
          const altura = valor > 0 ? Math.max(5, (valor / maximo) * 100) : 0;
          return (
            <div key={item.chave} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
              <span className="h-5 max-w-full truncate text-[10px] font-bold text-text sm:text-xs">
                {valor > 0 ? formatarValor(valor) : ""}
              </span>
              <div className="flex w-full flex-1 items-end justify-center rounded-t-lg bg-bg-inset/60 px-1">
                <div
                  className="w-full max-w-11 rounded-t-[var(--radius)] transition-[height] duration-500"
                  style={{
                    height: valor > 0 ? altura + "%" : "3px",
                    backgroundColor: valor > 0 ? cor : "var(--color-border)",
                  }}
                  title={item.rotulo + ": " + formatarValor(valor)}
                />
              </div>
              <span className="max-w-full truncate text-[10px] font-semibold uppercase text-text-muted sm:text-[11px]" title={item.rotulo}>
                <span className="sm:hidden">{item.rotuloCurto.slice(0, 3)}</span>
                <span className="hidden sm:inline">{item.rotuloCurto}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarraCriterio({
  regra,
  pontos,
  maximo,
}: {
  regra: string;
  pontos: number;
  maximo: number;
}) {
  const largura = maximo > 0 ? Math.max(4, (Math.abs(pontos) / maximo) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-4 text-sm">
        <span className="min-w-0 truncate font-medium text-text" title={regra}>
          {regra}
        </span>
        <span className={pontos < 0 ? "shrink-0 font-bold text-danger" : "shrink-0 font-bold text-success"}>
          {pontos > 0 ? "+" : ""}
          {pontos} pts
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-inset">
        <div
          className="h-full rounded-full"
          style={{
            width: largura + "%",
            backgroundColor: pontos < 0 ? "var(--color-danger)" : "var(--color-primary)",
          }}
        />
      </div>
    </div>
  );
}

function textoComparacao(analise: AnaliseDesempenho) {
  if (analise.treinosMesAtual === 0 && analise.treinosMesAnterior === 0) {
    return "Ainda não há treinos registrados neste mês nem no anterior.";
  }
  if (analise.treinosMesAnterior === 0) {
    return "Você já registrou " + analise.treinosMesAtual + " treino(s) neste mês.";
  }
  const diferenca = analise.treinosMesAtual - analise.treinosMesAnterior;
  if (diferenca === 0) {
    return "Você está com o mesmo número de treinos do mês anterior.";
  }
  return (
    "Você tem " +
    Math.abs(diferenca) +
    (diferenca > 0 ? " treino(s) a mais" : " treino(s) a menos") +
    " que no mês anterior."
  );
}

function periodoLabel(periodo: PeriodoDesempenho) {
  if (periodo === "6m") return "Últimos 6 meses";
  if (periodo === "12m") return "Últimos 12 meses";
  return "Este ano";
}

function KpiDetalheModal({
  detalhe,
  analise,
  periodo,
  onClose,
  onAbrirHistorico,
}: {
  detalhe: KpiDetalhe | null;
  analise: AnaliseDesempenho;
  periodo: PeriodoDesempenho;
  onClose: () => void;
  onAbrirHistorico: () => void;
}) {
  const maiorCriterio = analise.pontosPorRegra[0];
  const configuracao = detalhe ? {
    treinos: {
      titulo: "Treinos no período",
      descricao: "Cada treino é contado uma única vez, mesmo quando possui mais de um critério de pontuação.",
      itens: [
        ["Total", `${analise.totalTreinos} treino(s)`],
        ["Mês atual", `${analise.treinosMesAtual} treino(s)`],
        ["Mês anterior", `${analise.treinosMesAnterior} treino(s)`],
        ["Dias ativos", String(analise.diasAtivos)],
      ],
    },
    km: {
      titulo: "Quilômetros registrados",
      descricao: "Soma dos quilômetros consolidados por participação, sem duplicar atividades com vários critérios.",
      itens: [
        ["Total", `${formatarNumero(analise.totalKm, 1)} km`],
        ["Somente treinos", `${formatarNumero(analise.kmTreinos, 1)} km`],
        ["Participações", String(analise.totalParticipacoes)],
        ["Média por treino", `${formatarNumero(analise.mediaKmTreino, 1)} km`],
      ],
    },
    pontos: {
      titulo: "Pontos conquistados",
      descricao: "Resultado líquido dos lançamentos válidos. Registros estornados não entram no cálculo.",
      itens: [
        ["Total", `${formatarNumero(analise.totalPontos)} pts`],
        ["Critérios pontuados", String(analise.pontosPorRegra.length)],
        ["Maior impacto", maiorCriterio?.regra ?? "Sem pontuação"],
        ["Valor do impacto", maiorCriterio ? `${maiorCriterio.pontos > 0 ? "+" : ""}${maiorCriterio.pontos} pts` : "—"],
      ],
    },
    mediaMensal: {
      titulo: "Média mensal de treinos",
      descricao: "Média calculada considerando todos os meses exibidos, inclusive aqueles sem treino registrado.",
      itens: [
        ["Média", `${formatarNumero(analise.mediaTreinosMes, 1)} treino(s)`],
        ["Meses analisados", String(analise.serieMensal.length)],
        ["Meses ativos", String(analise.mesesAtivos)],
        ["Total de treinos", String(analise.totalTreinos)],
      ],
    },
    mediaTreino: {
      titulo: "Média de quilômetros por treino",
      descricao: "Divide os quilômetros de treino pelo total de treinos, incluindo treinos cadastrados sem quilometragem.",
      itens: [
        ["Média", `${formatarNumero(analise.mediaKmTreino, 1)} km`],
        ["KM de treinos", `${formatarNumero(analise.kmTreinos, 1)} km`],
        ["Total de treinos", String(analise.totalTreinos)],
        ["Todas as participações", String(analise.totalParticipacoes)],
      ],
    },
    melhorMes: {
      titulo: "Mês mais ativo",
      descricao: "O mês com mais treinos no período. Em caso de empate, vence o mês com mais pontos.",
      itens: [
        ["Mês", analise.melhorMes ? nomeMesCapitalizado(analise.melhorMes.rotulo) : "Sem treinos"],
        ["Treinos", String(analise.melhorMes?.treinos ?? 0)],
        ["Quilômetros", `${formatarNumero(analise.melhorMes?.km ?? 0, 1)} km`],
        ["Pontos", `${formatarNumero(analise.melhorMes?.pontos ?? 0)} pts`],
      ],
    },
  }[detalhe] : null;

  return (
    <Modal
      open={Boolean(detalhe)}
      onClose={onClose}
      title={configuracao?.titulo ?? "Detalhes do indicador"}
      description={periodoLabel(periodo)}
      size="md"
      mobileSheet
    >
      {configuracao ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm leading-relaxed text-text-light">{configuracao.descricao}</p>
          <div className="grid grid-cols-2 gap-3">
            {configuracao.itens.map(([rotulo, valor]) => (
              <div key={rotulo} className="min-w-0 rounded-[var(--radius)] bg-bg-inset p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{rotulo}</p>
                <p className="mt-1 break-words text-sm font-bold text-text">{valor}</p>
              </div>
            ))}
          </div>
          <Button variant="secondary" className="w-full justify-center" onClick={onAbrirHistorico}>
            Ver lançamentos do período
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}

function LancamentoDetalheModal({
  lancamento,
  onClose,
}: {
  lancamento: HistoricoPontoDoc | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(lancamento)}
      onClose={onClose}
      title={lancamento?.regraDesc ?? "Detalhes do lançamento"}
      description={lancamento ? formatDataTreino(lancamento.dataTreino, lancamento.dataAproximada) : undefined}
      size="md"
      mobileSheet
    >
      {lancamento ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-lg)] bg-bg-inset p-4">
            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">Tipo</p>
              <p className="mt-1 text-sm font-bold text-text">{tipoLabel[lancamento.tipoLancamento]}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">Pontos</p>
              <p className={lancamento.pontos < 0 ? "mt-1 text-sm font-bold text-danger" : "mt-1 text-sm font-bold text-success"}>
                {lancamento.pontos > 0 ? "+" : ""}{lancamento.pontos} pts
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">Quilômetros</p>
              <p className="mt-1 text-sm font-bold text-text">
                {lancamento.kmPercorrido ? `${formatarNumero(lancamento.kmPercorrido, 1)} km` : "Não informado"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">Situação</p>
              <p className="mt-1 text-sm font-bold text-text">{lancamento.estornado ? "Estornado" : "Válido"}</p>
            </div>
          </div>
          {lancamento.descricaoLote ? (
            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">Atividade</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text">{lancamento.descricaoLote}</p>
            </div>
          ) : null}
          {lancamento.observacao ? (
            <div>
              <p className="text-xs font-semibold uppercase text-text-muted">Observação</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-light">{lancamento.observacao}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

export default function DesempenhoPage() {
  const { atleta } = useAthleteView();
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoDesempenho>("6m");
  const [metricaVolume, setMetricaVolume] = useState<MetricaVolume>("km");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [mostrarAnalisesExtras, setMostrarAnalisesExtras] = useState(false);
  const [kpiDetalhe, setKpiDetalhe] = useState<KpiDetalhe | null>(null);
  const [lancamentoDetalhe, setLancamentoDetalhe] = useState<HistoricoPontoDoc | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "historico_pontos"), where("atletaId", "==", atleta.id)),
      (snap) => {
        setLancamentos(
          snap.docs.map((documento) => ({
            id: documento.id,
            ...documento.data(),
          })) as HistoricoPontoDoc[],
        );
        setErroCarregamento(false);
      },
      () => {
        setLancamentos([]);
        setErroCarregamento(true);
      },
    );
    return unsubscribe;
  }, [atleta.id]);

  const analise = useMemo(
    () => (lancamentos ? calcularDesempenhoAtleta({ lancamentos, periodo }) : null),
    [lancamentos, periodo],
  );

  const historicoFiltrado = useMemo(() => {
    if (!lancamentos) return [];
    const inicio = obterInicioPeriodo(periodo);
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    return [...lancamentos]
      .filter((item) => item.dataTreino >= inicio)
      .filter((item) => filtroTipo === "todos" || item.tipoLancamento === filtroTipo)
      .filter((item) => {
        if (!termo) return true;
        return [item.regraDesc, item.descricaoLote, item.observacao, tipoLabel[item.tipoLancamento]]
          .filter(Boolean)
          .some((valor) => String(valor).toLocaleLowerCase("pt-BR").includes(termo));
      })
      .sort((a, b) => b.dataTreino.localeCompare(a.dataTreino));
  }, [busca, filtroTipo, lancamentos, periodo]);

  const criteriosPrincipais = analise?.pontosPorRegra.slice(0, 6) ?? [];
  const maximoCriterio = Math.max(0, ...criteriosPrincipais.map((item) => Math.abs(item.pontos)));

  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        icon={Activity}
        title="Meu desempenho"
        description="Acompanhe sua frequência, volume e evolução no programa."
        actions={
          <SegmentedControl
            value={periodo}
            onChange={setPeriodo}
            options={[
              { value: "6m", label: "6 meses" },
              { value: "12m", label: "12 meses" },
              { value: "ano", label: "Este ano" },
            ]}
            className="w-full max-w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:px-2 sm:w-fit sm:[&>button]:flex-none sm:[&>button]:px-3.5"
          />
        }
      />

      {erroCarregamento ? (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger">
            <AlertCircle className="size-6" />
          </span>
          <div>
            <h2 className="font-bold text-text">Não foi possível carregar seu desempenho</h2>
            <p className="mt-1 text-sm text-text-light">Confira sua conexão e tente novamente.</p>
          </div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </Card>
      ) : lancamentos === null || analise === null ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, indice) => (
              <SkeletonCard key={indice} className="h-28" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-5">
            <SkeletonCard className="h-80 lg:col-span-3" />
            <SkeletonCard className="h-80 lg:col-span-2" />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Treinos"
              value={analise.totalTreinos}
              icon={Footprints}
              iconColor="var(--color-secondary)"
              trend={
                analise.variacaoTreinosPct === null
                  ? undefined
                  : { value: analise.variacaoTreinosPct, label: "vs mês anterior" }
              }
              subtitle={
                analise.variacaoTreinosPct === null
                  ? analise.treinosMesAnterior + " no mês anterior"
                  : undefined
              }
              onClick={() => setKpiDetalhe("treinos")}
            />
            <MetricCard
              label="KM registrados"
              value={formatarNumero(analise.totalKm, 1)}
              icon={Map}
              iconColor="var(--color-primary)"
              subtitle={analise.totalParticipacoes + " participações"}
              onClick={() => setKpiDetalhe("km")}
            />
            <MetricCard
              label="Pontos"
              value={formatarNumero(analise.totalPontos)}
              icon={Trophy}
              iconColor="var(--color-accent)"
              subtitle="no período selecionado"
              onClick={() => setKpiDetalhe("pontos")}
            />
            <div className={mostrarAnalisesExtras ? "contents" : "hidden sm:contents"}>
              <MetricCard
              label="Média mensal"
              value={formatarNumero(analise.mediaTreinosMes, 1)}
              icon={Gauge}
              subtitle="treinos por mês"
              onClick={() => setKpiDetalhe("mediaMensal")}
            />
            <MetricCard
              label="Média por treino"
              value={formatarNumero(analise.mediaKmTreino, 1) + " km"}
              icon={Target}
              subtitle="considerando treinos com e sem KM"
              onClick={() => setKpiDetalhe("mediaTreino")}
            />
              <MetricCard
                label="Mês mais ativo"
                value={analise.melhorMes ? analise.melhorMes.rotuloCurto : "—"}
                icon={CalendarDays}
                subtitle={
                  analise.melhorMes
                    ? analise.melhorMes.treinos + " treino(s)"
                    : "sem treinos no período"
                }
                onClick={() => setKpiDetalhe("melhorMes")}
              />
            </div>
          </div>

          <Button
            variant="secondary"
            className="w-full justify-center sm:hidden"
            onClick={() => setMostrarAnalisesExtras((valor) => !valor)}
            aria-expanded={mostrarAnalisesExtras}
          >
            {mostrarAnalisesExtras ? (
              <>
                Mostrar menos
                <ChevronUp className="size-4" />
              </>
            ) : (
              <>
                Ver mais análises
                <ChevronDown className="size-4" />
              </>
            )}
          </Button>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <SectionHeader
                title="Treinos por mês"
                icon={BarChart3}
                action={
                  <Badge tone="neutral">
                    {analise.totalTreinos} no período
                  </Badge>
                }
              />
              <p className="mt-1 text-sm text-text-light">
                Cada treino conta apenas uma vez, mesmo quando gera mais de uma pontuação.
              </p>
              <GraficoMensal
                serie={analise.serieMensal}
                campo="treinos"
                cor="var(--color-secondary)"
                formatarValor={(valor) => String(valor)}
                vazio="Os treinos registrados pelo comitê aparecerão aqui."
              />
            </Card>

            <Card className={(mostrarAnalisesExtras ? "flex" : "hidden sm:flex") + " flex-col lg:col-span-2"}>
              <SectionHeader title="Consistência" icon={Sparkles} />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[var(--radius)] bg-bg-inset p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Dias ativos</p>
                  <p className="mt-1 text-2xl font-extrabold text-text">{analise.diasAtivos}</p>
                </div>
                <div className="rounded-[var(--radius)] bg-bg-inset p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Semanas ativas</p>
                  <p className="mt-1 text-2xl font-extrabold text-text">{analise.semanasAtivas}</p>
                </div>
                <div className="rounded-[var(--radius)] bg-bg-inset p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Meses ativos</p>
                  <p className="mt-1 text-2xl font-extrabold text-text">
                    {analise.mesesAtivos}/{analise.serieMensal.length}
                  </p>
                </div>
                <div className="rounded-[var(--radius)] bg-bg-inset p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Regularidade</p>
                  <p className="mt-1 text-2xl font-extrabold text-text">{analise.regularidadePct}%</p>
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs font-semibold text-text-light">
                  <span>Semanas com treino</span>
                  <span>
                    {analise.semanasAtivas} de {analise.totalSemanasPeriodo}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-bg-inset">
                  <div
                    className="h-full rounded-full bg-secondary transition-[width] duration-500"
                    style={{ width: analise.regularidadePct + "%" }}
                  />
                </div>
              </div>
              <div className="mt-auto rounded-[var(--radius)] border border-primary/15 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-text">{textoComparacao(analise)}</p>
                {analise.melhorMes && (
                  <p className="mt-1 text-xs text-text-light">
                    Seu mês mais ativo foi {nomeMesCapitalizado(analise.melhorMes.rotulo)}.
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div className={(mostrarAnalisesExtras ? "grid" : "hidden sm:grid") + " gap-6 lg:grid-cols-2"}>
            <Card>
              <SectionHeader
                title="Volume mensal"
                icon={Activity}
                action={
                  <SegmentedControl
                    value={metricaVolume}
                    onChange={setMetricaVolume}
                    options={[
                      { value: "km", label: "KM" },
                      { value: "pontos", label: "Pontos" },
                    ]}
                  />
                }
              />
              <p className="mt-1 text-sm text-text-light">
                {metricaVolume === "km"
                  ? "Quilômetros consolidados por participação."
                  : "Pontos conquistados em cada mês."}
              </p>
              <GraficoMensal
                serie={analise.serieMensal}
                campo={metricaVolume}
                cor={
                  metricaVolume === "km"
                    ? "var(--color-primary)"
                    : "var(--color-accent)"
                }
                formatarValor={(valor) =>
                  metricaVolume === "km" ? formatarNumero(valor, 1) : formatarNumero(valor)
                }
                vazio={
                  metricaVolume === "km"
                    ? "Nenhum quilômetro foi informado no período."
                    : "Nenhuma pontuação foi registrada no período."
                }
              />
            </Card>

            <Card>
              <SectionHeader title="Pontos por critério" icon={Trophy} />
              <p className="mt-1 text-sm text-text-light">
                Atividades que mais contribuíram para sua pontuação.
              </p>
              {criteriosPrincipais.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center">
                  <EmptyState
                    icon={Trophy}
                    title="Sem pontuação no período"
                    description="Os critérios pontuados aparecerão aqui."
                  />
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-5">
                  {criteriosPrincipais.map((item) => (
                    <BarraCriterio
                      key={item.regra}
                      regra={item.regra}
                      pontos={item.pontos}
                      maximo={maximoCriterio}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card id="historico" className="scroll-mt-24 overflow-hidden p-0">
            <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-text">Histórico detalhado</h2>
                <p className="mt-1 text-sm text-text-light">
                  {historicoFiltrado.length} lançamento(s) no filtro atual.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px]">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-text-light">Buscar</span>
                  <span className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                    <input
                      value={busca}
                      onChange={(evento) => setBusca(evento.target.value)}
                      placeholder="Regra ou atividade"
                      className="h-11 w-full rounded-[var(--radius)] border border-border bg-bg-card pl-9 pr-3 text-base text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
                    />
                  </span>
                </label>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-light">Tipo</label>
                  <Select
                    value={filtroTipo}
                    onChange={(evento) => setFiltroTipo(evento.target.value as FiltroTipo)}
                  >
                    <option value="todos">Todos</option>
                    <option value="treino">Treinos</option>
                    <option value="evento">Eventos</option>
                    <option value="avulso">Avulsos</option>
                    <option value="importacao">Importações</option>
                  </Select>
                </div>
              </div>
            </div>

            {historicoFiltrado.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CalendarCheck}
                  title="Nenhum lançamento encontrado"
                  description="Altere o período, o tipo ou o texto pesquisado."
                />
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg-inset text-left text-xs uppercase text-text-muted">
                        <th className="w-[42%] px-5 py-3 font-semibold">Atividade</th>
                        <th className="w-[16%] px-3 py-3 font-semibold">Tipo</th>
                        <th className="w-[18%] px-3 py-3 font-semibold">Data</th>
                        <th className="w-[11%] px-3 py-3 text-right font-semibold">KM</th>
                        <th className="w-[13%] px-5 py-3 text-right font-semibold">Pontos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoFiltrado.map((lancamento) => (
                        <tr
                          key={lancamento.id}
                          className={
                            "cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary " +
                            (lancamento.estornado ? "opacity-60" : "")
                          }
                          tabIndex={0}
                          role="button"
                          onClick={() => setLancamentoDetalhe(lancamento)}
                          onKeyDown={(evento) => {
                            if (evento.key === "Enter" || evento.key === " ") {
                              evento.preventDefault();
                              setLancamentoDetalhe(lancamento);
                            }
                          }}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  "font-medium text-text " +
                                  (lancamento.estornado ? "line-through text-text-muted" : "")
                                }
                              >
                                {lancamento.regraDesc}
                              </span>
                              {lancamento.estornado && <Badge tone="danger">Estornado</Badge>}
                            </div>
                            {lancamento.descricaoLote && (
                              <p className="mt-0.5 text-xs text-text-muted">
                                {lancamento.descricaoLote}
                              </p>
                            )}
                            {lancamento.observacao && (
                              <p className="mt-1 max-w-md whitespace-pre-wrap text-xs text-text-light">
                                {lancamento.observacao}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-4">
                            <Badge tone="neutral">{tipoLabel[lancamento.tipoLancamento]}</Badge>
                          </td>
                          <td className="px-3 py-4 text-text-light">
                            {formatDataTreino(lancamento.dataTreino, lancamento.dataAproximada)}
                          </td>
                          <td className="px-3 py-4 text-right text-text-light">
                            {lancamento.kmPercorrido
                              ? formatarNumero(lancamento.kmPercorrido, 1)
                              : "—"}
                          </td>
                          <td className="px-5 py-4 text-right font-bold">
                            <span
                              className={
                                lancamento.estornado
                                  ? "text-text-muted line-through"
                                  : lancamento.pontos < 0
                                    ? "text-danger"
                                    : "text-success"
                              }
                            >
                              {lancamento.pontos > 0 ? "+" : ""}
                              {lancamento.pontos}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 p-4 lg:hidden">
                  {historicoFiltrado.map((lancamento) => (
                    <div
                      key={lancamento.id}
                      className={
                        "cursor-pointer rounded-[var(--radius)] border border-border bg-bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                        (lancamento.estornado ? "opacity-65" : "")
                      }
                      tabIndex={0}
                      role="button"
                      onClick={() => setLancamentoDetalhe(lancamento)}
                      onKeyDown={(evento) => {
                        if (evento.key === "Enter" || evento.key === " ") {
                          evento.preventDefault();
                          setLancamentoDetalhe(lancamento);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className={
                              "font-semibold text-text " +
                              (lancamento.estornado ? "line-through text-text-muted" : "")
                            }
                          >
                            {lancamento.regraDesc}
                          </p>
                          {lancamento.descricaoLote && (
                            <p className="mt-0.5 truncate text-xs text-text-muted">
                              {lancamento.descricaoLote}
                            </p>
                          )}
                          {lancamento.observacao && (
                            <p className="mt-1 line-clamp-2 text-xs text-text-light">
                              {lancamento.observacao}
                            </p>
                          )}
                        </div>
                        <span
                          className={
                            "shrink-0 font-bold " +
                            (lancamento.estornado
                              ? "text-text-muted line-through"
                              : lancamento.pontos < 0
                                ? "text-danger"
                                : "text-success")
                          }
                        >
                          {lancamento.pontos > 0 ? "+" : ""}
                          {lancamento.pontos} pt
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{tipoLabel[lancamento.tipoLancamento]}</Badge>
                        {lancamento.estornado && <Badge tone="danger">Estornado</Badge>}
                        {lancamento.kmPercorrido ? (
                          <Badge tone="primary">
                            {formatarNumero(lancamento.kmPercorrido, 1)} km
                          </Badge>
                        ) : null}
                        <span className="ml-auto text-xs text-text-light">
                          {formatDataTreino(lancamento.dataTreino, lancamento.dataAproximada)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </>
      )}
      </div>
      {analise ? (
        <KpiDetalheModal
          detalhe={kpiDetalhe}
          analise={analise}
          periodo={periodo}
          onClose={() => setKpiDetalhe(null)}
          onAbrirHistorico={() => {
            setKpiDetalhe(null);
            requestAnimationFrame(() => document.getElementById("historico")?.scrollIntoView({ behavior: "smooth" }));
          }}
        />
      ) : null}
      <LancamentoDetalheModal lancamento={lancamentoDetalhe} onClose={() => setLancamentoDetalhe(null)} />
    </div>
  );
}
