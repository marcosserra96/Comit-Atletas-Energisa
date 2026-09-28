import assert from "node:assert/strict";
import test from "node:test";
import { formatDecimal, formatKm, formatNumero, formatPontos, plural } from "../src/lib/format";

test("formatDecimal e formatKm usam vírgula decimal", () => {
  assert.equal(formatDecimal(0), "0,0");
  assert.equal(formatDecimal(12.345), "12,3");
  assert.equal(formatDecimal(1234.5), "1.234,5");
  assert.equal(formatKm(10), "10 km");
  assert.equal(formatDecimal(Number.NaN), "0,0");
});

test("plural escolhe singular só para 1", () => {
  assert.equal(plural(0, "treino"), "0 treinos");
  assert.equal(plural(1, "treino"), "1 treino");
  assert.equal(plural(3, "treino"), "3 treinos");
  assert.equal(plural(1, "solicitação", "solicitações"), "1 solicitação");
  assert.equal(plural(2, "solicitação", "solicitações"), "2 solicitações");
});

test("formatNumero corta ruído de ponto flutuante e zeros à direita", () => {
  assert.equal(formatNumero(5.2 + 3.1), "8,3");
  assert.equal(formatNumero(0.1 + 0.2), "0,3");
  assert.equal(formatNumero(10), "10");
  assert.equal(formatNumero(1234.56), "1.234,6");
  assert.equal(formatNumero(Number.NaN), "0");
  assert.equal(formatPontos(33.3333333), "33,3");
  assert.equal(formatPontos(25), "25");
  assert.equal(formatKm(12.345), "12,3 km");
  assert.equal(formatKm(0), "0 km");
});
