import assert from "node:assert/strict";
import test from "node:test";
import { formatDecimal, formatKm, plural } from "../src/lib/format";

test("formatDecimal e formatKm usam vírgula decimal", () => {
  assert.equal(formatDecimal(0), "0,0");
  assert.equal(formatDecimal(12.345), "12,3");
  assert.equal(formatDecimal(1234.5), "1.234,5");
  assert.equal(formatKm(10), "10,0 km");
  assert.equal(formatDecimal(Number.NaN), "0,0");
});

test("plural escolhe singular só para 1", () => {
  assert.equal(plural(0, "treino"), "0 treinos");
  assert.equal(plural(1, "treino"), "1 treino");
  assert.equal(plural(3, "treino"), "3 treinos");
  assert.equal(plural(1, "solicitação", "solicitações"), "1 solicitação");
  assert.equal(plural(2, "solicitação", "solicitações"), "2 solicitações");
});
