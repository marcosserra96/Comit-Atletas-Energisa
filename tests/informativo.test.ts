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

test("empate no 1º: dois no mesmo degrau e a contagem segue sem pular", () => {
  const { podio, restantes } = separarPodio(ranking([50, 50, 30, 20]));
  assert.deepEqual(podio.map((d) => [d.posicao, d.atletas.length]), [[1, 2], [2, 1], [3, 1]]);
  assert.deepEqual(restantes.map((l) => l.posicao), []);
});

test("mais empatados do que cabem no degrau seguem na tabela com a mesma posição", () => {
  const { podio, restantes } = separarPodio(ranking([50, 40, 40, 40, 10, 5]));
  assert.deepEqual(podio.map((d) => [d.posicao, d.atletas.length]), [[1, 1], [2, 2], [3, 1]]);
  assert.deepEqual(restantes.map((l) => l.posicao), [2, 4]);
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
    // Continuações cheias; só a última com nomes pode ter menos.
    const comNomes = paginas.slice(1).filter((p) => p.linhas.length > 0);
    assert.ok(comNomes.slice(0, -1).every((p) => p.linhas.length === CAPACIDADE[formato].seguintes));
  }
});

test("capa estica para não deixar poucos nomes sozinhos na página seguinte", () => {
  for (const formato of ["paisagem", "vertical"] as const) {
    const cap = CAPACIDADE[formato];
    // pódio com 3 + primeiraMax na tabela: tudo na capa, resumo na página 2
    const paginas = paginar(ranking(Array.from({ length: 3 + cap.primeiraMax }, (_, i) => 200 - i)), formato);
    assert.equal(paginas[0].linhas.length, cap.primeiraMax);
    assert.equal(paginas.length, 2);
    assert.equal(paginas[1].linhas.length, 0);
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

test("resumo do período sempre fecha a última página e nunca divide a capa", () => {
  for (const n of [4, 5, 12, 13, 14, 17, 30, 42, 60, 90]) {
    for (const formato of ["paisagem", "vertical"] as const) {
      const paginas = paginar(ranking(Array.from({ length: n }, (_, i) => 200 - i)), formato);
      const ultima = paginas.at(-1)!;
      assert.ok(paginas.length >= 2, `${formato} ${n}`);
      assert.equal(ultima.destaques, true, `${formato} ${n}`);
      assert.ok(paginas.slice(0, -1).every((p) => !p.destaques));
      assert.ok(ultima.linhas.length <= CAPACIDADE[formato].comResumo, `${formato} ${n}: ${ultima.linhas.length}`);
      const total = paginas.reduce((s, p) => s + p.linhas.length + (p.podio?.reduce((x, d) => x + d.atletas.length, 0) ?? 0), 0);
      assert.equal(total, n);
    }
  }
});
