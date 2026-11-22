import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMAS, ORDEM_FORMATOS, cmParaPt, nomeDoArquivoTrofeu, poligonoArredondado, tamanhoImpresso, textoDaColocacao } from "../src/lib/trofeu";

test("tamanho impresso: largura pedida, altura pela forma, 300 dpi", () => {
  const t = tamanhoImpresso("facetado", 15);
  assert.deepEqual([t.larguraCm, t.alturaCm, t.larguraPx, t.alturaPx], [15, 15, 1772, 1772]);
  const taca = tamanhoImpresso("taca", 20);
  assert.equal(taca.alturaCm, 24.8);
  assert.equal(taca.larguraPx, 2362);
  assert.ok(Math.abs(taca.escala - 2.362) < 1e-9);
});

test("cm em pontos do PDF", () => {
  assert.ok(Math.abs(cmParaPt(2.54) - 72) < 1e-9);
});

test("todas as formas têm contorno fechado e conteúdo dentro da arte", () => {
  for (const f of ORDEM_FORMATOS) {
    const forma = FORMAS[f];
    assert.match(forma.contorno, /Z$/);
    assert.ok(forma.conteudo.x >= 0 && forma.conteudo.x + forma.conteudo.w <= 1000, f);
    assert.ok(forma.conteudo.y >= 0 && forma.conteudo.y + forma.conteudo.h <= forma.altura, f);
  }
});

test("polígono arredondado: um trecho por canto", () => {
  const d = poligonoArredondado([[0, 0], [100, 0], [100, 100], [0, 100]], 10);
  assert.equal((d.match(/Q/g) ?? []).length, 4);
  assert.ok(d.startsWith("M0.0 10.0 Q0 0 10.0 0.0"));
});

test("colocação e Campeão", () => {
  assert.equal(textoDaColocacao(1, true), "Campeão");
  assert.equal(textoDaColocacao(1), "1º lugar");
  assert.equal(textoDaColocacao(3, true), "3º lugar");
  assert.equal(textoDaColocacao(undefined), "");
});

test("nome do arquivo sem acento nem espaço", () => {
  assert.equal(nomeDoArquivoTrofeu(["trofeu", "Atleta do ano", "Corrida", 1, "Mariana"], "png"), "trofeu-atleta-do-ano-corrida-1-mariana.png");
  assert.equal(nomeDoArquivoTrofeu(["Pódio de Pontos", undefined, ""], "pdf"), "podio-de-pontos.pdf");
  assert.equal(nomeDoArquivoTrofeu([], "pdf"), "trofeu.pdf");
});
