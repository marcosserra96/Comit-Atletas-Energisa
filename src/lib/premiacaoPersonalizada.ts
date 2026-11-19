import { executarAnalise, mesesDoPeriodo, MEDIDAS, type ConfigAnalise, type DadosAnalise } from "@/lib/analises/motor";
import { formatNumero, formatPontos } from "@/lib/format";

/**
 * Premiação com critérios do comitê: "Atleta do ano = 60% pontos + 40%
 * treinos por mês". Cada critério vira uma nota de 0 a 100 (quem tem o maior
 * valor ganha 100, os outros, proporcional) e a nota final é a média
 * ponderada pelos pesos. Usa o mesmo motor das Análises, então os números
 * batem com o ranking.
 */

export type MedidaDoPremio = "pontos" | "treinos" | "km" | "provas" | "aderencia" | "mesesComTreino" | "maiorDistancia";
export type ExibicaoDoCriterio = "total" | "mediaMensal";
export type EquipeDoPremio = "todas" | "separadas" | "corrida" | "bicicleta";

export interface CriterioPremio {
  id: string;
  medida: MedidaDoPremio;
  /** Peso em %. Os pesos não precisam somar 100: a nota usa a proporção entre eles. */
  peso: number;
  /** Treinos, pontos, km e provas podem aparecer como média por mês (não muda a ordem). */
  exibir: ExibicaoDoCriterio;
}

export interface PremioPersonalizado {
  id: string;
  /** "Atleta do ano". */
  titulo: string;
  periodo: "reuniao" | "ano";
  equipe: EquipeDoPremio;
  sexo: "todos" | "F" | "M";
  /** Quantas colocações vão ao pódio (1 a 3). */
  quantidade: number;
  criterios: CriterioPremio[];
}

export const MEDIDAS_DO_PREMIO: readonly MedidaDoPremio[] = ["pontos", "treinos", "km", "provas", "mesesComTreino", "aderencia", "maiorDistancia"];
/** Medidas que somam ao longo do tempo: fazem sentido como média por mês. */
export const MEDIDAS_COM_MEDIA: readonly MedidaDoPremio[] = ["pontos", "treinos", "km", "provas"];
export const MAX_CRITERIOS = 4;

const UNIDADE: Record<MedidaDoPremio, { um: string; varios: string }> = {
  pontos: { um: "ponto", varios: "pontos" },
  treinos: { um: "treino", varios: "treinos" },
  km: { um: "km", varios: "km" },
  provas: { um: "prova", varios: "provas" },
  aderencia: { um: "de aderência", varios: "de aderência" },
  mesesComTreino: { um: "mês com treino", varios: "meses com treino" },
  maiorDistancia: { um: "km no mais longo", varios: "km no mais longo" },
};

/** Nome do critério nas telas e no slide: "Pontos", "Treinos por mês". */
export function rotuloDoCriterio(c: Pick<CriterioPremio, "medida" | "exibir">) {
  const base = MEDIDAS[c.medida].rotulo;
  return c.exibir === "mediaMensal" && MEDIDAS_COM_MEDIA.includes(c.medida) ? `${base} por mês` : base;
}

/** Valor já pronto para ler: "1.240 pontos", "14,2 treinos/mês", "87% de aderência". */
export function textoDoValor(c: Pick<CriterioPremio, "medida" | "exibir">, valor: number) {
  const u = UNIDADE[c.medida];
  if (c.medida === "aderencia") return `${formatNumero(valor, 0)}% ${u.um}`;
  const media = c.exibir === "mediaMensal" && MEDIDAS_COM_MEDIA.includes(c.medida);
  const numero = c.medida === "pontos" && !media ? formatPontos(valor) : formatNumero(valor, media || c.medida === "km" || c.medida === "maiorDistancia" ? 1 : 0);
  if (media) return `${numero} ${u.varios}/mês`;
  return `${numero} ${valor === 1 ? u.um : u.varios}`;
}

