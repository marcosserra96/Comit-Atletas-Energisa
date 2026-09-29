import assert from "node:assert/strict";
import test from "node:test";
import { CAPACIDADE, paginar, rotuloPeriodo, separarPodio, type LinhaRanking } from "../src/lib/informativo";
import { calcularPosicoesRanking } from "../src/lib/rankingPosition";

function ranking(pontos: number[]): LinhaRanking[] {
  const pos = calcularPosicoesRanking(pontos);
  return pontos.map((p, i) => ({ id: `a${i}`, nome: `Atleta ${i}`, posicao: pos[i], pontos: p, treinos: 0, km: 0, aderencia: null }));
}

test("pódio sem empate: 1º, 2º e 3º, o resto vai para a tabela", () => {
  const { podio, restantes } = separarPodio(ranking([50, 40, 30, 20, 10]));
  assert.deepEqual(podio.map((d) => [d.posicao, d.atletas.length]), [[1, 1], [2, 1], [3, 1]]);
  assert.deepEqual(restantes.map((l) => l.posicao), [4, 5]);
});

test("empate no 1º: dois no mesmo degrau, sem 2º lugar", () => {
  const { podio, restantes } = separarPodio(ranking([50, 50, 30, 20]));
  assert.deepEqual(podio.map((d) => [d.posicao, d.atletas.length]), [[1, 2], [3, 1]]);
  assert.deepEqual(restantes.map((l) => l.posicao), [4]);
});

test("mais empatados do que cabem no degrau seguem na tabela com a mesma posição", () => {
  const { podio, restantes } = separarPodio(ranking([50, 40, 40, 40, 10]));
  assert.deepEqual(podio.map((d) => [d.posicao, d.atletas.length]), [[1, 1], [2, 2]]);
  assert.deepEqual(restantes.map((l) => l.posicao), [2, 5]);
});

test("quem não pontuou não sobe ao pódio", () => {
  const { podio } = separarPodio(ranking([10, 0, 0]));
  assert.deepEqual(podio.map((d) => d.posicao), [1]);
});

test("paginação não deixa ninguém de fora", () => {
  const r = ranking(Array.from({ length: 60 }, (_, i) => 100 - i));
  for (const formato of ["paisagem", "vertical"] as const) {
    const paginas = paginar(r, formato);
    const total = paginas.reduce((s, p) => s + p.linhas.length + (p.podio?.reduce((x, d) => x + d.atletas.length, 0) ?? 0), 0);
    assert.equal(total, 60);
    assert.equal(paginas[0].linhas.length, CAPACIDADE[formato].primeira);
    assert.ok(paginas.every((p) => p.total === paginas.length));
    // Continuações equilibradas: nenhuma com muito menos que as outras.
    const cont = paginas.slice(1).map((p) => p.linhas.length);
    assert.ok(Math.max(...cont) - Math.min(...cont) <= 1);
  }
});

test("rótulo do período", () => {
  assert.equal(rotuloPeriodo({ de: "2026-09", ate: "2026-09" }), "Setembro 2026");
  assert.equal(rotuloPeriodo({ de: "2026-07", ate: "2026-09" }), "Julho a Setembro 2026");
  assert.equal(rotuloPeriodo({ de: "2025-11", ate: "2026-02" }), "Nov 2025 a Fev 2026");
});

test("sem pontuação no período sai só a capa", () => {
  const paginas = paginar(ranking([0, 0, 0, 0]), "vertical");
  assert.equal(paginas.length, 1);
  assert.equal(paginas[0].linhas.length, 0);
});
