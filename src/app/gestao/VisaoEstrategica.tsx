"use client";

import { dataIsoLocal } from "@/lib/date";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Activity, CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";
import { db } from "@/lib/firebase";
import { carregarTodosLancamentos } from "@/lib/lancamentosCache";
import { formatBRL, formatKm, formatShortDate, plural } from "@/lib/format";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { calcularEstatisticasDashboard } from "@/lib/dashboardStats";
import { aderenciaPorAtleta, mediaAderencia } from "@/lib/aderencia";
import { regrasDeTreino } from "@/lib/activityConsolidation";
import { useDiasTreino } from "@/lib/useDiasTreino";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { ExportarRelatorioDropdown } from "./ExportarRelatorioDropdown";
import { PainelAtencao, type DadosAtencao } from "./PainelAtencao";
import { ComparativoModalidades } from "./ComparativoModalidades";
import { temPermissao } from "@/lib/permissoes";
import { listarPedidosSenha, type PedidoSenha } from "@/lib/senhaComite";
import type {
  AtletaDoc,
  DespesaDoc,
  EventoDoc,
  HistoricoMensalDoc,
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
  const [historicoMensal, setHistoricoMensal] = useState<HistoricoMensalDoc[] | null>(null);
  const [despesas, setDespesas] = useState<DespesaDoc[] | null>(null);
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [regras, setRegras] = useState<RegraPontuacaoDoc[] | null>(null);
  const [pendentes, setPendentes] = useState<SolicitacaoAcessoDoc[] | null>(null);
  const [mesHover, setMesHover] = useState<number | null>(null);
  const podeAtletas = temPermissao(usuario, "atletas");
  const [pedidosSenha, setPedidosSenha] = useState<PedidoSenha[] | null>(null);
  const [versaoPedidos, setVersaoPedidos] = useState(0);

  // Pedidos de nova senha vêm do servidor: na abertura, a cada 2 min e ao fechar a lista.
  useEffect(() => {
    if (!podeAtletas) return;
    let ativo = true;
    const carregar = () =>
      listarPedidosSenha()
        .then((p) => ativo && setPedidosSenha(p))
        .catch(() => ativo && setPedidosSenha([]));
    void carregar();
    const t = setInterval(carregar, 120_000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [podeAtletas, versaoPedidos]);

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
    let ativo = true;
    Promise.all([carregarTodosLancamentos(), getDocs(collection(db, "historico_mensal"))])
      .then(([todos, snapMensal]) => {
        if (!ativo) return;
        setLancamentos(todos);
        setHistoricoMensal(
          snapMensal.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoMensalDoc),
        );
      })
      .catch(() => {
        if (!ativo) return;
        setLancamentos([]);
        setHistoricoMensal([]);
      });
    return () => {
      ativo = false;
    };
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
      (snap) =>
        setPendentes(
          snap.docs
            .map((d) => d.data() as SolicitacaoAcessoDoc)
            .sort((a, b) => Number((a.criadoEm as { seconds?: number })?.seconds ?? 0) - Number((b.criadoEm as { seconds?: number })?.seconds ?? 0)),
        ),
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

  const diasTreino = useDiasTreino();
  /** Aderência média de cada modalidade nos últimos 30 dias (mesma janela do engajamento). */
  const aderenciaModalidade = useMemo(() => {
    if (!diasTreino || !atletas || !lancamentos || !regras) return { corrida: null, bicicleta: null };
    const hoje = new Date();
    const ate = dataIsoLocal(hoje);
    const de = dataIsoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 29));
    const ativos = atletas.filter((a) => a.ativo && (a.equipe === "corrida" || a.equipe === "bicicleta"));
    const porAtleta = aderenciaPorAtleta({
      atletas: ativos,
      config: diasTreino,
      lancamentos,
      resumosMensais: historicoMensal ?? [],
      de,
      ate,
      regrasTreino: regrasDeTreino(regras),
    });
    const media = (equipe: string) =>
      mediaAderencia(ativos.filter((a) => a.equipe === equipe).map((a) => porAtleta.get(a.id)));
    return { corrida: media("corrida"), bicicleta: media("bicicleta") };
  }, [diasTreino, atletas, lancamentos, historicoMensal, regras]);

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

  const dadosAtencao: DadosAtencao = {
    solicitacoes: pendentes,
    pedidosSenha: pedidosSenha ?? [],
    atletasSemVinculo: (atletas ?? []).filter((a) => !a.authUid),
    fila: stats.filaLista,
    eventosPendentes: stats.eventosPendentesLista,
    inativos30d: [...stats.corrida.inativosList, ...stats.bike.inativosList].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    semParticipacao: stats.atletasSemAtividadeLista,
    criteriosSemUso: stats.regrasSemUsoLista,
  };

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

      {/* 1. O que precisa de ação agora — cada item abre a lista com a ação. */}
      <PainelAtencao
        carregando={carregando || pendentes === null}
        dados={dadosAtencao}
        onFechar={() => setVersaoPedidos((v) => v + 1)}
        permissoes={{
          admin: isAdmin,
          atletas: podeAtletas,
          registrar: temPermissao(usuario, "registrar"),
        }}
      />

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

      {/* 3. Corrida × Bike numa tabela só, números alinhados. */}
      <ComparativoModalidades
        corrida={stats.corrida}
        bicicleta={stats.bike}
        podioCorrida={stats.podioCorrida}
        podioBicicleta={stats.podioBike}
        aderencia={aderenciaModalidade}
      />
    </div>
  );
}

const painel =
  "rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 shadow-[var(--shadow-card)] sm:p-5";

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
