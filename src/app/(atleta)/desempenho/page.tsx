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
  FileSpreadsheet,
  Footprints,
  Medal,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { TrendIndicator } from "@/components/ui/TrendIndicator";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatDataTreino, formatDistancia, formatKm, formatNumero, formatPontos, plural } from "@/lib/format";
import {
  calcularDesempenhoAtleta,
  obterInicioPeriodo,
  type AnaliseDesempenho,
  type PeriodoDesempenho,
  type SerieMensalDesempenho,
} from "@/lib/athletePerformance";
import type { HistoricoMensalDoc, HistoricoPontoDoc, TipoLancamento } from "@/lib/types";

const tipoLabel: Record<TipoLancamento, string> = {
  treino: "Treino",
  evento: "Evento",
  avulso: "Avulso",
  importacao: "Importação",
};

type MetricaVolume = "km" | "pontos";
type FiltroTipo = "todos" | TipoLancamento;

function nomeMesCapitalizado(valor: string) {
  return valor.charAt(0).toUpperCase() + valor.slice(1);
}

type ItemHistoricoDados =
  | { tipo: "lancamento"; id: string; data: string; lancamento: HistoricoPontoDoc }
  | { tipo: "mensal"; id: string; data: string; resumo: HistoricoMensalDoc };

const FILTROS_TIPO: { value: FiltroTipo; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "treino", label: "Treinos" },
  { value: "evento", label: "Eventos" },
  { value: "avulso", label: "Avulsos" },
  { value: "importacao", label: "Importações" },
];

const POR_PAGINA = 15;

const iconePorTipo: Record<TipoLancamento, typeof Footprints> = {
  treino: Footprints,
  evento: Medal,
  avulso: Sparkles,
  importacao: FileSpreadsheet,
};

const formatoDiaMes = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function diaMes(data: string) {
  const d = new Date(data + "T00:00:00");
  return Number.isNaN(d.getTime()) ? "—" : formatoDiaMes.format(d).replace(".", "");
}

function ResumoNumero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-4 text-center sm:py-5">
      <dd className="text-2xl font-black tabular-nums text-text sm:text-3xl">{valor}</dd>
      <dt className="order-last text-xs font-medium text-text-light">{rotulo}</dt>
    </div>
  );
}

