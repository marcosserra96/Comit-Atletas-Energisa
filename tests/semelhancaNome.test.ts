import assert from "node:assert/strict";
import test from "node:test";
import { buscaCombina, semelhanca, sugerirPorNome } from "../src/lib/semelhancaNome";

const cadastros = [
  "Cynara Botarro Silva Brum",
  "Caroline Bernardes de Castro",
  "Wagner Luís Porfírio Rezende",
  "Wagner Souza",
  "Marco Aurelio Vilela Sousa",
  "Raphael Ravalia de Brito",
];

test("sugere o cadastro certo pelo nome, sem acento", () => {
  const [melhor] = sugerirPorNome({ nome: "Wagner Luis Porfirio Rezende", email: "wagner.lp.rezende@gmail.com" }, cadastros, (n) => n);
  assert.equal(melhor.item, "Wagner Luís Porfírio Rezende");
  assert.ok(melhor.pontuacao > 0.8);
});

test("nome mais curto no pedido e abreviação ainda acham", () => {
  const [melhor] = sugerirPorNome({ nome: "Marco Sousa" }, cadastros, (n) => n);
  assert.equal(melhor.item, "Marco Aurelio Vilela Sousa");
  const [abreviado] = sugerirPorNome({ nome: "Raphael R. Brito" }, cadastros, (n) => n);
  assert.equal(abreviado.item, "Raphael Ravalia de Brito");
});

test("o e-mail ajuda a desempatar quem tem o mesmo primeiro nome", () => {
  const a = semelhanca({ nome: "Wagner", email: "wagner.rezende@x.com" }, "Wagner Luís Porfírio Rezende");
  const b = semelhanca({ nome: "Wagner", email: "wagner.rezende@x.com" }, "Wagner Souza");
  assert.ok(a > b);
});

test("nome sem relação não vira sugestão", () => {
  assert.deepEqual(sugerirPorNome({ nome: "Fernanda Lima" }, cadastros, (n) => n), []);
});

test("busca: todas as palavras, sem acento, em qualquer ordem", () => {
  assert.equal(buscaCombina("rezende wagner", "Wagner Luís Porfírio Rezende"), true);
  assert.equal(buscaCombina("porfirio", "Wagner Luís Porfírio Rezende"), true);
  assert.equal(buscaCombina("wagner silva", "Wagner Souza"), false);
});

test("só o sobrenome igual não vira sugestão", () => {
  assert.deepEqual(sugerirPorNome({ nome: "Carla Pendente Souza" }, ["Felipe Souza"], (n) => n), []);
});
