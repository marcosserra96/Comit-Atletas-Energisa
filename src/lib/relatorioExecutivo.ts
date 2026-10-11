/**
 * Dados do relatório executivo (PDF): um período escolhido, comparado com o
 * mesmo trecho do período anterior. Tudo puro: o PDF só desenha o que sai daqui.
 */
import { consolidarAtividades, type RegrasDeTreino } from "@/lib/activityConsolidation";
import { formatKmTotal, formatNumero, plural } from "@/lib/format";
import { membroAtivoDaEquipe, novosAtletas, resultadosDaEquipe } from "@/lib/reuniaoResultados";
import type { AtletaDoc, DespesaDoc, EventoDoc, HistoricoMensalDoc, HistoricoPontoDoc, Modalidade } from "@/lib/types";

export type OpcaoPeriodo = "trimestre_atual" | "trimestre_anterior" | "mes_atual" | "mes_anterior" | "ano";

export interface Intervalo {
  inicio: string;
  fim: string;
}

export interface PeriodoRelatorio extends Intervalo {
  id: OpcaoPeriodo;
  /** "3º trimestre", "Outubro de 2026", "2026". */
  nome: string;
  /** Até onde há dados: o fim, ou hoje se o período ainda está correndo. */
  ate: string;
  parcial: boolean;
  /** O mesmo trecho do período anterior (mesmo número de dias), para comparar. */
  anterior: (Intervalo & { nome: string }) | null;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const p2 = (n: number) => String(n).padStart(2, "0");
function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}
function mes(ano: number, mesZero: number): Intervalo {
  const d = new Date(Date.UTC(ano, mesZero, 1));
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const base = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}`;
  return { inicio: `${base}-01`, fim: `${base}-${p2(ultimo)}` };
}
const nomeDoMes = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase())} de ${iso.slice(0, 4)}`;

/** Anterior com o mesmo número de dias já corridos (comparação justa em período parcial). */
function comMesmoTrecho(atual: Intervalo, ate: string, anterior: Intervalo & { nome: string }) {
  const corridos = diasEntre(atual.inicio, ate);
  const fim = somarDias(anterior.inicio, corridos);
  return { ...anterior, fim: fim < anterior.fim ? fim : anterior.fim };
}

