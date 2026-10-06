/**
 * Colocação de uma lista já ordenada por pontos. Empates dividem a posição e a
 * contagem segue sem pular: 1º, 1º, 2º, 3º (regra definida pelo comitê).
 */
export function calcularPosicoesRanking(
  pontuacoes: readonly number[],
): number[] {
  let posicaoAtual = 0;
  let pontuacaoAnterior: number | undefined;

  return pontuacoes.map((pontuacao, indice) => {
    if (indice === 0 || pontuacao !== pontuacaoAnterior) {
      posicaoAtual += 1;
    }
    pontuacaoAnterior = pontuacao;
    return posicaoAtual;
  });
}

/** Um degrau do pódio: a posição e quem divide ela. */
export interface DegrauDoPodio<T> {
  posicao: number;
  /** Até `porDegrau` nomes; os demais empatados ficam só na tabela. */
  atletas: T[];
  /** Quantos dividem a posição (inclui os que não couberam). */
  total: number;
}

/**
 * Pódio pela posição (não pelos 3 primeiros nomes): 1º, 2º e 3º lugares, com
 * empates dividindo o degrau. Só entra quem pontuou. Mesma regra do informativo.
 */
export function montarPodio<T>(
  lista: readonly T[],
  posicaoDe: (item: T) => number,
  pontosDe: (item: T) => number,
  porDegrau = 2,
): DegrauDoPodio<T>[] {
  const degraus: DegrauDoPodio<T>[] = [];
  for (const item of lista) {
    const posicao = posicaoDe(item);
    if (posicao > 3 || pontosDe(item) <= 0) break;
    let degrau = degraus.find((d) => d.posicao === posicao);
    if (!degrau) {
      degrau = { posicao, atletas: [], total: 0 };
      degraus.push(degrau);
    }
    degrau.total += 1;
    if (degrau.atletas.length < porDegrau) degrau.atletas.push(item);
  }
  return degraus;
}

/**
 * Quem ocupa do 1º ao 3º lugar numa lista já ordenada por pontos (com
 * empates, podem ser mais de 3 pessoas). Só quem pontuou; `limite` evita
 * listas enormes num empate geral.
 */
export function ateTerceiroLugar<T>(lista: readonly T[], pontosDe: (item: T) => number, limite = 6): T[] {
  const comPontos = lista.filter((item) => pontosDe(item) > 0);
  const posicoes = calcularPosicoesRanking(comPontos.map(pontosDe));
  return comPontos.filter((_, i) => posicoes[i] <= 3).slice(0, limite);
}
