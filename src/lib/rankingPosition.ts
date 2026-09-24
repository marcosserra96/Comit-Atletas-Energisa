/**
 * Calcula a colocação competitiva de uma lista já ordenada por pontos.
 * Empates compartilham a posição e a colocação seguinte é pulada:
 * 1º, 2º, 2º, 4º.
 */
export function calcularPosicoesRanking(
  pontuacoes: readonly number[],
): number[] {
  let posicaoAtual = 0;
  let pontuacaoAnterior: number | undefined;

  return pontuacoes.map((pontuacao, indice) => {
    if (indice === 0 || pontuacao !== pontuacaoAnterior) {
      posicaoAtual = indice + 1;
    }
    pontuacaoAnterior = pontuacao;
    return posicaoAtual;
  });
}