function novoId(prefixo: string) {
  return `${prefixo}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface ModeloDePremio {
  id: string;
  titulo: string;
  descricao: string;
  periodo: PremioPersonalizado["periodo"];
  criterios: Omit<CriterioPremio, "id">[];
}

/** Pontos de partida: o comitê escolhe um e ajusta. */
export const MODELOS_DE_PREMIO: readonly ModeloDePremio[] = [
  {
    id: "atleta-do-ano",
    titulo: "Atleta do ano",
    descricao: "Pontuação (60%) e constância nos treinos (40%)",
    periodo: "ano",
    criterios: [
      { medida: "pontos", peso: 60, exibir: "total" },
      { medida: "treinos", peso: 40, exibir: "mediaMensal" },
    ],
  },
  {
    id: "mais-constante",
    titulo: "Mais constante",
    descricao: "Meses com treino (50%) e aderência à agenda (50%)",
    periodo: "ano",
    criterios: [
      { medida: "mesesComTreino", peso: 50, exibir: "total" },
      { medida: "aderencia", peso: 50, exibir: "total" },
    ],
  },
  {
    id: "mais-km",
    titulo: "Rei dos quilômetros",
    descricao: "Km no período (70%) e o treino mais longo (30%)",
    periodo: "reuniao",
    criterios: [
      { medida: "km", peso: 70, exibir: "total" },
      { medida: "maiorDistancia", peso: 30, exibir: "total" },
    ],
  },
  {
    id: "mais-completo",
    titulo: "Atleta completo",
    descricao: "Pontos (40%), treinos (30%) e provas (30%)",
    periodo: "reuniao",
    criterios: [
      { medida: "pontos", peso: 40, exibir: "total" },
      { medida: "treinos", peso: 30, exibir: "total" },
      { medida: "provas", peso: 30, exibir: "total" },
    ],
  },
];

export function novoPremio(modeloId = "atleta-do-ano"): PremioPersonalizado {
  const m = MODELOS_DE_PREMIO.find((x) => x.id === modeloId) ?? MODELOS_DE_PREMIO[0];
  return {
    id: novoId("p"),
    titulo: m.titulo,
    periodo: m.periodo,
    equipe: "separadas",
    sexo: "todos",
    quantidade: 3,
    criterios: m.criterios.map((c) => ({ ...c, id: novoId("c") })),
  };
}

export function novoCriterio(usadas: readonly MedidaDoPremio[]): CriterioPremio {
  const medida = MEDIDAS_DO_PREMIO.find((m) => !usadas.includes(m)) ?? "pontos";
  return { id: novoId("c"), medida, peso: 20, exibir: "total" };
}

/** Os pesos em proporção (somam 100), para mostrar e para a nota. */
export function pesosNormalizados(criterios: readonly Pick<CriterioPremio, "peso">[]) {
  const soma = criterios.reduce((s, c) => s + Math.max(0, c.peso), 0);
  return criterios.map((c) => (soma > 0 ? (Math.max(0, c.peso) / soma) * 100 : 100 / Math.max(1, criterios.length)));
}

/** Limpa o que veio do navegador (servidor). */
export function validarPremio(entrada: unknown): PremioPersonalizado | null {
  const e = (entrada ?? {}) as Partial<PremioPersonalizado>;
  if (typeof e.id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(e.id)) return null;
  const vistos = new Set<string>();
  const criterios = (Array.isArray(e.criterios) ? e.criterios : [])
    .filter((c): c is CriterioPremio => !!c && MEDIDAS_DO_PREMIO.includes(c.medida))
    .filter((c) => !vistos.has(c.medida) && !!vistos.add(c.medida))
    .slice(0, MAX_CRITERIOS)
    .map((c) => ({
      id: typeof c.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(c.id) ? c.id : novoId("c"),
      medida: c.medida,
      peso: Math.min(100, Math.max(0, Math.round(Number(c.peso) || 0))),
      exibir: c.exibir === "mediaMensal" && MEDIDAS_COM_MEDIA.includes(c.medida) ? ("mediaMensal" as const) : ("total" as const),
    }));
  return {
    id: e.id,
    titulo: (typeof e.titulo === "string" ? e.titulo.trim().slice(0, 60) : "") || "Premiação",
    periodo: e.periodo === "ano" ? "ano" : "reuniao",
    equipe: e.equipe === "todas" || e.equipe === "corrida" || e.equipe === "bicicleta" ? e.equipe : "separadas",
    sexo: e.sexo === "F" || e.sexo === "M" ? e.sexo : "todos",
    quantidade: Math.min(3, Math.max(1, Math.round(Number(e.quantidade) || 3))),
    criterios: criterios.length ? criterios : [{ id: novoId("c"), medida: "pontos", peso: 100, exibir: "total" }],
  };
}

// ---------- cálculo ----------

export interface ColocadoPremio {
  posicao: number;
  id: string;
  nome: string;
  equipe: "corrida" | "bicicleta";
  fotoVersao?: number;
  /** Nota final, 0 a 100, com uma casa. */
  nota: number;
  /** Valor de cada critério, na ordem dos critérios (já dividido pelos meses quando é média). */
  valores: number[];
}

export interface GrupoDoPremio {
  /** Equipe do pódio ("todas" quando corrida e bike concorrem juntas). */
  equipe: "todas" | "corrida" | "bicicleta";
  /** Do 1º em diante, todos com nota acima de zero. */
  classificacao: ColocadoPremio[];
}

export interface ResultadoPremio {
  grupos: GrupoDoPremio[];
  /** Meses usados na média por mês (do início do período até o fim ou até hoje). */
  meses: number;
  periodo: { nome: string; inicio: string; fim: string };
}

/** Meses do período que já começaram: a "média por mês" divide por eles. */
export function mesesParaMedia(periodo: { inicio: string; fim: string }, hoje: string) {
  const ate = periodo.fim < hoje ? periodo.fim : hoje;
  if (ate < periodo.inicio) return 1;
  return Math.max(1, mesesDoPeriodo({ de: periodo.inicio, ate }).length);
}

export function calcularPremio(premio: PremioPersonalizado, dados: DadosAnalise, periodo: { nome: string; inicio: string; fim: string }): ResultadoPremio {
  const meses = mesesParaMedia(periodo, dados.hoje);
  const equipes: GrupoDoPremio["equipe"][] = premio.equipe === "separadas" ? ["corrida", "bicicleta"] : [premio.equipe];
  const pesos = pesosNormalizados(premio.criterios);
  const porId = new Map(dados.atletas.map((a) => [a.id, a]));
  const grupos = equipes.map((equipe): GrupoDoPremio => {
    const valores = new Map<string, number[]>();
    premio.criterios.forEach((c, i) => {
      const cfg: ConfigAnalise = {
        medida: c.medida,
        linhas: "atleta",
        colunas: null,
        periodo: { de: periodo.inicio, ate: periodo.fim },
        anterior: null,
        equipe,
        criterios: [],
        tipos: [],
        sexo: premio.sexo,
        somenteAtivos: true,
        modo: "total",
        minimo: null,
        top: null,
      };
      for (const l of executarAnalise(cfg, dados).linhas) {
        const v = l.valor ?? 0;
        if (!valores.has(l.chave)) valores.set(l.chave, premio.criterios.map(() => 0));
        valores.get(l.chave)![i] = c.exibir === "mediaMensal" && MEDIDAS_COM_MEDIA.includes(c.medida) ? Math.round((v / meses) * 10) / 10 : v;
      }
    });
    const maximos = premio.criterios.map((_, i) => Math.max(0, ...[...valores.values()].map((v) => v[i])));
    // Desempate: os critérios do maior peso para o menor, depois o nome.
    const ordemDesempate = premio.criterios.map((_, i) => i).sort((a, b) => pesos[b] - pesos[a] || a - b);
    const lista = [...valores.entries()]
      .map(([id, v]) => {
        const nota = v.reduce((s, x, i) => s + (maximos[i] > 0 ? (x / maximos[i]) * pesos[i] : 0), 0);
        const a = porId.get(id);
        return { id, nome: a?.nome ?? "Atleta", equipe: a?.equipe === "bicicleta" ? ("bicicleta" as const) : ("corrida" as const), fotoVersao: a?.fotoVersao, nota: Math.round(nota * 10) / 10, notaExata: nota, valores: v };
      })
      .filter((x) => x.notaExata > 0)
      .sort((a, b) => b.notaExata - a.notaExata || ordemDesempate.reduce((r, i) => r || b.valores[i] - a.valores[i], 0) || a.nome.localeCompare(b.nome, "pt-BR"));
    return {
      equipe,
      classificacao: lista.map((x, i) => ({ posicao: i + 1, id: x.id, nome: x.nome, equipe: x.equipe, fotoVersao: x.fotoVersao, nota: x.nota, valores: x.valores })),
    };
  });
  return { grupos, meses, periodo };
}
