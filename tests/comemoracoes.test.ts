import { test } from "node:test";
import assert from "node:assert/strict";
import { anosNoPrograma, comemoracoesDoAtleta, mensagemDaComemoracao } from "../src/lib/comemoracoes";

const base = { equipe: "corrida" as const };

test("aniversário no dia, até dois dias depois e nada no terceiro", () => {
  const a = { ...base, dataNascimento: "1990-10-16" };
  assert.deepEqual(comemoracoesDoAtleta(a, "2026-10-16"), [{ tipo: "aniversario", diasDepois: 0, data: "2026-10-16" }]);
  assert.equal(comemoracoesDoAtleta(a, "2026-10-18")[0].diasDepois, 2);
  assert.deepEqual(comemoracoesDoAtleta(a, "2026-10-19"), []);
  assert.deepEqual(comemoracoesDoAtleta(a, "2026-10-15"), []);
});

test("29 de fevereiro comemora em 28 nos anos comuns", () => {
  const a = { ...base, dataNascimento: "2000-02-29" };
  assert.equal(comemoracoesDoAtleta(a, "2027-02-28")[0].diasDepois, 0);
  assert.equal(comemoracoesDoAtleta(a, "2028-02-29")[0].diasDepois, 0);
});

test("parabéns atrasado na virada do ano", () => {
  const a = { ...base, dataNascimento: "1985-12-31" };
  assert.equal(comemoracoesDoAtleta(a, "2027-01-01")[0].data, "2026-12-31");
});

test("aniversário de equipe: só com 1 ano ou mais e fora da fila", () => {
  assert.deepEqual(comemoracoesDoAtleta({ ...base, entrouNaEquipeEm: "2026-10-16" }, "2026-10-16"), []);
  assert.equal(comemoracoesDoAtleta({ ...base, entrouNaEquipeEm: "2023-10-16" }, "2026-10-16")[0].anos, 3);
  assert.deepEqual(comemoracoesDoAtleta({ equipe: "fila_corrida", entrouNaEquipeEm: "2023-10-16" }, "2026-10-16"), []);
});

test("data inválida é ignorada", () => {
  assert.deepEqual(comemoracoesDoAtleta({ ...base, dataNascimento: "16/10/1990" }, "2026-10-16"), []);
});

test("mensagens: aniversário, atrasado no fim de semana, equipe e as duas juntas", () => {
  const m = (c: ReturnType<typeof comemoracoesDoAtleta>, equipe: "corrida" | "bicicleta" = "corrida", anos = 0) =>
    mensagemDaComemoracao({ comemoracoes: c, nome: "Ana Beatriz Lima", equipe, anosNoPrograma: anos })!;

  const hoje = m(comemoracoesDoAtleta({ ...base, dataNascimento: "1990-10-16" }, "2026-10-16"), "bicicleta", 4);
  assert.equal(hoje.titulo, "Feliz aniversário, Ana!");
  assert.match(hoje.texto, /boas pedaladas/);
  assert.match(hoje.texto, /esses 4 anos de programa/);

  // 17/10/2026 é sábado; abrindo na segunda (19/10).
  const atrasado = m(comemoracoesDoAtleta({ ...base, dataNascimento: "1990-10-17" }, "2026-10-19"));
  assert.equal(atrasado.titulo, "Parabéns atrasado, Ana!");
  assert.match(atrasado.texto, /foi no sábado/);
  assert.match(atrasado.texto, /bons quilômetros/);
  assert.doesNotMatch(atrasado.texto, /anos de programa/);

  const equipe = m(comemoracoesDoAtleta({ ...base, entrouNaEquipeEm: "2025-10-16" }, "2026-10-16"));
  assert.equal(equipe.titulo, "1 ano de Atletas Energisa!");
  assert.match(equipe.texto, /^Hoje faz 1 ano que você entrou na equipe de Corrida, Ana/);

  const duplo = m(comemoracoesDoAtleta({ ...base, dataNascimento: "1990-10-16", entrouNaEquipeEm: "2024-10-16" }, "2026-10-16"));
  assert.equal(duplo.titulo, "Dia duplo de festa, Ana!");
  assert.match(duplo.texto, /2 anos/);

  assert.equal(mensagemDaComemoracao({ comemoracoes: [], nome: "Ana", equipe: "corrida", anosNoPrograma: 0 }), null);
});

test("anos no programa pelo ano de entrada", () => {
  assert.equal(anosNoPrograma({ anoEntrada: 2022 }, "2026-10-16"), 4);
  assert.equal(anosNoPrograma({ anoEntrada: 2026 }, "2026-10-16"), 0);
  assert.equal(anosNoPrograma({ entrouNaEquipeEm: "2024-03-01" }, "2026-10-16"), 2);
  assert.equal(anosNoPrograma({}, "2026-10-16"), 0);
});
