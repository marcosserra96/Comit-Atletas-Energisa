import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agendaDoAno,
  intervaloDeMeses,
  mesesDoPeriodo,
  montarRoteiro,
  novosAtletas,
  paginarClassificacao,
  periodosDeApuracao,
  regrasParaSlide,
  resultadosDaEquipe,
  reuniaoPadrao,
  validarReuniao,
} from "../src/lib/reuniaoResultados";
import type { AtletaDoc, EventoDoc, HistoricoPontoDoc, RegraPontuacaoDoc } from "../src/lib/types";

const atleta = (id: string, nome: string, equipe: AtletaDoc["equipe"], extra: Partial<AtletaDoc> = {}) =>
  ({ id, nome, equipe, ativo: true, email: null, role: "atleta", pontuacaoTotal: 0, authUid: null, criadoEm: null, atualizadoEm: null, ...extra }) as AtletaDoc;

const lanc = (atletaId: string, dataTreino: string, pontos: number, km = 5) =>
  ({ id: `${atletaId}-${dataTreino}-${pontos}`, atletaId, dataTreino, pontos, kmPercorrido: km, regraId: "r1", tipoLancamento: "treino", loteId: `${atletaId}-${dataTreino}`, estornado: false }) as unknown as HistoricoPontoDoc;

test("meses do período como na reunião", () => {
  assert.equal(mesesDoPeriodo("2026-06-01", "2026-08-31"), "Junho – Julho – Agosto");
  assert.equal(mesesDoPeriodo("2026-03-01", "2026-11-30"), "Março a Novembro");
  assert.equal(intervaloDeMeses("2026-06-01", "2026-08-31"), "(Junho a Agosto)");
});

test("resultados da equipe: só o período, empates e totais com km por treino", () => {
  const atletas = [atleta("a", "Ana", "corrida"), atleta("b", "Bia", "corrida"), atleta("c", "Caio", "corrida"), atleta("x", "Xis", "bicicleta"), atleta("i", "Inativo", "corrida", { ativo: false })];
  const lancamentos = [
    lanc("a", "2026-06-02", 2, 10), lanc("a", "2026-06-09", 2, 8),
    lanc("b", "2026-06-03", 2, 5), lanc("b", "2026-07-03", 2, 7),
    lanc("c", "2026-06-05", 1, 4),
    lanc("a", "2026-05-30", 9, 9), // fora do período
    lanc("x", "2026-06-02", 2, 40),
  ];
  const r = resultadosDaEquipe({ modalidade: "corrida", atletas, lancamentos, resumosMensais: [], inicio: "2026-06-01", fim: "2026-08-31", novos: new Set(["c"]) });
  assert.deepEqual(r.ranking.map((l) => [l.nome, l.posicao, l.pontos]), [["Ana", 1, 4], ["Bia", 1, 4], ["Caio", 2, 1]]);
  assert.equal(r.totais.atletas, 3);
  assert.equal(r.totais.treinos, 5);
  assert.equal(r.totais.km, 34);
  assert.ok(Math.abs(r.totais.kmPorTreino - 6.8) < 0.001);
  assert.equal(r.podio[0].total, 2);
  assert.equal(r.ranking[2].novo, true);
});

test("novos atletas: entrou na equipe no período, com ajustes do comitê", () => {
  const atletas = [
    atleta("a", "Ana", "corrida", { entrouNaEquipeEm: "2026-07-10" }),
    atleta("b", "Bia", "bicicleta", { entrouNaEquipeEm: "2026-01-10" }),
    atleta("c", "Caio", "corrida"),
    atleta("f", "Fila", "fila_corrida", { entrouNaEquipeEm: "2026-07-10" }),
  ];
  const ids = (xs: AtletaDoc[]) => xs.map((a) => a.id);
  assert.deepEqual(ids(novosAtletas({ atletas, inicio: "2026-06-01", ate: "2026-09-30" })), ["a"]);
  assert.deepEqual(ids(novosAtletas({ atletas, inicio: "2026-06-01", ate: "2026-09-30", incluir: ["c"], excluir: ["a"] })), ["c"]);
});