function ItemHistorico({ item }: { item: ItemHistoricoDados }) {
  if (item.tipo === "mensal") {
    const r = item.resumo;
    const meta = [plural(r.treinos || 0, "treino"), r.km ? formatKm(r.km) : null].filter(Boolean).join(" · ");
    return (
      <li className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 sm:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
          <CalendarDays className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">Total do mês (planilha)</p>
          <p className="truncate text-xs text-text-light">{meta}</p>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-success">+{formatPontos(r.pontos || 0)}</span>
      </li>
    );
  }
  const l = item.lancamento;
  const Icone = iconePorTipo[l.tipoLancamento] ?? Footprints;
  const meta = [
    l.dataAproximada ? formatDataTreino(l.dataTreino, true) : diaMes(l.dataTreino),
    l.kmPercorrido ? formatKm(l.kmPercorrido) : null,
    l.descricaoLote && l.descricaoLote !== l.regraDesc ? l.descricaoLote : tipoLabel[l.tipoLancamento],
  ]
    .filter(Boolean)
    .join(" · ");
  const cor = l.estornado ? "text-text-muted line-through" : l.pontos < 0 ? "text-danger" : "text-success";
  return (
    <li className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0 sm:px-5">
      <span
        className={
          "flex size-9 shrink-0 items-center justify-center rounded-full " +
          (l.estornado ? "bg-bg-subtle text-text-muted" : "bg-primary-subtle text-primary")
        }
      >
        <Icone className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={"truncate text-sm font-semibold " + (l.estornado ? "text-text-muted line-through" : "text-text")}>
          {l.regraDesc}
        </p>
        <p className="truncate text-xs text-text-light">{meta}</p>
        {l.observacao ? <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{l.observacao}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={"text-sm font-bold tabular-nums " + cor}>
          {l.pontos > 0 ? "+" : ""}
          {formatPontos(l.pontos)}
        </span>
        {l.estornado ? <span className="text-xs font-semibold text-danger">Estornado</span> : null}
      </div>
    </li>
  );
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
    <div className="overflow-x-auto pb-2">
      <div
        className="flex h-64 items-end gap-3 pt-8"
        /* Até 6 meses as barras cabem no card; acima disso o gráfico rola dentro dele. */
        style={serie.length > 6 ? { minWidth: serie.length * 56 } : undefined}
        role="img"
        aria-label="Gráfico mensal de desempenho"
      >
        {serie.map((item) => {
          const valor = item[campo];
          const altura = valor > 0 ? Math.max(5, (valor / maximo) * 100) : 0;
          return (
            <div key={item.chave} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
              <span className="h-5 text-xs font-bold text-text">
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
              <span className="text-center text-xs font-semibold uppercase leading-tight text-text-muted">
                {item.rotuloCurto}
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
          {formatPontos(pontos)} pts
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

/** "setembro de 2026" → "Setembro" (o ano aparece no filtro de período). */
function nomeDoMes(rotuloLongo: string) {
  const mes = rotuloLongo.split(" de ")[0] ?? rotuloLongo;
  return mes.charAt(0).toUpperCase() + mes.slice(1);
}

function textoComparacao(analise: AnaliseDesempenho) {
  if (analise.treinosMesAtual === 0 && analise.treinosMesAnterior === 0) {
    return "Ainda não há treinos registrados neste mês nem no anterior.";
  }
  if (analise.treinosMesAnterior === 0) {
    return `Você já registrou ${plural(analise.treinosMesAtual, "treino")} neste mês.`;
  }
  const diferenca = analise.treinosMesAtual - analise.treinosMesAnterior;
  if (diferenca === 0) {
    return "Você está com o mesmo número de treinos do mês anterior.";
  }
  return `Você tem ${plural(Math.abs(diferenca), "treino")} a ${diferenca > 0 ? "mais" : "menos"} que no mês anterior.`;
}

export default function DesempenhoPage() {
  const { atleta } = useAthleteView();
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [resumosMensais, setResumosMensais] = useState<HistoricoMensalDoc[]>([]);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoDesempenho>("6m");
  const [metricaVolume, setMetricaVolume] = useState<MetricaVolume>("km");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [mostrarAnalisesExtras, setMostrarAnalisesExtras] = useState(false);

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

  useEffect(() => {
    // Opcional: sem permissão ou sem dados, a tela segue só com os lançamentos.
    const unsubscribe = onSnapshot(
      query(collection(db, "historico_mensal"), where("atletaId", "==", atleta.id)),
      (snap) => setResumosMensais(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoMensalDoc)),
      () => setResumosMensais([]),
    );
    return unsubscribe;
  }, [atleta.id]);

  const analise = useMemo(
    () => (lancamentos ? calcularDesempenhoAtleta({ lancamentos, resumosMensais, periodo }) : null),
    [lancamentos, resumosMensais, periodo],
  );

  const historicoFiltrado = useMemo<ItemHistoricoDados[]>(() => {
    if (!lancamentos) return [];
    const inicio = obterInicioPeriodo(periodo);
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    const itens: ItemHistoricoDados[] = lancamentos
      .filter((item) => item.dataTreino >= inicio)
      .filter((item) => filtroTipo === "todos" || item.tipoLancamento === filtroTipo)
      .filter((item) => {
        if (!termo) return true;
        return [item.regraDesc, item.descricaoLote, item.observacao, tipoLabel[item.tipoLancamento]]
          .filter(Boolean)
          .some((valor) => String(valor).toLocaleLowerCase("pt-BR").includes(termo));
      })
      .map((lancamento) => ({ tipo: "lancamento", id: lancamento.id, data: lancamento.dataTreino, lancamento }));

    // Resumos mensais contam como treinos; ficam no fim do mês na lista.
    if ((filtroTipo === "todos" || filtroTipo === "treino") && (!termo || "total do mês planilha".includes(termo))) {
      for (const resumo of resumosMensais) {
        if (`${resumo.competencia}-01` < inicio.slice(0, 7) + "-01") continue;
        itens.push({ tipo: "mensal", id: `mensal-${resumo.id}`, data: `${resumo.competencia}-00`, resumo });
      }
    }

    return itens.sort((a, b) => b.data.localeCompare(a.data));
  }, [busca, filtroTipo, lancamentos, resumosMensais, periodo]);

  const gruposHistorico = useMemo(() => {
    const grupos: { chave: string; rotulo: string; pontos: number; itens: ItemHistoricoDados[] }[] = [];
    for (const item of historicoFiltrado.slice(0, limite)) {
      const chave = item.data.slice(0, 7);
      let grupo = grupos.at(-1);
      if (!grupo || grupo.chave !== chave) {
        const [ano, mes] = chave.split("-").map(Number);
        const rotulo = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(ano, mes - 1, 1));
        grupo = { chave, rotulo, pontos: 0, itens: [] };
        grupos.push(grupo);
      }
      grupo.itens.push(item);
    }
    // Total do mês considera todos os itens filtrados do mês, não só os visíveis.
    for (const grupo of grupos) {
      grupo.pontos = historicoFiltrado
        .filter((item) => item.data.startsWith(grupo.chave))
        .reduce((soma, item) => {
          if (item.tipo === "mensal") return soma + (item.resumo.pontos || 0);
          return item.lancamento.estornado ? soma : soma + item.lancamento.pontos;
        }, 0);
    }
    return grupos;
  }, [historicoFiltrado, limite]);

  const criteriosPrincipais = analise?.pontosPorRegra.slice(0, 6) ?? [];
  const maximoCriterio = Math.max(0, ...criteriosPrincipais.map((item) => Math.abs(item.pontos)));

  return (
    <div className="flex flex-col gap-6">
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
            className="max-w-full overflow-x-auto"
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
          <SkeletonCard className="h-32" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <SkeletonCard className="h-80 lg:col-span-3" />
            <SkeletonCard className="h-80 lg:col-span-2" />
          </div>
        </>
      ) : (
        <>
          <Card className="p-0">
            <dl className="grid grid-cols-3 divide-x divide-border">
              <ResumoNumero rotulo="Treinos" valor={String(analise.totalTreinos)} />
              <ResumoNumero rotulo="Km" valor={formatDistancia(analise.totalKm)} />
              <ResumoNumero rotulo="Pontos" valor={formatPontos(analise.totalPontos)} />
            </dl>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-3 text-xs text-text-light sm:px-5">
              {analise.variacaoTreinosPct !== null ? (
                <span className="flex items-center gap-1">
                  <TrendIndicator value={analise.variacaoTreinosPct} />
                  vs mês anterior
                </span>
              ) : null}
              <span>{formatNumero(analise.mediaTreinosMes)} treinos por mês</span>
              {analise.mediaKmTreino > 0 ? <span>{formatKm(analise.mediaKmTreino)} por treino</span> : null}
              {analise.melhorMes ? <span>Mês mais ativo: {nomeDoMes(analise.melhorMes.rotulo)}</span> : null}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
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

            <Button
              variant="secondary"
              className="w-full justify-center sm:hidden"
              onClick={() => setMostrarAnalisesExtras((valor) => !valor)}
              aria-expanded={mostrarAnalisesExtras}
            >
              {mostrarAnalisesExtras ? "Mostrar menos" : "Ver consistência e volume"}
              <ChevronDown
                className={"size-4 transition-transform duration-200 " + (mostrarAnalisesExtras ? "rotate-180" : "")}
              />
            </Button>

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
                  metricaVolume === "km" ? formatDistancia(valor) : formatPontos(valor)
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

          <Card id="historico" className="scroll-mt-24 p-0">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-text">Histórico</h2>
                  <p className="mt-0.5 text-sm text-text-light">
                    {plural(historicoFiltrado.length, "registro")} no período
                  </p>
                </div>
              </div>
              <label className="relative block">
                <span className="sr-only">Buscar no histórico</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={busca}
                  onChange={(evento) => {
                    setBusca(evento.target.value);
                    setLimite(POR_PAGINA);
                  }}
                  placeholder="Buscar treino, evento ou critério"
                  enterKeyHint="search"
                  className="h-11 w-full rounded-[var(--radius)] border border-border bg-bg-card pl-9 pr-3 text-base text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
                />
              </label>
              <div
                role="group"
                aria-label="Filtrar por tipo"
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0"
              >
                {FILTROS_TIPO.map((opcao) => {
                  const ativo = filtroTipo === opcao.value;
                  return (
                    <button
                      key={opcao.value}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => {
                        setFiltroTipo(opcao.value);
                        setLimite(POR_PAGINA);
                      }}
                      className={
                        "min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] pointer-coarse:min-h-10 " +
                        (ativo
                          ? "border-primary bg-primary text-on-primary"
                          : "border-border bg-bg-card text-text-light hover:border-border-strong hover:text-text")
                      }
                    >
                      {opcao.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {historicoFiltrado.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={CalendarCheck}
                  title="Nada encontrado"
                  description={
                    busca || filtroTipo !== "todos"
                      ? "Tente outro termo ou o filtro “Todos”."
                      : "Os treinos e eventos lançados pelo comitê aparecem aqui."
                  }
                />
              </div>
            ) : (
              <>
                <ol>
                  {gruposHistorico.map((grupo) => (
                    <li key={grupo.chave}>
                      <h3 className="sticky top-16 z-[1] flex items-center justify-between border-b border-border bg-bg-subtle/95 px-4 py-2 text-xs font-bold uppercase tracking-wide text-text-muted backdrop-blur sm:px-5">
                        <span>{grupo.rotulo}</span>
                        <span className="tabular-nums normal-case tracking-normal">
                          {formatPontos(grupo.pontos)} pts
                        </span>
                      </h3>
                      <ul>
                        {grupo.itens.map((item) => (
                          <ItemHistorico key={item.id} item={item} />
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
                {historicoFiltrado.length > limite ? (
                  <div className="border-t border-border p-3">
                    <Button
                      variant="ghost"
                      className="w-full justify-center"
                      onClick={() => setLimite((atual) => atual + POR_PAGINA)}
                    >
                      Mostrar mais {Math.min(POR_PAGINA, historicoFiltrado.length - limite)}
                      <ChevronDown className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
