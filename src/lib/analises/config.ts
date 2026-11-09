import { DIMENSOES, MEDIDAS, periodoAnterior, type ConfigAnalise, type Dimensao, type Medida, type Modo, type Periodo } from "./motor";
import type { TipoLancamento } from "@/lib/types";

/**
 * O que o comitê escolhe na tela, guardado na URL (dá para salvar nos favoritos
 * ou mandar o link). O motor recebe a versão resolvida (`ConfigAnalise`).
 */

export type PresetPeriodo = "mes" | "mesPassado" | "trimestre" | "trimestrePassado" | "ano" | "anoPassado" | "personalizado";

export interface EscolhaAnalise {
  medida: Medida;
  linhas: Dimensao;
  colunas: Dimensao | null;
  periodo: PresetPeriodo;
  de: string;
  ate: string;
  comparar: boolean;
  equipe: ConfigAnalise["equipe"];
  criterio: string;
  tipo: TipoLancamento | "";
  sexo: ConfigAnalise["sexo"];
  somenteAtivos: boolean;
  modo: Modo;
  minimo: number | null;
  top: number | null;
  /** Com comparação: ordenar pelo valor ou pela variação. */
  ordem: "valor" | "variacao";
}

export const ESCOLHA_PADRAO: EscolhaAnalise = {
  medida: "treinos",
  linhas: "atleta",
  colunas: null,
  periodo: "trimestre",
  de: "",
  ate: "",
  comparar: false,
  equipe: "todas",
  criterio: "",
  tipo: "",
  sexo: "todos",
  somenteAtivos: true,
  modo: "total",
  minimo: null,
  top: null,
  ordem: "valor",
};

export const PERIODOS: Record<PresetPeriodo, string> = {
  mes: "Este mês",
  mesPassado: "Mês passado",
  trimestre: "Trimestre atual",
  trimestrePassado: "Trimestre passado",
  ano: "Este ano",
  anoPassado: "Ano passado",
  personalizado: "Escolher datas",
};

