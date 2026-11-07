import { test } from "node:test";
import assert from "node:assert/strict";
import { analisarDuplicidade, chaveDuplicidade } from "../src/lib/duplicidadeImportacao";

const linha = (numeroLinha: number, extra: Partial<Parameters<typeof analisarDuplicidade>[0][number]> = {}) => ({
  numeroLinha,
  atletaId: "ana",
  atletaNome: "Ana",
  equipe: "corrida" as const,
  regraId: "treino_extra",
  regraDesc: "Treino extra",
  pontos: 3,
  tipo: "avulso" as const,
  data: "2026-10-01",
  dataAproximada: true,
  ...extra,
});

test("treinos extras do mês (sem dia certo) são sessões diferentes: 3 extras entram como 3", () => {
  const r = analisarDuplicidade([linha(2), linha(3), linha(4)], []);
  assert.equal(r.validas.length, 3);
  assert.equal(r.duplicadas.length, 0);
});

test("reimportar o mês completa só o que faltou", () => {
  // O portal já tem 1 dos 3 extras (o que entrou antes da correção).
  const r = analisarDuplicidade([linha(2), linha(3), linha(4)], [chaveDuplicidade("ana", "2026-10-01", "treino_extra")]);
  assert.deepEqual(r.validas.map((v) => v.numeroLinha), [3, 4]);
  assert.equal(r.duplicadas.length, 1);
  assert.match(r.duplicadas[0].motivo, /Já lançado no portal \(1º treino extra de 10\/2026\)/);
  // Com os 3 já no portal, nada entra.
  const chave = chaveDuplicidade("ana", "2026-10-01", "treino_extra");
  assert.equal(analisarDuplicidade([linha(2), linha(3), linha(4)], [chave, chave, chave]).validas.length, 0);
});

test("lançamentos com dia certo continuam bloqueando repetição", () => {
  const exata = (n: number) => linha(n, { dataAproximada: undefined, data: "2026-10-05", regraId: "treino" });
  const r = analisarDuplicidade([exata(2), exata(3)], []);
  assert.equal(r.validas.length, 1);
  assert.match(r.duplicadas[0].motivo, /Repetida na própria planilha \(linha 2\)/);
  const r2 = analisarDuplicidade([exata(2)], new Set([chaveDuplicidade("ana", "2026-10-05", "treino")]));
  assert.match(r2.duplicadas[0].motivo, /Já existe um lançamento igual em 05\/10\/2026/);
});
