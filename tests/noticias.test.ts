import assert from "node:assert/strict";
import test from "node:test";
import { corpoDaNoticia, noticiaVisivel } from "../src/lib/noticias";

test("notícia sem prazo fica visível", () => {
  assert.equal(noticiaVisivel({}, "2026-10-10"), true);
  assert.equal(noticiaVisivel({ visivelAte: null }, "2026-10-10"), true);
  assert.equal(noticiaVisivel({ visivelAte: "" }, "2026-10-10"), true);
});

test("notícia aparece até o último dia, inclusive", () => {
  assert.equal(noticiaVisivel({ visivelAte: "2026-10-10" }, "2026-10-09"), true);
  assert.equal(noticiaVisivel({ visivelAte: "2026-10-10" }, "2026-10-10"), true);
  assert.equal(noticiaVisivel({ visivelAte: "2026-10-10" }, "2026-10-11"), false);
});

test("corpo repetido do resumo não é mostrado de novo", () => {
  assert.equal(corpoDaNoticia({ resumo: "Olá", corpo: "Olá" }), null);
  assert.equal(corpoDaNoticia({ resumo: "Olá", corpo: " " }), null);
  assert.equal(corpoDaNoticia({ resumo: "Olá", corpo: "Texto completo" }), "Texto completo");
});
