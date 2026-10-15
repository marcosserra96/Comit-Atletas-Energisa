import { test } from "node:test";
import assert from "node:assert/strict";
import { contarVotos, opcoesDaEnquete, percentuais, pesquisaDaEnquete } from "../src/lib/enquete";
import { comandosDepois, validarEstado } from "../src/lib/controleRemoto";
import { montarRoteiro, novoSlideLivre, reuniaoPadrao, validarReuniao, verificarAntesDeApresentar } from "../src/lib/reuniaoResultados";

test("enquete: opções, votos e percentuais", () => {
  assert.deepEqual(opcoesDaEnquete(" A \n\nb\nB\nC\nD\nE\nF\nG"), ["A", "b", "C", "D", "E", "F"]);
  const v = contarVotos(["Sim", "Não"], [{ respostas: { p1: "sim" } }, { respostas: { p1: "Não" } }, { respostas: { p1: "Sim" } }, { respostas: { p1: "Talvez" } }, { respostas: {} }]);
  assert.deepEqual(v, { votos: [2, 1], total: 4 });
  assert.deepEqual(percentuais([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(percentuais([0, 0]), [0, 0]);
  const p = pesquisaDaEnquete({ id: "x", pergunta: "Qual?", opcoes: ["A", "B"], agora: new Date("2026-10-15T12:00:00Z"), uid: "u", nome: "N" });
  assert.equal(p.semAviso, true);
  assert.equal(p.perguntas[0].tipo, "unica");
  assert.equal(p.fechaEm, "2026-10-15T14:00:00.000Z");
  assert.equal(p.abreEm, "2026-10-15T11:59:00.000Z");
});

test("enquete no roteiro e no antes de apresentar", () => {
  const r = reuniaoPadrao({ nome: "T", inicio: "2026-06-01", fim: "2026-08-31" }, null);
  const e = { ...novoSlideLivre("enquete"), texto: "Só uma" };
  const reuniao = { ...r, livres: [...r.livres, e], secoes: [...r.secoes, { id: e.id, tipo: "livre" as const, ativo: true }] };
  const v = verificarAntesDeApresentar({ reuniao, eventos: [], lancamentos: [], semFoto: [], hoje: "2026-10-01" });
  assert.ok(v.some((x) => x.id === "enquete"));
  const val = validarReuniao({ ...reuniao, livres: reuniao.livres.map((l) => (l.id === e.id ? { ...l, pesquisaId: "abc123", texto: "A\nB" } : l)) });
  assert.ok("dados" in val);
  if ("dados" in val) {
    const salvo = val.dados.livres.find((l) => l.id === e.id)!;
    assert.equal(salvo.layout, "enquete");
    assert.equal(salvo.pesquisaId, "abc123");
  }
  const vazio = { modalidade: "corrida" as const, ranking: [], podio: [], totais: { atletas: 0, treinos: 0, pontos: 0, km: 0, kmPorTreino: 0 } };
  const slides = montarRoteiro({ reuniao: { ...reuniao, secoes: [{ id: e.id, tipo: "livre", ativo: true }] }, corrida: vazio, bicicleta: { ...vazio, modalidade: "bicicleta" }, novos: [], regras: [], periodos: [], agenda: [], evento: null, pontosReuniao: null, hoje: "2026-10-01" });
  assert.equal(slides[0].tipo, "enquete");
});

test("controle remoto: estado limpo e comandos em ordem", () => {
  assert.equal(validarEstado(null), null);
  const e = validarEstado({ indice: 3.7, total: 20, rotulo: "x".repeat(500), acao: { rotulo: "Sortear", desabilitado: 1 } });
  assert.equal(e?.indice, 3);
  assert.equal(e?.rotulo.length, 120);
  assert.deepEqual(e?.acao, { rotulo: "Sortear", desabilitado: false });
  assert.deepEqual(comandosDepois([{ seq: 3, comando: "proximo" }, { seq: 1, comando: "anterior" }, { seq: 2, comando: "acao" }], 1).map((c) => c.seq), [2, 3]);
});
