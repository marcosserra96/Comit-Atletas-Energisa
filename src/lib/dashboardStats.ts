import { ehMembroDoElenco } from "@/lib/labels";
import type {
  AtletaDoc,
  DespesaDoc,
  EventoDoc,
  HistoricoPontoDoc,
  Modalidade,
  RegraPontuacaoDoc,
} from "@/lib/types";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface ModalidadeStats {
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

export interface EstatisticasDashboard {
  ativosCount: number;
  ativosRecentesCount: number;
  engajamento30d: number;
  participacoesTotal: number;
  kmTotal: number;
  investimentoTotal: number;
  custoPorAtleta: number;
  custoParticipacao: number;
  custoKm: number;
  bike: ModalidadeStats;
  corrida: ModalidadeStats;
  podioBike: AtletaDoc[];
  podioCorrida: AtletaDoc[];
  filaAguardando: number;
  seriesMensal: { label: string; count: number }[];
  /** Atletas ativos que nunca tiveram nenhuma participação registrada. */
  atletasSemAtividade: number;
  /** Eventos que já ocorreram (últimos 7 dias) e ainda não tiveram pontos lançados. */
  eventosPendentesLancamento: number;
  /** Critérios de pontuação nunca usados em nenhum lançamento. */
  regrasSemUso: number;
  modalidadeMaisKm: "Bicicleta" | "Corrida" | "—";
  analisesExecutivas: string[];
}

export function calcularEstatisticasDashboard(params: {
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
  despesas: DespesaDoc[];
  eventos: EventoDoc[];
  regras: RegraPontuacaoDoc[];
}): EstatisticasDashboard {
  const { atletas, lancamentos, despesas, eventos, regras } = params;
  const hoje = new Date();
  const ha30dias = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  const iso30 = ha30dias.toISOString().slice(0, 10);

  const atletasProgram = atletas.filter((a) => ehMembroDoElenco(a.equipe));
  // Atleta na fila de espera ainda não entrou no programa — não conta como
  // ativo em nenhuma estatística (engajamento, pódio, ranking, etc.), mesmo
  // que o campo "ativo" esteja com valor incorreto para ele.
  const ativos = atletasProgram.filter((a) => a.ativo && a.equipe !== "fila_bicicleta" && a.equipe !== "fila_corrida");

  const validos = lancamentos.filter((l) => !l.estornado);
  const lotesPorAtleta = new Map<string, Set<string>>();
  const kmPorAtleta = new Map<string, number>();
  const pontosPorAtleta = new Map<string, number>();
  const ultimoPorAtleta = new Map<string, string>();
  const regrasUsadas = new Set<string>();

  for (const l of validos) {
    regrasUsadas.add(l.regraId);
    const lotes = lotesPorAtleta.get(l.atletaId) ?? new Set<string>();
    if (!lotes.has(l.loteId)) {
      lotes.add(l.loteId);
      kmPorAtleta.set(l.atletaId, (kmPorAtleta.get(l.atletaId) ?? 0) + (l.kmPercorrido ?? 0));
      pontosPorAtleta.set(l.atletaId, (pontosPorAtleta.get(l.atletaId) ?? 0) + l.pontos);
    }
    lotesPorAtleta.set(l.atletaId, lotes);
    const atual = ultimoPorAtleta.get(l.atletaId);
    if (!atual || l.dataTreino > atual) ultimoPorAtleta.set(l.atletaId, l.dataTreino);
  }

  const participacoesTotal = [...lotesPorAtleta.values()].reduce((s, set) => s + set.size, 0);
  const kmTotal = [...kmPorAtleta.values()].reduce((s, v) => s + v, 0);
  const investimentoTotal = despesas.reduce((s, d) => s + d.totalRealizado, 0);

  const ativosRecentes = ativos.filter((a) => {
    const ultimo = ultimoPorAtleta.get(a.id);
    return ultimo && ultimo >= iso30;
  });
  const engajamento30d = ativos.length > 0 ? Math.round((ativosRecentes.length / ativos.length) * 100) : 0;

  function porModalidade(mod: Modalidade): ModalidadeStats {
    const grupo = ativos.filter((a) => a.equipe === mod);
    const recentes = grupo.filter((a) => {
      const ultimo = ultimoPorAtleta.get(a.id);
      return ultimo && ultimo >= iso30;
    });
    const participacoes = grupo.reduce((s, a) => s + (lotesPorAtleta.get(a.id)?.size ?? 0), 0);
    const pontos = grupo.reduce((s, a) => s + (pontosPorAtleta.get(a.id) ?? 0), 0);
    const km = grupo.reduce((s, a) => s + (kmPorAtleta.get(a.id) ?? 0), 0);
    const top = [...grupo].sort((a, b) => b.pontuacaoTotal - a.pontuacaoTotal).find((a) => a.pontuacaoTotal > 0);
    const inativos = grupo.filter((a) => {
      const ultimo = ultimoPorAtleta.get(a.id);
      return !ultimo || ultimo < iso30;
    });
    return {
      total: grupo.length,
      engajamento: grupo.length > 0 ? Math.round((recentes.length / grupo.length) * 100) : 0,
      ativos30d: recentes.length,
      inativos: inativos.length,
      participacoes,
      pontos,
      media: grupo.length > 0 ? Math.round(pontos / grupo.length) : 0,
      km,
      top,
      inativosList: inativos,
    };
  }

  const bike = porModalidade("bicicleta");
  const corrida = porModalidade("corrida");

  const podio = (mod: Modalidade) =>
    [...ativos]
      .filter((a) => a.equipe === mod && a.pontuacaoTotal > 0)
      .sort((a, b) => b.pontuacaoTotal - a.pontuacaoTotal)
      .slice(0, 3);

  const custoParticipacao = participacoesTotal > 0 ? investimentoTotal / participacoesTotal : 0;
  const custoKm = kmTotal > 0 ? investimentoTotal / kmTotal : 0;
  const custoPorAtleta = ativos.length > 0 ? investimentoTotal / ativos.length : 0;

  const filaAguardando = atletasProgram.filter(
    (a) => a.equipe === "fila_bicicleta" || a.equipe === "fila_corrida",
  ).length;

  const seriesMensal = Array.from({ length: 6 }, (_, i) => {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
    const prefixo = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
    const count = validos.filter((l) => l.dataTreino.startsWith(prefixo)).length;
    return { label: MESES[ref.getMonth()], count };
  });

  const atletasSemAtividade = ativos.filter((a) => !lotesPorAtleta.has(a.id)).length;

  const eventosLancados = new Set(validos.filter((l) => l.eventoId).map((l) => l.eventoId));
  const limiteInferior = new Date(hoje);
  limiteInferior.setDate(limiteInferior.getDate() - 7);
  const isoHoje = hoje.toISOString().slice(0, 10);
  const isoLimite = limiteInferior.toISOString().slice(0, 10);
  const eventosPendentesLancamento = eventos.filter(
    (e) => !eventosLancados.has(e.id) && e.data < isoHoje && e.data >= isoLimite,
  ).length;

  const regrasSemUso = regras.filter((r) => !regrasUsadas.has(r.id)).length;

  const modalidadeMaisKm: EstatisticasDashboard["modalidadeMaisKm"] =
    bike.km === 0 && corrida.km === 0 ? "—" : bike.km >= corrida.km ? "Bicicleta" : "Corrida";

  const mediaKmPorAtleta = ativos.length > 0 ? kmTotal / ativos.length : 0;
  const mediaPontosPorParticipacao = participacoesTotal > 0 ? (bike.pontos + corrida.pontos) / participacoesTotal : 0;

  const analisesExecutivas = [
    `Engajamento recente em ${engajamento30d}%, considerando atletas com atividade nos últimos 30 dias.`,
    `Foram registradas ${participacoesTotal} participações e ${kmTotal.toFixed(1)} km acumulados no período analisado.`,
    `Média de ${mediaKmPorAtleta.toFixed(1)} km por atleta ativo e ${mediaPontosPorParticipacao.toFixed(1)} pontos por participação.`,
    atletasSemAtividade > 0
      ? `${atletasSemAtividade} atleta(s) ativo(s) ainda não possuem participação registrada.`
      : `Todos os atletas ativos possuem ao menos uma participação registrada.`,
    `Modalidade com maior volume de KM: ${modalidadeMaisKm}.`,
  ];

  return {
    ativosCount: ativos.length,
    ativosRecentesCount: ativosRecentes.length,
    engajamento30d,
    participacoesTotal,
    kmTotal,
    investimentoTotal,
    custoPorAtleta,
    custoParticipacao,
    custoKm,
    bike,
    corrida,
    podioBike: podio("bicicleta"),
    podioCorrida: podio("corrida"),
    filaAguardando,
    seriesMensal,
    atletasSemAtividade,
    eventosPendentesLancamento,
    regrasSemUso,
    modalidadeMaisKm,
    analisesExecutivas,
  };
}

export interface LoteResumo {
  data: string;
  descricao: string;
  atletasCount: number;
  pontos: number;
  km: number;
}

/** Agrupa os lançamentos mais recentes por lote, para exibição em relatórios. */
export function agruparUltimosLancamentos(lancamentos: HistoricoPontoDoc[], limite = 8): LoteResumo[] {
  const porLote = new Map<string, LoteResumo & { atletasSet: Set<string> }>();
  for (const l of lancamentos) {
    if (l.estornado) continue;
    const atual = porLote.get(l.loteId) ?? {
      data: l.dataTreino,
      descricao: l.descricaoLote || l.regraDesc,
      atletasCount: 0,
      pontos: 0,
      km: 0,
      atletasSet: new Set<string>(),
    };
    atual.atletasSet.add(l.atletaId);
    atual.pontos += l.pontos;
    atual.km += l.kmPercorrido ?? 0;
    if (l.dataTreino > atual.data) atual.data = l.dataTreino;
    porLote.set(l.loteId, atual);
  }
  return [...porLote.values()]
    .map(({ atletasSet, ...resto }) => ({ ...resto, atletasCount: atletasSet.size }))
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, limite);
}
