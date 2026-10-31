import type { Modalidade } from "@/lib/types";

/**
 * Meta pessoal do mês: o atleta escolhe quantos km ou quantos treinos quer
 * fazer no mês e acompanha no Início. É só dele (não entra em ranking nem em
 * medalha). Fica em metas_pessoais/{atletaId}, gravado pelo servidor.
 */
export type TipoMetaPessoal = "km" | "treinos";

export interface MetaPessoal {
  tipo: TipoMetaPessoal;
  valor: number;
}

/** Competência → meta ("2026-11" → { tipo: "km", valor: 60 }). */
export type MetasPessoais = Record<string, MetaPessoal>;

export const LIMITES_META: Record<TipoMetaPessoal, { min: number; max: number }> = {
  km: { min: 1, max: 5000 },
  treinos: { min: 1, max: 60 },
};

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export function validarMetaPessoal(entrada: unknown): { meta: MetaPessoal } | { erro: string } {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const tipo = e.tipo === "km" || e.tipo === "treinos" ? e.tipo : null;
  if (!tipo) return { erro: "Escolha se a meta é em km ou em treinos." };
  const valor = Number(e.valor);
  const { min, max } = LIMITES_META[tipo];
  if (!Number.isInteger(valor) || valor < min) return { erro: "Informe a meta com um número inteiro maior que zero." };
  if (valor > max) return { erro: tipo === "km" ? `A meta pode ser de até ${max.toLocaleString("pt-BR")} km.` : `A meta pode ser de até ${max} treinos.` };
  return { meta: { tipo, valor } };
}

/** A meta só pode ser do mês atual ou do próximo (no fim do mês, já dá para planejar). */
export function competenciaPermitida(competencia: string, hoje: string) {
  if (!COMPETENCIA.test(competencia)) return false;
  const atual = hoje.slice(0, 7);
  const d = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 1));
  const proxima = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return competencia === atual || competencia === proxima;
}

export interface ProgressoDaMeta {
  atual: number;
  meta: number;
  fracao: number;
  concluida: boolean;
  falta: number;
  /** Dias que faltam no mês, contando hoje. */
  diasRestantes: number;
  /** "38 de 60 km" */
  resumo: string;
  /** "Faltam 22 km em 9 dias" / "Meta batida!" / "Faltou pouco: 4 km" */
  situacao: string;
}

const unidade = (tipo: TipoMetaPessoal, n: number) => (tipo === "km" ? "km" : n === 1 ? "treino" : "treinos");
const numero = (n: number) => n.toLocaleString("pt-BR");

export function progressoDaMeta(meta: MetaPessoal, realizado: { km: number; treinos: number }, hoje: string): ProgressoDaMeta {
  const atual = meta.tipo === "km" ? Math.floor(realizado.km) : realizado.treinos;
  const ultimoDia = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).getUTCDate();
  const diasRestantes = Math.max(0, ultimoDia - Number(hoje.slice(8, 10)) + 1);
  const falta = Math.max(0, meta.valor - atual);
  const concluida = falta === 0;
  const situacao = concluida
    ? atual > meta.valor
      ? `Meta batida, e ainda passou ${numero(atual - meta.valor)} ${unidade(meta.tipo, atual - meta.valor)}!`
      : "Meta batida!"
    : `Faltam ${numero(falta)} ${unidade(meta.tipo, falta)} em ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}`;
  return {
    atual,
    meta: meta.valor,
    fracao: Math.min(1, atual / meta.valor),
    concluida,
    falta,
    diasRestantes,
    resumo: `${numero(atual)} de ${numero(meta.valor)} ${unidade(meta.tipo, meta.valor)}`,
    situacao,
  };
}

/** Arredonda para cima no múltiplo de `passo` (5 km, 10 km…). */
const arredondar = (n: number, passo: number) => Math.max(passo, Math.ceil(n / passo) * passo);

/**
 * Três sugestões de meta a partir do mês passado: igual, um pouco mais e um
 * desafio. Sem histórico, valores de partida por modalidade.
 */
export function sugestoesDeMeta(tipo: TipoMetaPessoal, mesPassado: { km: number; treinos: number }, modalidade: Modalidade): number[] {
  if (tipo === "treinos") {
    const base = mesPassado.treinos > 0 ? mesPassado.treinos : 8;
    return [...new Set([Math.max(1, base), base + 2, base + 4].map((n) => Math.min(LIMITES_META.treinos.max, n)))];
  }
  const passo = modalidade === "bicicleta" ? 25 : 5;
  const base = mesPassado.km >= 1 ? mesPassado.km : modalidade === "bicicleta" ? 150 : 40;
  return [...new Set([arredondar(base, passo), arredondar(base * 1.15, passo), arredondar(base * 1.3, passo)])];
}
