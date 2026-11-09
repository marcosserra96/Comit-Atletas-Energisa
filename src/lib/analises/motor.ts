import { consolidarAtividades, type RegrasDeTreino } from "@/lib/activityConsolidation";
import { aderenciaDoAtleta, type DiasTreinoConfigDoc } from "@/lib/aderencia";
import { equipeLabel, tipoLancamentoLabel } from "@/lib/labels";
import type { AtletaDoc, HistoricoMensalDoc, HistoricoPontoDoc, TipoLancamento } from "@/lib/types";

/**
 * Motor das Análises: uma pergunta montada pelo comitê ("treinos por atleta no
 * trimestre, só corrida") vira uma tabela. Usa as mesmas regras do ranking:
 * lançamentos válidos + resumos do Histórico mensal, atividades consolidadas
 * (atleta + dia + lançamento = um treino).
 */

export type Medida = "pontos" | "treinos" | "km" | "provas" | "aderencia" | "lancamentos" | "atletas" | "maiorDistancia" | "mesesComTreino";
export type Dimensao = "atleta" | "equipe" | "mes" | "criterio" | "tipo" | "sexo" | "faixaEtaria" | "localidade" | "diaSemana" | "entrada";
export type Modo = "total" | "media";

export interface Periodo {
  de: string;
  ate: string;
}

export interface ConfigAnalise {
  medida: Medida;
  linhas: Dimensao;
  colunas: Dimensao | null;
  periodo: Periodo;
  /** Período para comparar (variação). Só vale sem colunas. */
  anterior: Periodo | null;
  equipe: "todas" | "corrida" | "bicicleta";
  /** Vazio = todos os critérios. */
  criterios: string[];
  /** Vazio = todos os tipos. */
  tipos: TipoLancamento[];
  sexo: "todos" | "M" | "F";
  somenteAtivos: boolean;
  modo: Modo;
  /** Só linhas com valor >= mínimo. */
  minimo: number | null;
  /** Só as N primeiras linhas (depois de ordenar). */
  top: number | null;
  /** Ordem do ranking: pelo valor ou pela variação (só com comparação). */
  ordem?: "valor" | "variacao";
}

export interface MedidaInfo {
  rotulo: string;
  /** "por" na frase: "Treinos por atleta". */
  curto: string;
  unidade: "" | "pts" | "km" | "%";
  /** Como juntar os atletas de um grupo. */
  agregacao: "soma" | "maximo" | "media" | "contagem";
  descricao: string;
}

export const MEDIDAS: Record<Medida, MedidaInfo> = {
  treinos: { rotulo: "Treinos", curto: "treinos", unidade: "", agregacao: "soma", descricao: "Treinos feitos (um por dia e lançamento), mais os do Histórico mensal." },
  pontos: { rotulo: "Pontos", curto: "pontos", unidade: "pts", agregacao: "soma", descricao: "Soma dos pontos lançados, mais os do Histórico mensal." },
  km: { rotulo: "Km", curto: "km", unidade: "km", agregacao: "soma", descricao: "Distância informada nos treinos e eventos, mais a do Histórico mensal." },
  aderencia: { rotulo: "Aderência", curto: "aderência", unidade: "%", agregacao: "media", descricao: "Treinos feitos ÷ treinos previstos na agenda. Em grupos, a média dos atletas." },
  provas: { rotulo: "Provas", curto: "provas", unidade: "", agregacao: "soma", descricao: "Participações em eventos (lançamentos do tipo Evento)." },
  mesesComTreino: { rotulo: "Meses com treino", curto: "meses com treino", unidade: "", agregacao: "media", descricao: "Em quantos meses do período o atleta treinou. Mede constância. Em grupos, a média." },
  maiorDistancia: { rotulo: "Maior distância", curto: "maior distância", unidade: "km", agregacao: "maximo", descricao: "O treino ou evento mais longo do período." },
  atletas: { rotulo: "Atletas participantes", curto: "atletas participantes", unidade: "", agregacao: "contagem", descricao: "Quantos atletas tiveram ao menos um lançamento ou resumo mensal." },
  lancamentos: { rotulo: "Lançamentos", curto: "lançamentos", unidade: "", agregacao: "soma", descricao: "Quantidade de lançamentos de pontos (sem o Histórico mensal)." },
};

