import assert from "node:assert/strict";
import test from "node:test";
import { contraste, CONTRASTE_MINIMO, corLegivel, variacoesLegiveis } from "../src/lib/branding";

test("contraste: preto sobre branco é 21 e cor igual é 1", () => {
  assert.equal(Math.round(contraste("#000000", "#ffffff")), 21);
  assert.equal(contraste("#009bc1", "#009bc1"), 1);
});

test("corLegivel: mantém a cor quando ela já passa no contraste", () => {
  assert.equal(corLegivel("#1a202c", "#ffffff"), "#1a202c");
});

test("variacoesLegiveis: as cores da marca padrão ficam AA nos dois temas", () => {
  for (const cor of ["#009bc1", "#00b37e", "#f37021", "#e63946"]) {
    const { claro, escuro } = variacoesLegiveis(cor);
    assert.ok(contraste(claro, "#f0f4f8") >= CONTRASTE_MINIMO, `${cor} claro sobre o fundo`);
    assert.ok(contraste("#ffffff", claro) >= CONTRASTE_MINIMO, `texto branco sobre ${cor} claro`);
    assert.ok(contraste(escuro, "#161921") >= CONTRASTE_MINIMO, `${cor} escuro sobre o card`);
  }
});

test("variacoesLegiveis: cores muito claras escolhidas no painel também ficam legíveis", () => {
  const { claro } = variacoesLegiveis("#ffe066");
  assert.ok(contraste(claro, "#f0f4f8") >= CONTRASTE_MINIMO);
});
