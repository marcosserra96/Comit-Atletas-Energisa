import { test } from "node:test";
import assert from "node:assert/strict";
import { ateTerceiroLugar, calcularPosicoesRanking, montarPodio } from "../src/lib/rankingPosition";

const lista = (pontos: number[]) => {
  const posicoes = calcularPosicoesRanking(pontos);
  return pontos.map((p, i) => ({ id: `a${i}`, pontos: p, posicao: posicoes[i] }));
};

test("caso da tela: 23, 21, 21, 20 → 1º, 2º dividido e o 3º aparece", () => {
  const podio = montarPodio(lista([23, 21, 21, 20, 16]), (a) => a.posicao, (a) => a.pontos);
  assert.deepEqual(
    podio.map((d) => [d.posicao, d.atletas.map((a) => a.id), d.total]),
    [
      [1, ["a0"], 1],
      [2, ["a1", "a2"], 2],
      [3, ["a3"], 1],
    ],
  );
});

test("empate de 3 no 1º: até 2 nomes no degrau, o total conta todos", () => {
  const podio = montarPodio(lista([10, 10, 10, 8, 5]), (a) => a.posicao, (a) => a.pontos);
  assert.equal(podio[0].total, 3);
  assert.equal(podio[0].atletas.length, 2);
  assert.deepEqual(podio.map((d) => d.posicao), [1, 2, 3]);
});

test("quem não pontuou não sobe ao pódio", () => {
  const podio = montarPodio(lista([5, 0, 0]), (a) => a.posicao, (a) => a.pontos);
  assert.deepEqual(podio.map((d) => d.posicao), [1]);
});

test("do 1º ao 3º lugar inclui todos os empatados (com limite)", () => {
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
  assert.deepEqual(ids(ateTerceiroLugar(lista([23, 21, 21, 20, 16]), (a) => a.pontos)), ["a0", "a1", "a2", "a3"]);
  assert.deepEqual(ids(ateTerceiroLugar(lista([9, 0, 0]), (a) => a.pontos)), ["a0"]);
  assert.equal(ateTerceiroLugar(lista([5, 5, 5, 5, 5, 5, 5, 5]), (a) => a.pontos).length, 6);
});