test("classificação em colunas iguais, até 45 por slide", () => {
  const n = (k: number) => Array.from({ length: k }, (_, i) => i);
  assert.deepEqual(paginarClassificacao(n(44)).map((s) => s.map((c) => c.length)), [[15, 15, 14]]);
  assert.deepEqual(paginarClassificacao(n(22)).map((s) => s.map((c) => c.length)), [[11, 11]]);
  assert.deepEqual(paginarClassificacao(n(10)).map((s) => s.map((c) => c.length)), [[10]]);
  assert.deepEqual(paginarClassificacao(n(50)).map((s) => s.map((c) => c.length)), [[15, 15, 15], [5]]);
});

test("regras, agenda e períodos para os slides", () => {
  const regras = [
    { id: "a", descricao: "Treino fora", pontos: 1, modalidade: "ambas" },
    { id: "b", descricao: "Treino oficial", pontos: 2, modalidade: "ambas" },
    { id: "falta_justificada", descricao: "Falta", pontos: 0, modalidade: "ambas" },
  ] as RegraPontuacaoDoc[];
  assert.deepEqual(regrasParaSlide(regras).map((r) => r.pontos), [2, 1]);
  const ev = (id: string, data: string, modalidade: EventoDoc["modalidade"], tipo?: EventoDoc["tipo"]) => ({ id, data, modalidade, tipo, titulo: id, local: "x" }) as EventoDoc;
  const agenda = agendaDoAno([ev("c1", "2026-06-14", "corrida"), ev("b1", "2026-07-12", "bicicleta"), ev("r", "2026-07-01", "ambas", "reuniao"), ev("velho", "2025-12-01", "corrida")], "2026", "2026-07-01");
  assert.deepEqual(agenda.map((c) => [c.titulo, c.eventos.map((e) => [e.id, e.feito])]), [["Time Corrida", [["c1", true]]], ["Time Bike", [["b1", false]]]]);
  const p = periodosDeApuracao([{ nome: "1º", inicio: "2026-03-01", fim: "2026-05-31" }, { nome: "2º", inicio: "2026-06-01", fim: "2026-08-31" }, { nome: "3º", inicio: "2026-09-01", fim: "2026-11-30" }], "2026", "2026-07-15");
  assert.deepEqual(p.map((x) => x.situacao), ["fechado", "andamento", "proximo"]);
});

test("roteiro padrão segue a reunião de setembro e pula seções vazias", () => {
  const base = reuniaoPadrao({ nome: "2º Trimestre", inicio: "2026-06-01", fim: "2026-08-31" }, "ev1");
  const equipe = (modalidade: "corrida" | "bicicleta", nomes: string[]) =>
    resultadosDaEquipe({ modalidade, atletas: nomes.map((n) => atleta(n, n, modalidade)), lancamentos: nomes.map((n, i) => lanc(n, "2026-06-10", 10 - i)), resumosMensais: [], inicio: "2026-06-01", fim: "2026-08-31" });
  const slides = montarRoteiro({
    reuniao: base,
    corrida: equipe("corrida", ["A", "B", "C"]),
    bicicleta: equipe("bicicleta", ["X", "Y"]),
    novos: [],
    regras: [],
    periodos: [],
    agenda: [],
    evento: { id: "ev1", titulo: "Reunião", horario: "19:00 às 20:00" },
    pontosReuniao: 3,
    hoje: "2026-09-10",
  });
  assert.deepEqual(slides.map((s) => s.tipo), [
    "capa", "presenca", "divisoria", "conteudo", "regras", "divisoria", "totais",
    "divisoria", "podio", "classificacao", "podio", "classificacao", "divisoria", "divisoria", "app", "obrigado",
  ]);
  assert.equal(new Set(slides.map((s) => s.chave)).size, slides.length, "chaves únicas");
});

test("validação: período obrigatório, seções livres precisam do slide", () => {
  assert.ok("erro" in validarReuniao({ periodo: { inicio: "x", fim: "y" } }));
  const base = reuniaoPadrao({ nome: "T", inicio: "2026-06-01", fim: "2026-08-31" }, null);
  const r = validarReuniao({ ...base, livres: [] });
  assert.ok("dados" in r && r.dados.secoes.every((s) => s.tipo !== "livre"));
});
