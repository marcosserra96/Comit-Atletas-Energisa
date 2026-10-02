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
