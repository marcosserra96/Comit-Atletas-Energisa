import assert from "node:assert/strict";
import test from "node:test";
import {
  codigoDinamico,
  codigoValido,
  gerarCodigoFixo,
  janelaDoCheckin,
  janelaDoCodigo,
  normalizarCodigo,
  situacaoCheckin,
} from "../src/lib/reunioes";

const reuniao = { data: "2026-10-05", horaInicio: "19:00", horaFim: "20:30" };

test("janela padrão: 15 min antes do início até 30 min depois do fim (horário de Brasília)", () => {
  const { abre, fecha } = janelaDoCheckin({ ...reuniao, checkin: { ativo: true, dinamico: false } });
  assert.equal(abre.toISOString(), "2026-10-05T21:45:00.000Z");
  assert.equal(fecha.toISOString(), "2026-10-06T00:00:00.000Z");
});

test("situação respeita a janela configurada e o liga/desliga", () => {
  const checkin = { ativo: true, dinamico: false, abreEm: "2026-10-05T22:00:00.000Z", fechaEm: "2026-10-05T23:00:00.000Z" };
  assert.equal(situacaoCheckin({ ...reuniao, checkin }, new Date("2026-10-05T21:59:00Z")), "antes");
  assert.equal(situacaoCheckin({ ...reuniao, checkin }, new Date("2026-10-05T22:30:00Z")), "aberto");
  assert.equal(situacaoCheckin({ ...reuniao, checkin }, new Date("2026-10-05T23:00:00Z")), "encerrado");
  assert.equal(situacaoCheckin({ ...reuniao, checkin: { ...checkin, ativo: false } }, new Date("2026-10-05T22:30:00Z")), "desligado");
});

test("código fixo: 6 caracteres sem letras ambíguas; digitação normalizada", async () => {
  const codigo = gerarCodigoFixo();
  assert.match(codigo, /^[A-HJ-NP-Z2-9]{6}$/);
  const segredo = { segredo: "s", codigoFixo: "AB3K9Z" };
  assert.equal(normalizarCodigo(" ab3 k9-z "), "AB3K9Z");
  assert.equal(await codigoValido({ codigo: "ab3k9z", dinamico: false, segredo }), true);
  assert.equal(await codigoValido({ codigo: "AB3K9Y", dinamico: false, segredo }), false);
});

test("código dinâmico: 6 dígitos, vale a janela atual e a anterior, não a de 1 min atrás", async () => {
  const segredo = { segredo: "segredo-de-teste", codigoFixo: "AAAAAA" };
  const agora = Date.parse("2026-10-05T22:10:15Z");
  const janela = janelaDoCodigo(agora);
  const atual = await codigoDinamico(segredo.segredo, janela);
  assert.match(atual, /^\d{6}$/);
  assert.equal(await codigoValido({ codigo: atual, dinamico: true, segredo, agora }), true);
  const anterior = await codigoDinamico(segredo.segredo, janela - 1);
  assert.equal(await codigoValido({ codigo: anterior, dinamico: true, segredo, agora }), true);
  const velho = await codigoDinamico(segredo.segredo, janela - 2);
  assert.equal(await codigoValido({ codigo: velho, dinamico: true, segredo, agora }), velho === atual || velho === anterior);
  // O código fixo não vale no modo dinâmico.
  assert.equal(await codigoValido({ codigo: "AAAAAA", dinamico: true, segredo, agora }), false);
});

test("fase da reunião pelo horário de Brasília", async () => {
  const { faseDaReuniao, textoDaFase } = await import("../src/lib/reunioes");
  const r = { data: "2026-10-06", horaInicio: "19:00", horaFim: "20:00" };
  // 18:50 em Brasília = 21:50 UTC: a confirmação já abriu, mas a reunião não começou.
  assert.equal(faseDaReuniao(r, new Date("2026-10-06T21:50:00Z")), "antes");
  assert.equal(textoDaFase(r, new Date("2026-10-06T21:50:00Z")), "Começa às 19:00 · presença já liberada");
  assert.equal(faseDaReuniao(r, new Date("2026-10-06T22:00:00Z")), "agora");
  assert.equal(faseDaReuniao(r, new Date("2026-10-06T23:10:00Z")), "depois");
  assert.equal(textoDaFase(r, new Date("2026-10-06T23:10:00Z")), "Terminou às 20:00 · ainda dá para registrar");
});
