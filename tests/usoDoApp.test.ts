import { test } from "node:test";
import assert from "node:assert/strict";
import { faixaDeUso, mensagemDeConvite, resumoDeUso, textoUltimoUso, type PessoaUso } from "../src/lib/usoDoApp";

const agora = Date.parse("2026-11-16T12:00:00Z");
const dias = (n: number) => new Date(agora - n * 86_400_000).toISOString();
const p = (ultimoUso: string | null, temConta = true, notificacoes = false): PessoaUso => ({
  atletaId: "x", nome: "Ana Souza", email: null, equipe: "corrida", ativo: true, temConta, ultimoUso, contaCriadaEm: null, notificacoes,
});

test("faixas de uso", () => {
  assert.equal(faixaDeUso(p(dias(0.2)), agora), "semana");
  assert.equal(faixaDeUso(p(dias(7)), agora), "semana");
  assert.equal(faixaDeUso(p(dias(20)), agora), "mes");
  assert.equal(faixaDeUso(p(dias(31)), agora), "sumido");
  assert.equal(faixaDeUso(p(null, false), agora), "nunca");
  assert.equal(faixaDeUso(p(null, true), agora), "nunca");
});

test("texto do último uso", () => {
  assert.equal(textoUltimoUso(p(dias(0.2)), agora), "Usou hoje");
  assert.equal(textoUltimoUso(p(dias(1.2)), agora), "Usou ontem");
  assert.equal(textoUltimoUso(p(dias(5)), agora), "Usou há 5 dias");
  assert.equal(textoUltimoUso(p(dias(21)), agora), "Usou há 3 semanas");
  assert.equal(textoUltimoUso(p(dias(95)), agora), "Usou há 3 meses");
  assert.equal(textoUltimoUso(p(null, false), agora), "Ainda não tem login");
});

test("resumo e convite", () => {
  const r = resumoDeUso([p(dias(1), true, true), p(dias(40)), p(null, false)], agora);
  assert.deepEqual(r, { total: 3, comLogin: 2, semLogin: 1, semana: 1, mes: 0, sumido: 1, nunca: 1, notificacoes: 1 });
  assert.match(mensagemDeConvite("Ana Souza", "https://x.app"), /^Oi, Ana!/);
});
