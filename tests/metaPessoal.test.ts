import { test } from "node:test";
import assert from "node:assert/strict";
import { competenciaPermitida, progressoDaMeta, sugestoesDeMeta, validarMetaPessoal } from "../src/lib/metaPessoal";

test("validação da meta", () => {
  assert.deepEqual(validarMetaPessoal({ tipo: "km", valor: "60" }), { meta: { tipo: "km", valor: 60 } });
  assert.ok("erro" in validarMetaPessoal({ tipo: "km", valor: 0 }));
  assert.ok("erro" in validarMetaPessoal({ tipo: "km", valor: 12.5 }));
  assert.ok("erro" in validarMetaPessoal({ tipo: "treinos", valor: 61 }));
  assert.ok("erro" in validarMetaPessoal({ tipo: "pace", valor: 5 }));
});

test("meta só do mês atual ou do próximo (inclusive na virada do ano)", () => {
  assert.ok(competenciaPermitida("2026-10", "2026-10-31"));
  assert.ok(competenciaPermitida("2026-11", "2026-10-31"));
  assert.ok(!competenciaPermitida("2026-09", "2026-10-31"));
  assert.ok(!competenciaPermitida("2026-12", "2026-10-31"));
  assert.ok(competenciaPermitida("2027-01", "2026-12-20"));
  assert.ok(!competenciaPermitida("2026-13", "2026-12-20"));
});

test("progresso: o que falta, nos dias que faltam, e meta batida", () => {
  const p = progressoDaMeta({ tipo: "km", valor: 60 }, { km: 38.7, treinos: 6 }, "2026-11-22");
  assert.equal(p.resumo, "38 de 60 km");
  assert.equal(p.situacao, "Faltam 22 km em 9 dias");
  assert.equal(p.concluida, false);
  const t = progressoDaMeta({ tipo: "treinos", valor: 10 }, { km: 0, treinos: 9 }, "2026-11-30");
  assert.equal(t.situacao, "Faltam 1 treino em 1 dia");
  const batida = progressoDaMeta({ tipo: "treinos", valor: 10 }, { km: 0, treinos: 12 }, "2026-11-20");
  assert.equal(batida.concluida, true);
  assert.equal(batida.fracao, 1);
  assert.equal(batida.situacao, "Meta batida, e ainda passou 2 treinos!");
});

test("sugestões a partir do mês passado ou de um ponto de partida", () => {
  assert.deepEqual(sugestoesDeMeta("km", { km: 52, treinos: 8 }, "corrida"), [55, 60, 70]);
  assert.deepEqual(sugestoesDeMeta("km", { km: 0, treinos: 0 }, "bicicleta"), [150, 175, 200]);
  assert.deepEqual(sugestoesDeMeta("treinos", { km: 0, treinos: 9 }, "corrida"), [9, 11, 13]);
  assert.deepEqual(sugestoesDeMeta("treinos", { km: 0, treinos: 0 }, "corrida"), [8, 10, 12]);
});
