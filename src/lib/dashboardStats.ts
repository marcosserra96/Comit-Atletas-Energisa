import { dataIsoLocal } from "@/lib/date";
import { ehMembroDoElenco } from "@/lib/labels";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { consolidarAtividades, type AtividadeConsolidada } from "@/lib/activityConsolidation";
import type {
  AtletaDoc,
  DespesaDoc,
  EventoDoc,
  HistoricoMensalDoc,
  HistoricoPontoDoc,
  Modalidade,
  RegraPontuacaoDoc,
} from "@/lib/types";
import { formatKm, formatPontos, plural } from "@/lib/format";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface ModalidadeStats {
  total: number;
  engajamento: number;
  ativos30d: number;
  inativos: number;
  participacoes: number;
  pontos: number;
  /** Pontos divididos pelo número de atletas da modalidade. */
  media: number;
  km: number;
  /** `pontuacaoTotal` aqui é a pontuação calculada, a mesma do Ranking geral. */
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
  /** Até 3 atletas; `pontuacaoTotal` é a pontuação calculada, a mesma do Ranking geral. */
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
  modalidadeMaisKm: "Bike" | "Corrida" | "—";
  analisesExecutivas: string[];
}

export function calcularEstatisticasDashboard(params: {
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
  resumosMensais?: HistoricoMensalDoc[];
  despesas: DespesaDoc[];
  eventos: EventoDoc[];
  regras: RegraPontuacaoDoc[];
}): EstatisticasDashboard {
  const { atletas, lancamentos, resumosMensais = [], despesas, eventos, regras } = params;
  const hoje = new Date();
  const ha30dias = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  const iso30 = dataIsoLocal(ha30dias);

  const atletasProgram = atletas.filter(
    (a) => perfilAtletaVisivel(a) && ehMembroDoElenco(a.equipe),
  );
  const atletaIdsVisiveis = new Set(atletasProgram.map((atleta) => atleta.id));
  // Atleta na fila de espera ainda não entrou no programa — não conta como
  // ativo em nenhuma estatística (engajamento, pódio, ranking, etc.), mesmo
  // que o campo "ativo" esteja com valor incorreto para ele.
  const ativos = atletasProgram.filter((a) => a.ativo && a.equipe !== "fila_bicicleta" && a.equipe !== "fila_corrida");

  const validos = lancamentos.filter(
    (l) => !l.estornado && atletaIdsVisiveis.has(l.atletaId),
  );
  const regrasUsadas = new Set(validos.map((l) => l.regraId));
  const resumosValidos = resumosMensais.filter((item) => atletaIdsVisiveis.has(item.atletaId));

  // Mesma consolidação do Ranking: cada atividade conta uma vez, soma os pontos
  // de todas as regras e usa a maior quilometragem informada. Faltas
  // justificadas não contam como atividade.
  const lancamentosPorAtleta = new Map<string, HistoricoPontoDoc[]>();
  for (const l of validos) {
    const lista = lancamentosPorAtleta.get(l.atletaId) ?? [];
    lista.push(l);
    lancamentosPorAtleta.set(l.atletaId, lista);
  }
  const atividadesPorAtleta = new Map<string, AtividadeConsolidada[]>();
  const participacoesPorAtleta = new Map<string, number>();
  const kmPorAtleta = new Map<string, number>();
  const pontosPorAtleta = new Map<string, number>();
  const ultimoPorAtleta = new Map<string, string>();
  for (const [atletaId, lista] of lancamentosPorAtleta) {
    const atividades = consolidarAtividades(lista);
    if (atividades.length === 0) continue;
    atividadesPorAtleta.set(atletaId, atividades);
    participacoesPorAtleta.set(atletaId, atividades.length);
    kmPorAtleta.set(atletaId, atividades.reduce((t, a) => t + a.km, 0));
    pontosPorAtleta.set(atletaId, atividades.reduce((t, a) => t + a.pontos, 0));
    ultimoPorAtleta.set(atletaId, atividades.reduce((u, a) => (a.data > u ? a.data : u), ""));
  }

  // Histórico mensal complementa os totais gerais, mas não "fabrica" uma
  // última data de atividade para os indicadores de 30 dias.
  for (const resumo of resumosValidos) {
    participacoesPorAtleta.set(
      resumo.atletaId,
      (participacoesPorAtleta.get(resumo.atletaId) ?? 0) + (resumo.treinos || 0),
    );
    kmPorAtleta.set(
      resumo.atletaId,
      (kmPorAtleta.get(resumo.atletaId) ?? 0) + (resumo.km || 0),
    );
    pontosPorAtleta.set(
      resumo.atletaId,
      (pontosPorAtleta.get(resumo.atletaId) ?? 0) + (resumo.pontos || 0),
    );
  }
  const pontosDe = (atleta: AtletaDoc) => pontosPorAtleta.get(atleta.id) ?? 0;
  /** Cópia do atleta com a pontuação calculada, para pódio e relatórios. */
  const comPontos = (atleta: AtletaDoc): AtletaDoc => ({ ...atleta, pontuacaoTotal: pontosDe(atleta) });
  const porPontos = (a: AtletaDoc, b: AtletaDoc) =>
    pontosDe(b) - pontosDe(a) || a.nome.localeCompare(b.nome, "pt-BR");

  const participacoesTotal = [...participacoesPorAtleta.values()].reduce((s, v) => s + v, 0);
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
    const participacoes = grupo.reduce((s, a) => s + (participacoesPorAtleta.get(a.id) ?? 0), 0);
    const pontos = grupo.reduce((s, a) => s + pontosDe(a), 0);
    const km = grupo.reduce((s, a) => s + (kmPorAtleta.get(a.id) ?? 0), 0);
    const primeiro = [...grupo].sort(porPontos).find((a) => pontosDe(a) > 0);
    const top = primeiro ? comPontos(primeiro) : undefined;
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
    ativos
      .filter((a) => a.equipe === mod && pontosDe(a) > 0)
      .sort(porPontos)
      .slice(0, 3)
      .map(comPontos);

  const custoParticipacao = participacoesTotal > 0 ? investimentoTotal / participacoesTotal : 0;
  const custoKm = kmTotal > 0 ? investimentoTotal / kmTotal : 0;
  const custoPorAtleta = ativos.length > 0 ? investimentoTotal / ativos.length : 0;

  const filaAguardando = atletasProgram.filter(
    (a) => a.equipe === "fila_bicicleta" || a.equipe === "fila_corrida",
  ).length;

  const seriesMensal = Array.from({ length: 6 }, (_, i) => {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
    const prefixo = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
    let count = 0;
    for (const atividades of atividadesPorAtleta.values()) {
      count += atividades.filter((a) => a.data.startsWith(prefixo)).length;
    }
    count += resumosValidos
      .filter((item) => item.competencia === prefixo)
      .reduce((total, item) => total + (item.treinos || 0), 0);
    return { label: MESES[ref.getMonth()], count };
  });

  const atletasSemAtividade = ativos.filter((a) => !participacoesPorAtleta.has(a.id)).length;

  const eventosLancados = new Set(validos.filter((l) => l.eventoId).map((l) => l.eventoId));
  const limiteInferior = new Date(hoje);
  limiteInferior.setDate(limiteInferior.getDate() - 7);
  const isoHoje = dataIsoLocal(hoje);
  const isoLimite = dataIsoLocal(limiteInferior);
  const eventosPendentesLancamento = eventos.filter(
    (e) => !eventosLancados.has(e.id) && e.data < isoHoje && e.data >= isoLimite,
  ).length;

  const regrasSemUso = regras.filter((r) => !regrasUsadas.has(r.id)).length;

  const modalidadeMaisKm: EstatisticasDashboard["modalidadeMaisKm"] =
    bike.km === 0 && corrida.km === 0 ? "—" : bike.km >= corrida.km ? "Bike" : "Corrida";

  const mediaKmPorAtleta = ativos.length > 0 ? kmTotal / ativos.length : 0;
  const mediaPontosPorParticipacao = participacoesTotal > 0 ? (bike.pontos + corrida.pontos) / participacoesTotal : 0;

  const analisesExecutivas = [
    `Engajamento recente em ${engajamento30d}%, considerando atletas com atividade nos últimos 30 dias.`,
    `Foram registradas ${participacoesTotal} participações e ${formatKm(kmTotal)} acumulados no período analisado.`,
    `Média de ${formatKm(mediaKmPorAtleta)} por atleta ativo e ${formatPontos(mediaPontosPorParticipacao)} pontos por participação.`,
    atletasSemAtividade > 0
      ? `${plural(atletasSemAtividade, "atleta ativo", "atletas ativos")} ainda ${atletasSemAtividade === 1 ? "não possui" : "não possuem"} participação registrada.`
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
