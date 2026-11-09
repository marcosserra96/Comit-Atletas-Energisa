import { test } from "node:test";
import assert from "node:assert/strict";
import { executarAnalise, periodoAnterior, variacao, faixaEtaria, type ConfigAnalise, type DadosAnalise } from "../src/lib/analises/motor";
import { escreverEscolha, lerEscolha, prontaAtiva, resolverPeriodo, ESCOLHA_PADRAO, PRONTAS } from "../src/lib/analises/config";
import type { AtletaDoc, HistoricoMensalDoc, HistoricoPontoDoc } from "../src/lib/types";

const atleta = (id: string, extra: Partial<AtletaDoc> = {}) =>
  ({ id, nome: id.toUpperCase(), equipe: "corrida", ativo: true, pontuacaoTotal: 0, sexo: "F", ...extra }) as AtletaDoc;

let n = 0;
const lanc = (atletaId: string, dataTreino: string, extra: Partial<HistoricoPontoDoc> = {}) =>
  ({ id: `l${++n}`, atletaId, atletaNome: atletaId, equipe: "corrida", regraId: "treino", regraDesc: "Treino", pontos: 2, tipoLancamento: "treino", dataTreino, loteId: `lote${n}`, estornado: false, ...extra }) as HistoricoPontoDoc;

const base: ConfigAnalise = {
  medida: "treinos",
  linhas: "atleta",
  colunas: null,
  periodo: { de: "2026-07-01", ate: "2026-09-30" },
  anterior: null,
  equipe: "todas",
  criterios: [],
  tipos: [],
  sexo: "todos",
  somenteAtivos: true,
  modo: "total",
  minimo: null,
  top: null,
};

const dados: DadosAnalise = {
  hoje: "2026-11-09",
  atletas: [
    atleta("ana"),
    atleta("bia", { equipe: "bicicleta", sexo: "F" }),
    atleta("caio", { sexo: "M" }),
    atleta("dani", { ativo: false }),
    atleta("oculto", { visivelNasListas: false }),
    atleta("fila", { equipe: "fila_corrida" }),
  ],
  lancamentos: [
    lanc("ana", "2026-07-02", { kmPercorrido: 10 }),
    lanc("ana", "2026-08-05", { kmPercorrido: 21 }),
    lanc("ana", "2026-08-05", { regraId: "extra", regraDesc: "Treino extra", pontos: 3, loteId: "lote2" }),
    lanc("ana", "2026-05-10"),
    lanc("bia", "2026-07-03", { kmPercorrido: 40 }),
    lanc("bia", "2026-07-20", { tipoLancamento: "evento", regraId: "prova", regraDesc: "Prova", pontos: 5 }),
    lanc("caio", "2026-09-01", { estornado: true }),
    lanc("dani", "2026-07-01"),
    lanc("oculto", "2026-07-01"),
  ],
  resumos: [{ id: "r", atletaId: "caio", competencia: "2026-07", pontos: 10, km: 30, treinos: 4 } as HistoricoMensalDoc],
};

test("treinos por atleta: inclui resumo mensal, zera estornos, tira inativos, ocultos e fila", () => {
  const r = executarAnalise(base, dados);
  assert.deepEqual(r.linhas.map((l) => [l.chave, l.valor]), [["caio", 4], ["ana", 2], ["bia", 1]]);
  assert.equal(r.total, 7);
  assert.equal(r.atletasNoFiltro, 3);
});

test("km, maior distância e provas", () => {
  assert.deepEqual(executarAnalise({ ...base, medida: "km" }, dados).linhas.map((l) => [l.chave, l.valor]), [["bia", 40], ["ana", 31], ["caio", 30]]);
  assert.equal(executarAnalise({ ...base, medida: "maiorDistancia" }, dados).total, 40);
  assert.deepEqual(executarAnalise({ ...base, medida: "provas", top: 1 }, dados).linhas.map((l) => [l.chave, l.valor]), [["bia", 1]]);
});

test("por equipe com média por atleta", () => {
  const r = executarAnalise({ ...base, linhas: "equipe", medida: "pontos", modo: "media" }, dados);
  // Corrida: ana 2+2+3 = 7, caio 10 => 17 / 2. Bike: 2+5 = 7 / 1.
  assert.deepEqual(r.linhas.map((l) => [l.chave, l.valor]), [["corrida", 8.5], ["bicicleta", 7]]);
});

test("atleta × mês mostra todos os meses do período, com zeros", () => {
  const r = executarAnalise({ ...base, colunas: "mes", equipe: "corrida" }, dados);
  assert.deepEqual(r.colunas?.map((c) => c.chave), ["2026-07", "2026-08", "2026-09"]);
  const ana = r.linhas.find((l) => l.chave === "ana")!;
  assert.deepEqual(ana.celulas, { "2026-07": 1, "2026-08": 1, "2026-09": 0 });
});

test("filtro por critério tira o histórico mensal e avisa", () => {
  const r = executarAnalise({ ...base, medida: "pontos", criterios: ["extra"], minimo: 1 }, dados);
  assert.equal(r.semResumoMensal, true);
  assert.deepEqual(r.linhas.map((l) => [l.chave, l.valor]), [["ana", 3]]);
});