export const DIMENSOES: Record<Dimensao, { rotulo: string; curto: string; doAtleta: boolean }> = {
  atleta: { rotulo: "Atleta", curto: "atleta", doAtleta: true },
  equipe: { rotulo: "Equipe", curto: "equipe", doAtleta: true },
  mes: { rotulo: "Mês", curto: "mês", doAtleta: false },
  criterio: { rotulo: "Critério", curto: "critério", doAtleta: false },
  tipo: { rotulo: "Tipo de lançamento", curto: "tipo de lançamento", doAtleta: false },
  sexo: { rotulo: "Sexo", curto: "sexo", doAtleta: true },
  faixaEtaria: { rotulo: "Faixa etária", curto: "faixa etária", doAtleta: true },
  localidade: { rotulo: "Localidade", curto: "localidade", doAtleta: true },
  diaSemana: { rotulo: "Dia da semana", curto: "dia da semana", doAtleta: false },
  entrada: { rotulo: "Ano de entrada", curto: "ano de entrada", doAtleta: true },
};

/** Combinações que não fazem sentido (a medida não existe naquele recorte). */
export function combinacaoInvalida(medida: Medida, dim: Dimensao | null): string | null {
  if (!dim) return null;
  if (medida === "aderencia" && (dim === "criterio" || dim === "tipo" || dim === "diaSemana")) {
    return "Aderência é do atleta no período todo: não se divide por critério, tipo ou dia da semana.";
  }
  if (medida === "mesesComTreino" && (dim === "mes" || dim === "diaSemana")) {
    return "\"Meses com treino\" já conta meses: use outra medida para ver mês a mês.";
  }
  return null;
}

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const SEM_INFO = "Não informado";
const RESUMO_MENSAL = "Histórico mensal";

export function rotuloDoMes(competencia: string) {
  const [ano, mes] = competencia.split("-");
  return `${MESES_CURTOS[Number(mes) - 1]}/${ano.slice(2)}`;
}

