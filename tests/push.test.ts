import assert from "node:assert/strict";
import test from "node:test";
import {
  atletaNoPublico,
  linkInternoValido,
  pesquisaPrecisaAvisoDeAbertura,
  pesquisaPrecisaLembrete,
  validarMensagem,
} from "../src/lib/push/regras";

const H = 60 * 60 * 1000;

test("push: só links internos do portal", () => {
  assert.equal(linkInternoValido("/pesquisas/abc123"), true);
  assert.equal(linkInternoValido("/dashboard"), true);
  assert.equal(linkInternoValido("https://golpe.com"), false);
  assert.equal(linkInternoValido("//golpe.com"), false);
  assert.equal(linkInternoValido("javascript:alert(1)"), false);
});

test("push: mensagem e público", () => {
  assert.deepEqual(validarMensagem({ titulo: "Oi", corpo: "Treino às 7h", link: "/eventos" }), []);
  assert.equal(validarMensagem({ titulo: "x".repeat(61), corpo: "", link: "/eventos" }).length, 2);
  assert.equal(atletaNoPublico("corrida", "todos"), true);
  assert.equal(atletaNoPublico("bicicleta", "corrida"), false);
  assert.equal(atletaNoPublico("fila_corrida", "todos"), false);
});

test("push: abertura e lembrete da pesquisa", () => {
  const agora = Date.parse("2026-10-10T12:00:00Z");
  const iso = (t: number) => new Date(t).toISOString();
  const longa = { abreEm: iso(agora - 4 * 24 * H), fechaEm: iso(agora + 10 * H) };
  assert.equal(pesquisaPrecisaLembrete(longa, agora), true);
  // Curta (abriu há pouco e fecha logo): só o aviso de abertura.
  const curta = { abreEm: iso(agora - 1 * H), fechaEm: iso(agora + 20 * H) };
  assert.equal(pesquisaPrecisaLembrete(curta, agora), false);
  assert.equal(pesquisaPrecisaAvisoDeAbertura(curta, agora), true);
  // Agendada para depois e quase fechando não avisam abertura.
  assert.equal(pesquisaPrecisaAvisoDeAbertura({ abreEm: iso(agora + H), fechaEm: iso(agora + 48 * H) }, agora), false);
  assert.equal(pesquisaPrecisaAvisoDeAbertura({ abreEm: iso(agora - 48 * H), fechaEm: iso(agora + 30 * 60_000) }, agora), false);
});