const TIPOS: TipoLancamento[] = ["treino", "evento", "avulso", "reuniao", "importacao"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function um<T extends string>(valor: string | null, permitidos: readonly T[], padrao: T): T {
  return valor && (permitidos as readonly string[]).includes(valor) ? (valor as T) : padrao;
}

function numero(valor: string | null) {
  if (valor == null || valor === "") return null;
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function lerEscolha(busca: string): EscolhaAnalise {
  const p = new URLSearchParams(busca);
  const dims = Object.keys(DIMENSOES) as Dimensao[];
  const linhas = um(p.get("por"), dims, ESCOLHA_PADRAO.linhas);
  const colunas = p.get("col") ? um<Dimensao | "">(p.get("col"), dims, "") || null : null;
  return {
    medida: um(p.get("medida"), Object.keys(MEDIDAS) as Medida[], ESCOLHA_PADRAO.medida),
    linhas,
    colunas: colunas === linhas ? null : colunas,
    periodo: um(p.get("periodo"), Object.keys(PERIODOS) as PresetPeriodo[], ESCOLHA_PADRAO.periodo),
    de: ISO.test(p.get("de") ?? "") ? p.get("de")! : "",
    ate: ISO.test(p.get("ate") ?? "") ? p.get("ate")! : "",
    comparar: p.get("comparar") === "1",
    equipe: um(p.get("equipe"), ["todas", "corrida", "bicicleta"] as const, "todas"),
    criterio: p.get("criterio") ?? "",
    tipo: um<TipoLancamento | "">(p.get("tipo"), TIPOS, ""),
    sexo: um(p.get("sexo"), ["todos", "M", "F"] as const, "todos"),
    somenteAtivos: p.get("ativos") !== "0",
    modo: um(p.get("modo"), ["total", "media"] as const, "total"),
    minimo: numero(p.get("min")),
    top: numero(p.get("top")),
    ordem: p.get("ordem") === "variacao" ? "variacao" : "valor",
  };
}

/** Só o que difere do padrão vai para a URL: o link fica curto. */
export function escreverEscolha(e: EscolhaAnalise): string {
  const p = new URLSearchParams();
  const d = ESCOLHA_PADRAO;
  if (e.medida !== d.medida) p.set("medida", e.medida);
  if (e.linhas !== d.linhas) p.set("por", e.linhas);
  if (e.colunas) p.set("col", e.colunas);
  if (e.periodo !== d.periodo) p.set("periodo", e.periodo);
  if (e.periodo === "personalizado") {
    if (e.de) p.set("de", e.de);
    if (e.ate) p.set("ate", e.ate);
  }
  if (e.comparar) p.set("comparar", "1");
  if (e.equipe !== d.equipe) p.set("equipe", e.equipe);
  if (e.criterio) p.set("criterio", e.criterio);
  if (e.tipo) p.set("tipo", e.tipo);
  if (e.sexo !== d.sexo) p.set("sexo", e.sexo);
  if (!e.somenteAtivos) p.set("ativos", "0");
  if (e.modo !== d.modo) p.set("modo", e.modo);
  if (e.minimo != null) p.set("min", String(e.minimo));
  if (e.top != null) p.set("top", String(e.top));
  if (e.ordem !== d.ordem) p.set("ordem", e.ordem);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export interface TrimestreSimples {
  nome: string;
  inicio: string;
  fim: string;
}

function ultimoDia(competencia: string) {
  const [a, m] = competencia.split("-").map(Number);
  return `${competencia}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
}

function mesDeslocado(hoje: string, delta: number) {
  const [a, m] = hoje.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Trimestre civil (jan–mar, abr–jun…) quando não há calendário de premiação. */
function trimestreCivil(hoje: string, delta: number): TrimestreSimples {
  const [a, m] = hoje.split("-").map(Number);
  const indice = Math.floor((m - 1) / 3) + delta;
  const ano = a + Math.floor(indice / 4);
  const q = ((indice % 4) + 4) % 4;
  const ini = `${ano}-${String(q * 3 + 1).padStart(2, "0")}`;
  const fim = `${ano}-${String(q * 3 + 3).padStart(2, "0")}`;
  return { nome: `${q + 1}º trimestre de ${ano}`, inicio: `${ini}-01`, fim: ultimoDia(fim) };
}

function trimestreDoCalendario(trimestres: readonly TrimestreSimples[], hoje: string, delta: 0 | -1): TrimestreSimples | null {
  const ordenados = [...trimestres].sort((a, b) => a.inicio.localeCompare(b.inicio));
  // Fora de qualquer trimestre (entre um e outro), o "atual" é o último que terminou.
  const atual = ordenados.findIndex((t) => t.inicio <= hoje && t.fim >= hoje);
  const base = atual >= 0 ? atual : ordenados.filter((t) => t.fim < hoje).length - 1;
  return ordenados[base + delta] ?? null;
}

export interface PeriodoResolvido {
  periodo: Periodo;
  anterior: Periodo | null;
  /** "3º trimestre de 2026", "outubro de 2026", "01/07/2026 a 15/08/2026". */
  titulo: string;
  tituloAnterior: string | null;
  /** O período ainda não terminou: vai até hoje, e o anterior fica com o mesmo número de dias. */
  emAndamento: boolean;
}

function diasEntre(de: string, ate: string) {
  const ms = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((ms(ate) - ms(de)) / 86400000) + 1;
}

function somarDias(iso: string, dias: number) {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + dias));
  return d.toISOString().slice(0, 10);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (competencia: string) => `${MESES[Number(competencia.slice(5, 7)) - 1]} de ${competencia.slice(0, 4)}`;
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

function tituloDe(p: Periodo) {
  if (p.de.endsWith("-01") && p.ate === ultimoDia(p.ate.slice(0, 7))) {
    if (p.de.slice(0, 7) === p.ate.slice(0, 7)) return nomeMes(p.de.slice(0, 7));
    if (p.de.slice(5) === "01-01" && p.ate.slice(5) === "12-31" && p.de.slice(0, 4) === p.ate.slice(0, 4)) return p.de.slice(0, 4);
    return `${MESES[Number(p.de.slice(5, 7)) - 1]} a ${nomeMes(p.ate.slice(0, 7))}`;
  }
  return `${dataBr(p.de)} a ${dataBr(p.ate)}`;
}

/**
 * Datas do período escolhido e do anterior (para comparar). Trimestres seguem o
 * calendário de premiação; sem calendário, os trimestres civis. O período
 * corrente vai até hoje (não conta dias que ainda não aconteceram).
 */
export function resolverPeriodo(e: Pick<EscolhaAnalise, "periodo" | "de" | "ate" | "comparar">, hoje: string, trimestres: readonly TrimestreSimples[]): PeriodoResolvido {
  let periodo: Periodo;
  let anterior: Periodo | null = null;
  let titulo: string | null = null;
  let tituloAnterior: string | null = null;
  const ano = hoje.slice(0, 4);

  switch (e.periodo) {
    case "mes":
      periodo = { de: `${hoje.slice(0, 7)}-01`, ate: ultimoDia(hoje.slice(0, 7)) };
      break;
    case "mesPassado": {
      const m = mesDeslocado(hoje, -1);
      periodo = { de: `${m}-01`, ate: ultimoDia(m) };
      break;
    }
    case "trimestre":
    case "trimestrePassado": {
      const delta = e.periodo === "trimestre" ? 0 : -1;
      const t = (trimestres.length ? trimestreDoCalendario(trimestres, hoje, delta) : null) ?? trimestreCivil(hoje, delta);
      periodo = { de: t.inicio, ate: t.fim };
      titulo = t.nome;
      const antes = (trimestres.length ? trimestreDoCalendario(trimestres, t.inicio, -1) : null) ?? (trimestres.length ? null : trimestreCivil(hoje, delta - 1));
      if (antes) {
        anterior = { de: antes.inicio, ate: antes.fim };
        tituloAnterior = antes.nome;
      }
      break;
    }
    case "ano":
      periodo = { de: `${ano}-01-01`, ate: `${ano}-12-31` };
      break;
    case "anoPassado":
      periodo = { de: `${Number(ano) - 1}-01-01`, ate: `${Number(ano) - 1}-12-31` };
      break;
    case "personalizado": {
      const de = e.de || `${hoje.slice(0, 7)}-01`;
      const ate = e.ate && e.ate >= de ? e.ate : hoje;
      periodo = { de, ate };
      break;
    }
  }

  titulo ??= tituloDe(periodo);
  if (e.comparar) {
    anterior ??= periodoAnterior(periodo);
    tituloAnterior ??= tituloDe(anterior);
  } else {
    anterior = null;
    tituloAnterior = null;
  }

  // Período em andamento: conta só até hoje. Comparar o trimestre pela metade
  // com o anterior inteiro deixaria todo mundo "caindo"; o anterior fica com
  // o mesmo número de dias, contados do começo dele.
  const emAndamento = periodo.de <= hoje && periodo.ate > hoje;
  if (emAndamento) {
    periodo = { de: periodo.de, ate: hoje };
    if (anterior) {
      const dias = diasEntre(periodo.de, hoje);
      const ate = somarDias(anterior.de, dias - 1);
      if (ate < anterior.ate) {
        anterior = { de: anterior.de, ate };
        tituloAnterior = `${tituloAnterior} (primeiros ${dias} dias)`;
      }
      titulo = `${titulo} (até hoje)`;
    }
  }
  return { periodo, anterior, titulo, tituloAnterior, emAndamento };
}

export function configDaEscolha(e: EscolhaAnalise, p: PeriodoResolvido): ConfigAnalise {
  return {
    medida: e.medida,
    linhas: e.linhas,
    colunas: e.colunas,
    periodo: p.periodo,
    anterior: e.colunas ? null : p.anterior,
    equipe: e.equipe,
    criterios: e.criterio ? [e.criterio] : [],
    tipos: e.tipo ? [e.tipo] : [],
    sexo: e.sexo,
    somenteAtivos: e.somenteAtivos,
    modo: e.modo,
    minimo: e.minimo,
    top: e.top,
    ordem: e.comparar ? e.ordem : "valor",
  };
}

/* ---------- Análises prontas ---------- */

export interface AnalisePronta {
  id: string;
  titulo: string;
  descricao: string;
  escolha: Partial<EscolhaAnalise>;
}

export const PRONTAS: AnalisePronta[] = [
  { id: "mais-treinos", titulo: "Quem mais treinou", descricao: "Treinos por atleta no trimestre", escolha: { medida: "treinos", linhas: "atleta", periodo: "trimestre" } },
  { id: "evolucao", titulo: "Maior evolução", descricao: "Quem mais aumentou os treinos em relação ao trimestre anterior", escolha: { medida: "treinos", linhas: "atleta", periodo: "trimestre", comparar: true, ordem: "variacao" } },
  { id: "aderencia", titulo: "Aderência", descricao: "Treinos feitos ÷ previstos, por atleta", escolha: { medida: "aderencia", linhas: "atleta", periodo: "trimestre" } },
  { id: "constancia", titulo: "Constância no ano", descricao: "Treinos de cada atleta, mês a mês", escolha: { medida: "treinos", linhas: "atleta", colunas: "mes", periodo: "ano" } },
  { id: "km", titulo: "Mais quilômetros", descricao: "Km por atleta no ano", escolha: { medida: "km", linhas: "atleta", periodo: "ano" } },
  { id: "provas", titulo: "Provas", descricao: "Participações em eventos no ano", escolha: { medida: "provas", linhas: "atleta", periodo: "ano", minimo: 1 } },
  { id: "modalidades", titulo: "Corrida × Bike", descricao: "Média de treinos por atleta, mês a mês", escolha: { medida: "treinos", linhas: "mes", colunas: "equipe", periodo: "ano", modo: "media" } },
  { id: "dias", titulo: "Dias de treino", descricao: "Em que dias da semana mais se treina", escolha: { medida: "treinos", linhas: "diaSemana", periodo: "ano" } },
  { id: "criterios", titulo: "Critérios mais lançados", descricao: "Lançamentos por critério no ano", escolha: { medida: "lancamentos", linhas: "criterio", periodo: "ano" } },
  { id: "perfil", titulo: "Participação por perfil", descricao: "Atletas que treinaram, por faixa etária e sexo", escolha: { medida: "atletas", linhas: "faixaEtaria", colunas: "sexo", periodo: "ano" } },
];

export function prontaAtiva(e: EscolhaAnalise): string | null {
  for (const p of PRONTAS) {
    const alvo = { ...ESCOLHA_PADRAO, ...p.escolha };
    if ((Object.keys(alvo) as (keyof EscolhaAnalise)[]).every((k) => alvo[k] === e[k])) return p.id;
  }
  return null;
}