test("ordenar pela variação (maior evolução)", () => {
  const r = executarAnalise({ ...base, anterior: periodoAnterior(base.periodo), ordem: "variacao" }, dados);
  // ana: 2 agora, 1 antes (+1); caio: 4 (+4); bia: 1 (+1).
  assert.equal(r.linhas[0].chave, "caio");
});

test("comparação com o período anterior e meses com treino", () => {
  const r = executarAnalise({ ...base, anterior: periodoAnterior(base.periodo) }, dados);
  assert.equal(r.linhas.find((l) => l.chave === "ana")?.anterior, 1);
  assert.deepEqual(variacao(2, 1), { abs: 1, pct: 100 });
  assert.equal(executarAnalise({ ...base, medida: "mesesComTreino", linhas: "equipe", equipe: "corrida" }, dados).linhas[0].valor, 1.5);
});

test("dia da semana e mês em ordem natural", () => {
  const meses = executarAnalise({ ...base, linhas: "mes" }, dados).linhas.map((l) => l.chave);
  assert.deepEqual(meses, ["2026-07", "2026-08", "2026-09"]);
  const dias = executarAnalise({ ...base, linhas: "diaSemana" }, dados).linhas.map((l) => l.rotulo);
  assert.equal(dias[0], "Segunda");
});

test("período anterior e faixa etária", () => {
  assert.deepEqual(periodoAnterior({ de: "2026-07-01", ate: "2026-09-30" }), { de: "2026-04-01", ate: "2026-06-30" });
  assert.deepEqual(periodoAnterior({ de: "2026-01-01", ate: "2026-12-31" }), { de: "2025-01-01", ate: "2025-12-31" });
  assert.deepEqual(periodoAnterior({ de: "2026-07-10", ate: "2026-07-19" }), { de: "2026-06-30", ate: "2026-07-09" });
  assert.equal(faixaEtaria("1990-12-01", "2026-11-09"), "30 a 39 anos");
  assert.equal(faixaEtaria(undefined, "2026-11-09"), "Não informado");
});

test("escolha vai e volta pela URL, só com o que mudou", () => {
  assert.equal(escreverEscolha(ESCOLHA_PADRAO), "");
  const e = { ...ESCOLHA_PADRAO, medida: "km" as const, colunas: "mes" as const, comparar: true, minimo: 10, criterio: "abc" };
  assert.deepEqual(lerEscolha(escreverEscolha(e)), e);
  assert.equal(lerEscolha("?medida=xyz&por=atleta&col=atleta").medida, "treinos");
  assert.equal(lerEscolha("?por=atleta&col=atleta").colunas, null);
  assert.equal(prontaAtiva({ ...ESCOLHA_PADRAO, ...PRONTAS[1].escolha }), "evolucao");
});

test("trimestres seguem o calendário de premiação; sem ele, os civis", () => {
  const cal = [
    { nome: "T1", inicio: "2026-01-01", fim: "2026-03-31" },
    { nome: "T2", inicio: "2026-04-01", fim: "2026-07-15" },
    { nome: "T3", inicio: "2026-07-16", fim: "2026-10-31" },
  ];
  const atual = resolverPeriodo({ periodo: "trimestre", de: "", ate: "", comparar: true }, "2026-08-10", cal);
  // Em andamento: até hoje, e o anterior com o mesmo número de dias (26).
  assert.deepEqual([atual.titulo, atual.periodo, atual.anterior, atual.tituloAnterior], ["T3 (até hoje)", { de: "2026-07-16", ate: "2026-08-10" }, { de: "2026-04-01", ate: "2026-04-26" }, "T2 (primeiros 26 dias)"]);
  // Entre trimestres: o atual é o último que terminou.
  assert.equal(resolverPeriodo({ periodo: "trimestre", de: "", ate: "", comparar: false }, "2026-11-09", cal).titulo, "T3");
  assert.equal(resolverPeriodo({ periodo: "trimestrePassado", de: "", ate: "", comparar: false }, "2026-11-09", cal).titulo, "T2");
  const civil = resolverPeriodo({ periodo: "trimestre", de: "", ate: "", comparar: true }, "2026-11-09", []);
  assert.deepEqual([civil.titulo, civil.tituloAnterior], ["4º trimestre de 2026 (até hoje)", "3º trimestre de 2026 (primeiros 40 dias)"]);
  const passado = resolverPeriodo({ periodo: "trimestrePassado", de: "", ate: "", comparar: true }, "2026-11-09", []);
  assert.deepEqual([passado.periodo, passado.anterior, passado.emAndamento], [{ de: "2026-07-01", ate: "2026-09-30" }, { de: "2026-04-01", ate: "2026-06-30" }, false]);
  assert.equal(resolverPeriodo({ periodo: "mesPassado", de: "", ate: "", comparar: false }, "2026-01-09", []).titulo, "dezembro de 2025");
  assert.equal(resolverPeriodo({ periodo: "anoPassado", de: "", ate: "", comparar: true }, "2026-01-09", []).tituloAnterior, "2024");
});

test("mês a mês com comparação casa pela posição do mês", () => {
  const r = executarAnalise({ ...base, linhas: "mes", anterior: { de: "2026-04-01", ate: "2026-06-30" } }, dados);
  // Maio (2º mês do anterior) tem 1 treino da ana; casa com agosto.
  assert.deepEqual(r.linhas.map((l) => [l.chave, l.anterior]), [["2026-07", 0], ["2026-08", 1], ["2026-09", 0]]);
});
