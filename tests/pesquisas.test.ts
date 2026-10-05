import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizarRespostas,
  obrigatoriasPendentes,
  pesquisaParaEquipe,
  problemasDaPesquisa,
  resultadosDaPesquisa,
  situacaoPesquisa,
  type PerguntaPesquisa,
  type RespostaPesquisaDoc,
} from "../src/lib/pesquisas";

const perguntas: PerguntaPesquisa[] = [
  { id: "a", tipo: "unica", enunciado: "Horário preferido?", opcoes: ["Manhã", "Noite"], obrigatoria: true },
  { id: "b", tipo: "multipla", enunciado: "Quais treinos?", opcoes: ["Rua", "Pista", "Trilha"], obrigatoria: false },
  { id: "c", tipo: "escala", enunciado: "Nota", obrigatoria: true },
  { id: "d", tipo: "texto_longo", enunciado: "Sugestões", obrigatoria: false },
];

test("situação: rascunho, agendada, aberta e encerrada", () => {
  const base = { abreEm: "2026-10-05T10:00:00.000Z", fechaEm: "2026-10-10T10:00:00.000Z" };
  assert.equal(situacaoPesquisa({ ...base, publicada: false }), "rascunho");
  assert.equal(situacaoPesquisa({ ...base, publicada: true }, new Date("2026-10-04T00:00:00Z")), "agendada");
  assert.equal(situacaoPesquisa({ ...base, publicada: true }, new Date("2026-10-06T00:00:00Z")), "aberta");
  assert.equal(situacaoPesquisa({ ...base, publicada: true }, new Date("2026-10-10T10:00:00Z")), "encerrada");
});

test("público: todos, uma modalidade, fila de espera fica de fora", () => {
  assert.equal(pesquisaParaEquipe({ publico: "todos" }, "bicicleta"), true);
  assert.equal(pesquisaParaEquipe({ publico: "corrida" }, "bicicleta"), false);
  assert.equal(pesquisaParaEquipe({ publico: "todos" }, "fila_corrida"), false);
});

test("não publica sem título, opções ou com datas invertidas", () => {
  const problemas = problemasDaPesquisa({
    titulo: " ",
    perguntas: [{ id: "x", tipo: "unica", enunciado: "", opcoes: ["Sim", ""], obrigatoria: true }],
    abreEm: "2026-10-10T00:00:00Z",
    fechaEm: "2026-10-05T00:00:00Z",
  });
  assert.equal(problemas.length, 4);
});

test("obrigatórias e respostas fora do formato", () => {
  assert.deepEqual(obrigatoriasPendentes(perguntas, { b: ["Rua"] }), ["a", "c"]);
  assert.deepEqual(normalizarRespostas(perguntas, { a: "Tarde", b: ["Rua", "Mar"], c: 9, d: "  ok  " }), {
    b: ["Rua"],
    c: 5,
    d: "ok",
  });
});

test("resultados: percentuais, média da nota e textos com nome", () => {
  const respostas: RespostaPesquisaDoc[] = [
    { atletaId: "1", atletaNome: "Ana", equipe: "corrida", respostas: { a: "Manhã", b: ["Rua", "Pista"], c: 5, d: "Mais trilhas" } },
    { atletaId: "2", atletaNome: "Bruno", equipe: "bicicleta", respostas: { a: "Manhã", c: 3 } },
    { atletaId: "3", atletaNome: "Caio", equipe: "corrida", respostas: { a: "Noite", b: ["Rua"], c: 4 } },
  ];
  const [a, b, c, d] = resultadosDaPesquisa(perguntas, respostas);
  assert.ok(a.tipo === "opcoes" && a.opcoes[0].total === 2 && a.opcoes[0].percentual === 67);
  assert.ok(b.tipo === "opcoes" && b.responderam === 2 && b.opcoes[0].percentual === 100);
  assert.ok(c.tipo === "escala" && c.media === 4);
  assert.ok(d.tipo === "texto" && d.textos[0].atletaNome === "Ana");
});