/** Períodos que dá para escolher. Trimestres vêm do calendário de premiação. */
export function periodosDoRelatorio(trimestres: readonly { nome: string; inicio: string; fim: string }[], hoje: string): PeriodoRelatorio[] {
  const out: PeriodoRelatorio[] = [];
  const montar = (id: OpcaoPeriodo, nome: string, iv: Intervalo, ant: (Intervalo & { nome: string }) | null) => {
    const ate = hoje < iv.fim ? hoje : iv.fim;
    if (ate < iv.inicio) return;
    const parcial = ate < iv.fim;
    // Período fechado compara com o anterior inteiro; em andamento, com o mesmo trecho.
    out.push({ id, nome, inicio: iv.inicio, fim: iv.fim, ate, parcial, anterior: ant ? (parcial ? comMesmoTrecho(iv, ate, ant) : ant) : null });
  };

  const ordenados = [...trimestres].filter((t) => t.inicio && t.fim).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const iAtual = ordenados.findIndex((t) => t.inicio <= hoje && hoje <= t.fim);
  const iUltimoFechado = ordenados.map((t, i) => (t.fim < hoje ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  const comoPeriodo = (i: number) => (i >= 0 ? { nome: ordenados[i].nome, inicio: ordenados[i].inicio, fim: ordenados[i].fim } : null);
  if (iAtual >= 0) montar("trimestre_atual", ordenados[iAtual].nome, ordenados[iAtual], comoPeriodo(iAtual - 1));
  if (iUltimoFechado >= 0) montar("trimestre_anterior", ordenados[iUltimoFechado].nome, ordenados[iUltimoFechado], comoPeriodo(iUltimoFechado - 1));

  const ano = Number(hoje.slice(0, 4));
  const m = Number(hoje.slice(5, 7)) - 1;
  const esteMes = mes(ano, m);
  const mesPassado = mes(ano, m - 1);
  const retrasado = mes(ano, m - 2);
  montar("mes_atual", nomeDoMes(esteMes.inicio), esteMes, { ...mesPassado, nome: nomeDoMes(mesPassado.inicio) });
  montar("mes_anterior", nomeDoMes(mesPassado.inicio), mesPassado, { ...retrasado, nome: nomeDoMes(retrasado.inicio) });
  montar("ano", String(ano), { inicio: `${ano}-01-01`, fim: `${ano}-12-31` }, { inicio: `${ano - 1}-01-01`, fim: `${ano - 1}-12-31`, nome: String(ano - 1) });
  return out;
}

// ---------- números ----------

export interface Comparacao {
  valor: number;
  anterior: number | null;
  /** Variação em % (arredondada); null quando não há base para comparar. */
  variacao: number | null;
}

function comparar(valor: number, anterior: number | null): Comparacao {
  const variacao = anterior && anterior > 0 ? Math.round(((valor - anterior) / anterior) * 100) : null;
  return { valor, anterior, variacao };
}

export interface EquipeRelatorio {
  modalidade: Modalidade;
  nome: string;
  atletas: number;
  treinaram: number;
  pctTreinaram: number;
  treinos: number;
  km: number;
  kmPorTreino: number;
  pontos: number;
  podio: { posicao: number; nome: string; pontos: number; treinos: number }[];
}

export interface DadosRelatorio {
  periodo: PeriodoRelatorio;
  resumo: string;
  treinaram: Comparacao & { total: number; pct: number; pctAnterior: number | null };
  treinos: Comparacao;
  km: Comparacao;
  investimento: { ano: number; realizado: number; previsto: number; porTreino: number; treinosNoAno: number } | null;
  serie: { rotulo: string; corrida: number; bike: number }[];
  equipes: EquipeRelatorio[];
  novos: { nome: string; modalidade: Modalidade }[];
  semTreinar: { nome: string; modalidade: Modalidade; ultimo: string | null }[];
  fila: { corrida: number; bike: number };
  eventosSemPontos: { titulo: string; data: string }[];
  proximosEventos: { titulo: string; data: string; local: string; confirmados: number }[];
}

const NOME: Record<Modalidade, string> = { corrida: "Corrida", bicicleta: "Bike" };
const MODALIDADES: Modalidade[] = ["corrida", "bicicleta"];

export function montarRelatorio(params: {
  periodo: PeriodoRelatorio;
  atletas: AtletaDoc[];
  lancamentos: HistoricoPontoDoc[];
  resumosMensais: HistoricoMensalDoc[];
  regrasTreino?: RegrasDeTreino;
  eventos: EventoDoc[];
  despesas: DespesaDoc[] | null;
  hoje: string;
}): DadosRelatorio {
  const { periodo, atletas, lancamentos, resumosMensais, regrasTreino, hoje } = params;
  const validos = lancamentos.filter((l) => !l.estornado);
  const resultados = (iv: Intervalo, modalidade: Modalidade) =>
    resultadosDaEquipe({ modalidade, atletas, lancamentos: validos, resumosMensais, inicio: iv.inicio, fim: iv.fim, regrasTreino });

  const atual = { inicio: periodo.inicio, fim: periodo.ate };
  const equipesAtuais = MODALIDADES.map((m) => resultados(atual, m));
  const equipesAnteriores = periodo.anterior ? MODALIDADES.map((m) => resultados(periodo.anterior!, m)) : null;

  const equipes: EquipeRelatorio[] = equipesAtuais.map((r) => {
    const treinaram = r.ranking.filter((l) => l.treinos > 0).length;
    return {
      modalidade: r.modalidade,
      nome: NOME[r.modalidade],
      atletas: r.totais.atletas,
      treinaram,
      pctTreinaram: r.totais.atletas ? Math.round((treinaram / r.totais.atletas) * 100) : 0,
      treinos: r.totais.treinos,
      km: r.totais.km,
      kmPorTreino: r.totais.kmPorTreino,
      pontos: r.totais.pontos,
      podio: r.podio.flatMap((d) => d.atletas.map((a) => ({ posicao: d.posicao, nome: a.nome, pontos: a.pontos, treinos: a.treinos }))),
    };
  });

  const soma = (lista: typeof equipesAtuais | null, f: (r: (typeof equipesAtuais)[number]) => number) => (lista ? lista.reduce((s, r) => s + f(r), 0) : null);
  const totalAtletas = equipes.reduce((s, e) => s + e.atletas, 0);
  const totalTreinaram = equipes.reduce((s, e) => s + e.treinaram, 0);
  const treinaramAntes = soma(equipesAnteriores, (r) => r.ranking.filter((l) => l.treinos > 0).length);
  const atletasAntes = soma(equipesAnteriores, (r) => r.totais.atletas);
  const pct = totalAtletas ? Math.round((totalTreinaram / totalAtletas) * 100) : 0;
  const pctAnterior = atletasAntes ? Math.round(((treinaramAntes ?? 0) / atletasAntes) * 100) : null;

  const treinos = comparar(soma(equipesAtuais, (r) => r.totais.treinos)!, soma(equipesAnteriores, (r) => r.totais.treinos));
  const km = comparar(soma(equipesAtuais, (r) => r.totais.km)!, soma(equipesAnteriores, (r) => r.totais.km));

  // Investimento é anual (o orçamento é por ano): realizado no ano até agora e custo por treino no ano.
  const ano = Number(periodo.ate.slice(0, 4));
  let investimento: DadosRelatorio["investimento"] = null;
  if (params.despesas && params.despesas.length > 0) {
    const doAno = params.despesas.filter((d) => d.anoReferencia === ano);
    const realizado = doAno.reduce((s, d) => s + (d.totalRealizado || 0), 0);
    const previsto = doAno.filter((d) => !d.avulso).reduce((s, d) => s + (d.totalProposto || 0), 0);
    const anoAte = { inicio: `${ano}-01-01`, fim: hoje < `${ano}-12-31` ? hoje : `${ano}-12-31` };
    const treinosNoAno = MODALIDADES.reduce((s, m) => s + resultados(anoAte, m).totais.treinos, 0);
    investimento = { ano, realizado, previsto, porTreino: treinosNoAno ? realizado / treinosNoAno : 0, treinosNoAno };
  }

  // Evolução: 6 meses terminando no mês do fim do período.
  const fimAno = Number(periodo.ate.slice(0, 4));
  const fimMes = Number(periodo.ate.slice(5, 7)) - 1;
  const serie = Array.from({ length: 6 }, (_, i) => {
    const iv = mes(fimAno, fimMes - (5 - i));
    const [corrida, bike] = MODALIDADES.map((m) => resultados(iv, m).totais.treinos);
    const mesZero = Number(iv.inicio.slice(5, 7)) - 1;
    return { rotulo: MESES_CURTOS[mesZero], corrida, bike };
  });

  const novos = novosAtletas({ atletas, inicio: periodo.inicio, ate: periodo.ate }).map((a) => ({ nome: a.nome, modalidade: a.equipe as Modalidade }));

  // Quem está há mais de 30 dias sem atividade (ou nunca treinou), dos mais parados para os menos.
  const limite = somarDias(hoje, -30);
  const porAtleta = new Map<string, HistoricoPontoDoc[]>();
  for (const l of validos) {
    if (l.dataTreino > hoje) continue;
    const lista = porAtleta.get(l.atletaId);
    if (lista) lista.push(l);
    else porAtleta.set(l.atletaId, [l]);
  }
  const semTreinar = atletas
    .filter((a) => MODALIDADES.some((m) => membroAtivoDaEquipe(a, m)))
    .map((a) => {
      const atividades = consolidarAtividades(porAtleta.get(a.id) ?? [], regrasTreino);
      const ultimo = atividades.reduce<string | null>((u, at) => (!u || at.data > u ? at.data : u), null);
      return { nome: a.nome, modalidade: a.equipe as Modalidade, ultimo };
    })
    .filter((a) => !a.ultimo || a.ultimo < limite)
    .sort((a, b) => (a.ultimo ?? "").localeCompare(b.ultimo ?? "") || a.nome.localeCompare(b.nome, "pt-BR"));

  const fila = {
    corrida: atletas.filter((a) => a.equipe === "fila_corrida" && a.visivelNasListas !== false).length,
    bike: atletas.filter((a) => a.equipe === "fila_bicicleta" && a.visivelNasListas !== false).length,
  };

  const eventosLancados = new Set(validos.map((l) => l.eventoId).filter(Boolean));
  const ehReuniao = (e: EventoDoc) => e.tipo === "reuniao";
  const eventosSemPontos = params.eventos
    .filter((e) => !ehReuniao(e) && e.data >= periodo.inicio && e.data <= periodo.ate && e.data < hoje && !eventosLancados.has(e.id))
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((e) => ({ titulo: e.titulo, data: e.data }));
  const proximosEventos = params.eventos
    .filter((e) => e.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 5)
    .map((e) => ({ titulo: e.titulo, data: e.data, local: e.online ? "Online" : e.local, confirmados: e.inscritos?.length ?? 0 }));

  const dados: Omit<DadosRelatorio, "resumo"> = {
    periodo,
    treinaram: { ...comparar(totalTreinaram, treinaramAntes), total: totalAtletas, pct, pctAnterior },
    treinos,
    km,
    investimento,
    serie,
    equipes,
    novos,
    semTreinar,
    fila,
    eventosSemPontos,
    proximosEventos,
  };
  return { ...dados, resumo: resumoDoPeriodo(dados) };
}

/** Uma frase que resume o período, com a comparação quando existe. */
export function resumoDoPeriodo(d: Omit<DadosRelatorio, "resumo">) {
  const { treinaram, treinos, km, periodo } = d;
  if (treinaram.total === 0) return "Ainda não há atletas ativos nas equipes.";
  if (treinos.valor === 0) return `Nenhum treino registrado ${periodo.parcial ? "até agora" : "no período"}.`;
  const base = `${treinaram.valor} de ${treinaram.total} atletas treinaram (${treinaram.pct}%), somando ${plural(treinos.valor, "treino")} e ${formatKmTotal(km.valor)}.`;
  if (treinos.variacao === null || !periodo.anterior) return base;
  const v = treinos.variacao;
  const comparacao =
    v === 0
      ? "O mesmo volume de treinos do período anterior"
      : `${formatNumero(Math.abs(v), 0)}% ${v > 0 ? "mais" : "menos"} treinos que no período anterior`;
  return `${base} ${comparacao}${periodo.parcial ? ", no mesmo ponto do período" : ""}.`;
}