function diaDaSemana(data: string) {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function faixaEtaria(dataNascimento: string | undefined, referencia: string) {
  if (!dataNascimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) return SEM_INFO;
  let idade = Number(referencia.slice(0, 4)) - Number(dataNascimento.slice(0, 4));
  if (referencia.slice(5) < dataNascimento.slice(5)) idade -= 1;
  if (idade < 30) return "Até 29 anos";
  if (idade < 40) return "30 a 39 anos";
  if (idade < 50) return "40 a 49 anos";
  if (idade < 60) return "50 a 59 anos";
  return "60 anos ou mais";
}

function anoDeEntrada(a: AtletaDoc) {
  const ano = a.entrouNaEquipeEm?.slice(0, 4) || (a.anoEntrada ? String(a.anoEntrada) : "");
  return ano ? `Entrou em ${ano}` : SEM_INFO;
}

const SEXO: Record<string, string> = { F: "Feminino", M: "Masculino", Outro: "Outro" };

/** Competências YYYY-MM de um período, em ordem. */
export function mesesDoPeriodo(p: Periodo) {
  const lista: string[] = [];
  let [ano, mes] = p.de.slice(0, 7).split("-").map(Number);
  const [anoFim, mesFim] = p.ate.slice(0, 7).split("-").map(Number);
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    lista.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return lista;
}

interface Chave {
  chave: string;
  rotulo: string;
  ordem?: number;
}

function chaveDoAtleta(dim: Dimensao, a: AtletaDoc, referencia: string): Chave {
  switch (dim) {
    case "atleta":
      return { chave: a.id, rotulo: a.nome };
    case "equipe":
      return { chave: a.equipe, rotulo: equipeLabel[a.equipe] ?? a.equipe };
    case "sexo":
      return { chave: a.sexo ?? "-", rotulo: SEXO[a.sexo ?? ""] ?? SEM_INFO };
    case "faixaEtaria": {
      const f = faixaEtaria(a.dataNascimento, referencia);
      return { chave: f, rotulo: f, ordem: f === SEM_INFO ? 99 : Number(f.match(/\d+/)?.[0] ?? 0) };
    }
    case "localidade": {
      const l = a.localidade?.trim();
      return { chave: l ? l.toLowerCase() : "-", rotulo: l || SEM_INFO };
    }
    case "entrada": {
      const e = anoDeEntrada(a);
      return { chave: e, rotulo: e, ordem: e === SEM_INFO ? 9999 : Number(e.slice(-4)) };
    }
    default:
      return { chave: "-", rotulo: SEM_INFO };
  }
}

function chaveDoLancamento(dim: Dimensao, l: HistoricoPontoDoc, a: AtletaDoc, referencia: string): Chave {
  switch (dim) {
    case "mes":
      return { chave: l.dataTreino.slice(0, 7), rotulo: rotuloDoMes(l.dataTreino.slice(0, 7)) };
    case "criterio":
      return { chave: l.regraId || l.regraDesc, rotulo: l.regraDesc || "Sem critério" };
    case "tipo":
      return { chave: l.tipoLancamento, rotulo: tipoLancamentoLabel[l.tipoLancamento] ?? l.tipoLancamento, ordem: ["treino", "evento", "avulso", "reuniao", "importacao"].indexOf(l.tipoLancamento) };
    case "diaSemana": {
      const d = diaDaSemana(l.dataTreino);
      return { chave: String(d), rotulo: DIAS[d], ordem: ORDEM_DIAS.indexOf(d) };
    }
    default:
      return chaveDoAtleta(dim, a, referencia);
  }
}

function chaveDoResumo(dim: Dimensao, r: HistoricoMensalDoc, a: AtletaDoc, referencia: string): Chave {
  switch (dim) {
    case "mes":
      return { chave: r.competencia, rotulo: rotuloDoMes(r.competencia) };
    case "criterio":
    case "tipo":
      return { chave: "__resumo", rotulo: RESUMO_MENSAL, ordem: 98 };
    case "diaSemana":
      return { chave: "__resumo", rotulo: `Sem dia (${RESUMO_MENSAL.toLowerCase()})`, ordem: 98 };
    default:
      return chaveDoAtleta(dim, a, referencia);
  }
}

export interface DadosAnalise {
  atletas: readonly AtletaDoc[];
  lancamentos: readonly HistoricoPontoDoc[];
  resumos: readonly HistoricoMensalDoc[];
  regrasTreino?: RegrasDeTreino;
  diasTreino?: DiasTreinoConfigDoc | null;
  hoje: string;
}

export interface CelulaResultado {
  valor: number | null;
}

export interface LinhaResultado {
  chave: string;
  rotulo: string;
  /** Linha de atleta: a equipe, para dar contexto. */
  detalhe?: string;
  valor: number | null;
  anterior?: number | null;
  celulas?: Record<string, number | null>;
  ordem?: number;
}

export interface ResultadoAnalise {
  linhas: LinhaResultado[];
  colunas: Chave[] | null;
  /** O valor do conjunto todo (mesma agregação da medida). */
  total: number | null;
  totalAnterior: number | null;
  atletasNoFiltro: number;
  /** Linhas antes de aplicar mínimo e top. */
  linhasAntesDoCorte: number;
  /** O resumo mensal ficou de fora (filtro por critério ou tipo). */
  semResumoMensal: boolean;
}

interface Bloco {
  lancs: HistoricoPontoDoc[];
  resumos: HistoricoMensalDoc[];
}

/** Atletas que entram na análise: só equipes de treino, perfis visíveis, filtros de equipe, sexo e situação. */
export function atletasDaAnalise(atletas: readonly AtletaDoc[], cfg: Pick<ConfigAnalise, "equipe" | "sexo" | "somenteAtivos">) {
  return atletas.filter(
    (a) =>
      (a.equipe === "corrida" || a.equipe === "bicicleta") &&
      a.visivelNasListas !== false &&
      (cfg.equipe === "todas" || a.equipe === cfg.equipe) &&
      (cfg.sexo === "todos" || a.sexo === cfg.sexo) &&
      (!cfg.somenteAtivos || a.ativo),
  );
}

function arred(n: number) {
  return Math.round(n * 10) / 10;
}

/** Valor da medida para um atleta, num recorte (bloco) e num período. */
function valorDoAtleta(medida: Medida, bloco: Bloco, ctx: { atleta: AtletaDoc; dados: DadosAnalise; periodo: Periodo; todosDoAtleta: HistoricoPontoDoc[]; resumosDoAtleta: HistoricoMensalDoc[] }): number | null {
  const { lancs, resumos } = bloco;
  const regras = ctx.dados.regrasTreino;
  const semFalta = lancs.filter((l) => l.regraId !== "falta_justificada");
  switch (medida) {
    case "pontos":
      return semFalta.reduce((s, l) => s + (Number(l.pontos) || 0), 0) + resumos.reduce((s, r) => s + (Number(r.pontos) || 0), 0);
    case "lancamentos":
      return semFalta.length;
    case "treinos":
      return consolidarAtividades(semFalta, regras).filter((a) => a.tipo === "treino").length + resumos.reduce((s, r) => s + (Number(r.treinos) || 0), 0);
    case "km":
      return arred(consolidarAtividades(semFalta, regras).reduce((s, a) => s + a.km, 0) + resumos.reduce((s, r) => s + (Number(r.km) || 0), 0));
    case "provas":
      return consolidarAtividades(semFalta.filter((l) => l.tipoLancamento === "evento"), regras).length;
    case "maiorDistancia": {
      const maior = Math.max(0, ...consolidarAtividades(semFalta, regras).map((a) => a.km));
      return maior > 0 ? arred(maior) : null;
    }
    case "mesesComTreino": {
      const meses = new Set(consolidarAtividades(semFalta, regras).filter((a) => a.tipo === "treino").map((a) => a.data.slice(0, 7)));
      resumos.filter((r) => (Number(r.treinos) || 0) > 0).forEach((r) => meses.add(r.competencia));
      return meses.size;
    }
    case "atletas":
      return semFalta.length + resumos.length > 0 ? 1 : 0;
    case "aderencia": {
      const { atleta, dados, periodo } = ctx;
      if (!dados.diasTreino || (atleta.equipe !== "corrida" && atleta.equipe !== "bicicleta")) return null;
      return aderenciaDoAtleta({
        modalidade: atleta.equipe,
        config: dados.diasTreino,
        lancamentos: ctx.todosDoAtleta,
        resumosMensais: ctx.resumosDoAtleta,
        de: periodo.de,
        ate: periodo.ate,
        hoje: dados.hoje,
        regrasTreino: regras,
      }).percentual;
    }
  }
}

function agregar(medida: Medida, valores: (number | null)[], modo: Modo, atletasNoGrupo: number): number | null {
  const info = MEDIDAS[medida];
  const validos = valores.filter((v): v is number => v != null);
  if (info.agregacao === "maximo") return validos.length ? Math.max(...validos) : null;
  if (info.agregacao === "media") return validos.length ? arred(validos.reduce((s, v) => s + v, 0) / validos.length) : null;
  const soma = validos.reduce((s, v) => s + v, 0);
  if (info.agregacao === "contagem") return soma;
  if (modo === "media") return atletasNoGrupo > 0 ? arred(soma / atletasNoGrupo) : null;
  return arred(soma);
}

/** Período de uma célula: para "mês", só aquele mês (dentro do período). */
function periodoDaChave(dim: Dimensao | null, chave: string, periodo: Periodo): Periodo {
  if (dim !== "mes") return periodo;
  const [a, m] = chave.split("-").map(Number);
  const fim = `${chave}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
  return { de: periodo.de > `${chave}-01` ? periodo.de : `${chave}-01`, ate: periodo.ate < fim ? periodo.ate : fim };
}

interface Calculo {
  porLinha: Map<string, { chave: Chave; valor: number | null; celulas: Map<string, number | null> }>;
  colunas: Map<string, Chave>;
  total: number | null;
}

function calcular(cfg: ConfigAnalise, dados: DadosAnalise, periodo: Periodo, atletas: AtletaDoc[]): Calculo & { semResumoMensal: boolean } {
  const ids = new Set(atletas.map((a) => a.id));
  const porId = new Map(atletas.map((a) => [a.id, a]));
  const criterios = new Set(cfg.criterios);
  const tipos = new Set(cfg.tipos);
  const semResumoMensal = criterios.size > 0 || tipos.size > 0;
  const mesDe = periodo.de.slice(0, 7);
  const mesAte = periodo.ate.slice(0, 7);

  // Tudo do atleta no período (aderência usa sem filtro de critério: é a agenda inteira).
  const todosPorAtleta = new Map<string, HistoricoPontoDoc[]>();
  const lancs: HistoricoPontoDoc[] = [];
  for (const l of dados.lancamentos) {
    if (l.estornado || !ids.has(l.atletaId) || l.dataTreino < periodo.de || l.dataTreino > periodo.ate) continue;
    const lista = todosPorAtleta.get(l.atletaId) ?? [];
    lista.push(l);
    todosPorAtleta.set(l.atletaId, lista);
    if (criterios.size && !criterios.has(l.regraId)) continue;
    if (tipos.size && !tipos.has(l.tipoLancamento)) continue;
    lancs.push(l);
  }
  const resumosPorAtleta = new Map<string, HistoricoMensalDoc[]>();
  const resumos: HistoricoMensalDoc[] = [];
  for (const r of dados.resumos) {
    if (!ids.has(r.atletaId) || r.competencia < mesDe || r.competencia > mesAte) continue;
    const lista = resumosPorAtleta.get(r.atletaId) ?? [];
    lista.push(r);
    resumosPorAtleta.set(r.atletaId, lista);
    if (!semResumoMensal) resumos.push(r);
  }

  const ref = periodo.ate;
  const dimL = cfg.linhas;
  const dimC = cfg.colunas;
  // linha -> coluna -> atleta -> bloco
  const blocos = new Map<string, Map<string, Map<string, Bloco>>>();
  const linhasChave = new Map<string, Chave>();
  const colunasChave = new Map<string, Chave>();
  const COL_UNICA = "__total";

  function bloco(kL: Chave, kC: Chave | null, atletaId: string) {
    linhasChave.set(kL.chave, kL);
    if (kC) colunasChave.set(kC.chave, kC);
    const porColuna = blocos.get(kL.chave) ?? new Map<string, Map<string, Bloco>>();
    blocos.set(kL.chave, porColuna);
    const porAtleta = porColuna.get(kC?.chave ?? COL_UNICA) ?? new Map<string, Bloco>();
    porColuna.set(kC?.chave ?? COL_UNICA, porAtleta);
    const b = porAtleta.get(atletaId) ?? { lancs: [], resumos: [] };
    porAtleta.set(atletaId, b);
    return b;
  }

  for (const l of lancs) {
    const a = porId.get(l.atletaId)!;
    bloco(chaveDoLancamento(dimL, l, a, ref), dimC ? chaveDoLancamento(dimC, l, a, ref) : null, a.id).lancs.push(l);
  }
  for (const r of resumos) {
    const a = porId.get(r.atletaId)!;
    bloco(chaveDoResumo(dimL, r, a, ref), dimC ? chaveDoResumo(dimC, r, a, ref) : null, a.id).resumos.push(r);
  }

  // Grupos sem nenhum registro também aparecem (atleta que não treinou, mês vazio).
  const garantirLinha = (k: Chave) => {
    if (!linhasChave.has(k.chave)) linhasChave.set(k.chave, k);
  };
  if (DIMENSOES[dimL].doAtleta) atletas.forEach((a) => garantirLinha(chaveDoAtleta(dimL, a, ref)));
  if (dimL === "mes") mesesDoPeriodo(periodo).forEach((m) => garantirLinha({ chave: m, rotulo: rotuloDoMes(m) }));
  if (dimL === "diaSemana") ORDEM_DIAS.forEach((d, i) => garantirLinha({ chave: String(d), rotulo: DIAS[d], ordem: i }));
  if (dimC === "mes") mesesDoPeriodo(periodo).forEach((m) => colunasChave.set(m, colunasChave.get(m) ?? { chave: m, rotulo: rotuloDoMes(m) }));
  if (dimC && DIMENSOES[dimC].doAtleta) atletas.forEach((a) => {
    const k = chaveDoAtleta(dimC, a, ref);
    if (!colunasChave.has(k.chave)) colunasChave.set(k.chave, k);
  });

  // Quem pertence a cada grupo (para média por atleta e para aderência/zeros).
  const grupos = new Map<Dimensao, Map<string, Set<string>>>();
  for (const dim of [dimL, dimC]) {
    if (!dim || !DIMENSOES[dim].doAtleta || grupos.has(dim)) continue;
    const m = new Map<string, Set<string>>();
    for (const a of atletas) {
      const k = chaveDoAtleta(dim, a, ref).chave;
      const set = m.get(k) ?? new Set<string>();
      set.add(a.id);
      m.set(k, set);
    }
    grupos.set(dim, m);
  }
  const noGrupo = (dim: Dimensao | null, chave: string | null, id: string) =>
    !dim || chave === null || !DIMENSOES[dim].doAtleta || !!grupos.get(dim)?.get(chave)?.has(id);

  const valorDoGrupo = (kL: string | null, kC: string | null) => {
    const membros = atletas.filter((a) => noGrupo(dimL, kL, a.id) && noGrupo(dimC, kC, a.id));
    const pLinha = periodoDaChave(kL ? dimL : null, kL ?? "", periodo);
    const p = periodoDaChave(kC ? dimC : null, kC ?? "", pLinha);
    const valores = membros.map((a) => {
      let b: Bloco = { lancs: [], resumos: [] };
      if (kL !== null) {
        const porColuna = blocos.get(kL);
        if (kC !== null) b = porColuna?.get(kC)?.get(a.id) ?? b;
        else if (porColuna) {
          // Linha inteira: junta as colunas.
          for (const porAtleta of porColuna.values()) {
            const x = porAtleta.get(a.id);
            if (x) b = { lancs: [...b.lancs, ...x.lancs], resumos: [...b.resumos, ...x.resumos] };
          }
        }
      } else {
        b = { lancs: lancs.filter((l) => l.atletaId === a.id), resumos: resumos.filter((r) => r.atletaId === a.id) };
      }
      return valorDoAtleta(cfg.medida, b, { atleta: a, dados, periodo: p, todosDoAtleta: todosPorAtleta.get(a.id) ?? [], resumosDoAtleta: resumosPorAtleta.get(a.id) ?? [] });
    });
    return agregar(cfg.medida, valores, cfg.modo, membros.length);
  };

  const porLinha: Calculo["porLinha"] = new Map();
  for (const [kL, chave] of linhasChave) {
    const celulas = new Map<string, number | null>();
    if (dimC) for (const kC of colunasChave.keys()) celulas.set(kC, valorDoGrupo(kL, kC));
    porLinha.set(kL, { chave, valor: valorDoGrupo(kL, null), celulas });
  }
  return { porLinha, colunas: colunasChave, total: valorDoGrupo(null, null), semResumoMensal };
}

function ordenarChaves(dim: Dimensao, a: Chave, b: Chave) {
  if (dim === "mes") return a.chave.localeCompare(b.chave);
  if (a.ordem != null || b.ordem != null) return (a.ordem ?? 50) - (b.ordem ?? 50) || a.rotulo.localeCompare(b.rotulo, "pt-BR");
  return a.rotulo.localeCompare(b.rotulo, "pt-BR");
}

/** Dimensões com ordem natural (mês, dia, faixa) ficam na ordem delas; as outras, do maior para o menor. */
export function temOrdemNatural(dim: Dimensao) {
  return dim === "mes" || dim === "diaSemana" || dim === "faixaEtaria" || dim === "entrada";
}

export function executarAnalise(cfg: ConfigAnalise, dados: DadosAnalise): ResultadoAnalise {
  const atletas = atletasDaAnalise(dados.atletas, cfg);
  const atual = calcular(cfg, dados, cfg.periodo, atletas);
  const anterior = cfg.anterior && !cfg.colunas ? calcular(cfg, dados, cfg.anterior, atletas) : null;
  const equipePorId = new Map(atletas.map((a) => [a.id, a.equipe]));
  // Mês a mês, o anterior casa pela posição (jan com jan do ano anterior, 1º mês do trimestre com o 1º do outro).
  const anteriorPorChave = new Map<string, number | null>();
  if (anterior) {
    if (cfg.linhas === "mes") {
      const atuais = [...atual.porLinha.keys()].sort();
      const antes = [...anterior.porLinha.keys()].sort();
      atuais.forEach((k, i) => anteriorPorChave.set(k, antes[i] ? (anterior.porLinha.get(antes[i])?.valor ?? null) : null));
    } else {
      for (const [k, l] of anterior.porLinha) anteriorPorChave.set(k, l.valor);
    }
  }

  let linhas: LinhaResultado[] = [...atual.porLinha.entries()].map(([chave, l]) => ({
    chave,
    rotulo: l.chave.rotulo,
    ordem: l.chave.ordem,
    detalhe: cfg.linhas === "atleta" ? equipeLabel[equipePorId.get(chave)!] : undefined,
    valor: l.valor,
    ...(anterior ? { anterior: anteriorPorChave.get(chave) ?? null } : {}),
    ...(cfg.colunas ? { celulas: Object.fromEntries(l.celulas) } : {}),
  }));

  if (temOrdemNatural(cfg.linhas)) {
    linhas.sort((a, b) => ordenarChaves(cfg.linhas, { chave: a.chave, rotulo: a.rotulo, ordem: a.ordem }, { chave: b.chave, rotulo: b.rotulo, ordem: b.ordem }));
  } else if (cfg.ordem === "variacao" && anterior) {
    const delta = (l: LinhaResultado) => variacao(l.valor, l.anterior)?.abs ?? -Infinity;
    linhas.sort((a, b) => delta(b) - delta(a) || (b.valor ?? -Infinity) - (a.valor ?? -Infinity) || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  } else {
    linhas.sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity) || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }
  const linhasAntesDoCorte = linhas.length;
  if (cfg.minimo != null) linhas = linhas.filter((l) => (l.valor ?? -Infinity) >= cfg.minimo!);
  if (cfg.top != null && cfg.top > 0) linhas = linhas.slice(0, cfg.top);

  const colunas = cfg.colunas ? [...atual.colunas.values()].sort((a, b) => ordenarChaves(cfg.colunas!, a, b)) : null;
  return {
    linhas,
    colunas,
    total: atual.total,
    totalAnterior: anterior?.total ?? null,
    atletasNoFiltro: atletas.length,
    linhasAntesDoCorte,
    semResumoMensal: atual.semResumoMensal,
  };
}

/** Variação entre dois valores: absoluta e percentual (null quando não dá para comparar). */
export function variacao(atual: number | null | undefined, anterior: number | null | undefined) {
  if (atual == null || anterior == null) return null;
  const abs = arred(atual - anterior);
  return { abs, pct: anterior === 0 ? null : Math.round(((atual - anterior) / anterior) * 100) };
}

/** Mesmo tamanho, logo antes. Ex.: 01/07–30/09 → 01/04–30/06 quando são meses inteiros. */
export function periodoAnterior(p: Periodo): Periodo {
  const d = (iso: string) => {
    const [a, m, dia] = iso.split("-").map(Number);
    return new Date(Date.UTC(a, m - 1, dia));
  };
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const inicio = d(p.de);
  const fim = d(p.ate);
  const fimDoMes = (x: Date) => new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate() === x.getUTCDate();
  if (inicio.getUTCDate() === 1 && fimDoMes(fim)) {
    const meses = (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + fim.getUTCMonth() - inicio.getUTCMonth() + 1;
    const novoInicio = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() - meses, 1));
    const novoFim = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 0));
    return { de: iso(novoInicio), ate: iso(novoFim) };
  }
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1;
  const novoFim = new Date(inicio.getTime() - 86400000);
  return { de: iso(new Date(novoFim.getTime() - (dias - 1) * 86400000)), ate: iso(novoFim) };
}
