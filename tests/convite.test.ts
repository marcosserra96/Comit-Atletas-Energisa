import { test } from "node:test";
import assert from "node:assert/strict";
import { FUNDOS, diaDaSemana, fundoCompativel, fundosDoLayout, horaCurta, nomeDoArquivo, textosDoEvento, trechos } from "../src/lib/convite";

test("destaques entre asteriscos", () => {
  assert.deepEqual(trechos("para *celebrar* e *olhar* adiante"), [
    { texto: "para ", destaque: false },
    { texto: "celebrar", destaque: true },
    { texto: " e ", destaque: false },
    { texto: "olhar", destaque: true },
    { texto: " adiante", destaque: false },
  ]);
  assert.deepEqual(trechos("sem par * aqui"), [{ texto: "sem par * aqui", destaque: false }]);
});

test("data, hora e dia da semana", () => {
  assert.equal(diaDaSemana("2026-09-23"), "quarta-feira");
  assert.equal(horaCurta("18:00"), "18h");
  assert.equal(horaCurta("07:30"), "7h30");
  assert.equal(horaCurta(undefined), "");
});

test("textos a partir do evento da agenda", () => {
  const reuniao = textosDoEvento({ titulo: "Fechamento junho a agosto", data: "2026-09-23", local: "Anfiteatro Ivan Muller", tipo: "reuniao", horaInicio: "18:00", modalidade: "ambas" });
  assert.deepEqual([reuniao.selo, reuniao.data, reuniao.diaSemana, reuniao.hora, reuniao.local], ["Fechamento junho a agosto", "23/09", "quarta-feira", "18h", "Anfiteatro Ivan Muller"]);
  const prova = textosDoEvento({ titulo: "Corrida do Sol", data: "2026-12-06", local: "Parque das Águas", modalidade: "corrida", km: 10 });
  assert.match(prova.texto, /\*10 km\*/);
  assert.equal(prova.assinatura, "Te esperamos na largada!");
});

test("nome do arquivo", () => {
  assert.equal(nomeDoArquivo("Fechamento Junho à Agosto!", "feed"), "convite-fechamento-junho-a-agosto-feed.png");
  assert.equal(nomeDoArquivo("", "story"), "convite-evento-story.png");
});

test("fundos por layout: claro com texto escuro, escuro com texto claro, foto aceita todos", () => {
  assert.ok(fundosDoLayout("celebracao").every((f) => f.tom === "claro"));
  assert.ok(fundosDoLayout("largada").every((f) => f.tom === "escuro"));
  assert.equal(fundosDoLayout("foto").length, FUNDOS.length);
  assert.equal(fundoCompativel("podio", "amanhecer-na-orla"), false);
  assert.equal(fundoCompativel("podio", "fim-de-ano"), true);
});
