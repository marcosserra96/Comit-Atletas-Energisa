import { test } from "node:test";
import assert from "node:assert/strict";
import { conferirPontos, detalharAtleta, quantidadeDePendencias } from "../src/lib/conferenciaPontos";
import type { HistoricoMensalDoc, HistoricoPontoDoc } from "../src/lib/types";

let seq = 0;
const lanc = (extra: Partial<HistoricoPontoDoc> = {}): HistoricoPontoDoc => ({
  id: `l${++seq}`,
  atletaId: "ana",
  atletaNome: "Ana",
  equipe: "corrida",
  regraId: "treino",
  regraDesc: "Treino",
  pontos: 5,
  tipoLancamento: "treino",
  dataTreino: "2026-10-04",
  loteId: `lote${seq}`,
  criadoPor: "x",
  criadoPorNome: "X",
  criadoEm: { seconds: seq },
  estornado: false,
  ...extra,
});
const resumo = (extra: Partial<HistoricoMensalDoc> = {}): HistoricoMensalDoc =>
  ({ id: "2026-03_ana", atletaId: "ana", atletaNome: "Ana", equipe: "corrida", competencia: "2026-03", pontos: 40, km: 50, treinos: 8, criadoPor: "x", ...extra }) as HistoricoMensalDoc;

const ana = { id: "ana", nome: "Ana", equipe: "corrida" as const, pontuacaoTotal: 0 };
const base = { publicos: new Map<string, number>(), hoje: "2026-11-07" };

test("total certo: soma lançamentos válidos e resumos mensais, sem estornados", () => {
  const lancamentos = [lanc({ dataTreino: "2026-10-01" }), lanc({ dataTreino: "2026-10-02" }), lanc({ dataTreino: "2026-10-03", estornado: true })];
  const r = conferirPontos({ ...base, atletas: [{ ...ana, pontuacaoTotal: 50 }], lancamentos, resumos: [resumo()] });
  assert.equal(r.totais.length, 0);
  assert.equal(quantidadeDePendencias(r), 0);
});

test("total salvo diferente da soma aparece, com a cópia do ranking", () => {
  const r = conferirPontos({
    ...base,
    publicos: new Map([["ana", 7]]),
    atletas: [{ ...ana, pontuacaoTotal: 10 }],
    lancamentos: [lanc({ dataTreino: "2026-10-01" })],
    resumos: [],
  });
  assert.deepEqual(r.totais.map((t) => [t.salvo, t.salvoPublico, t.esperado]), [[10, 7, 5]]);
});

test("mesmo critério duas vezes no mesmo dia é repetição; o mais antigo fica", () => {
  const primeiro = lanc();
  const copia = lanc();
  const r = conferirPontos({ ...base, atletas: [{ ...ana, pontuacaoTotal: 10 }], lancamentos: [copia, primeiro], resumos: [] });
  assert.equal(r.repetidos.length, 1);
  assert.equal(r.repetidos[0].lancamentos[0].id, primeiro.id);
  assert.equal(r.repetidos[0].pontosAMais, 5);
});

test("não é repetição: extras com data aproximada, critérios diferentes, desafios diferentes, já conferidos", () => {
  const lancamentos = [
    lanc({ regraId: "extra", dataTreino: "2026-10-01", dataAproximada: true }),
    lanc({ regraId: "extra", dataTreino: "2026-10-01", dataAproximada: true }),
    lanc({ regraId: "extra" }),
    lanc({ regraId: "desafio", regraDesc: "Desafio A", tipoLancamento: "avulso", dataTreino: "2026-10-31" }),
    lanc({ regraId: "desafio", regraDesc: "Desafio B", tipoLancamento: "avulso", dataTreino: "2026-10-31" }),
    { ...lanc({ dataTreino: "2026-09-01" }), repeticaoConferida: true },
    { ...lanc({ dataTreino: "2026-09-01" }), repeticaoConferida: true },
  ];
  const r = conferirPontos({ ...base, atletas: [ana], lancamentos, resumos: [] });
  assert.equal(r.repetidos.length, 0);
});

test("mês com resumo mensal e lançamentos ao mesmo tempo pede conferência", () => {
  const r = conferirPontos({
    ...base,
    atletas: [ana],
    lancamentos: [lanc({ dataTreino: "2026-03-10" }), lanc({ dataTreino: "2026-04-10" })],
    resumos: [resumo(), { ...resumo({ id: "2026-02_ana", competencia: "2026-02" }) }],
  });
  assert.equal(r.mesesDuplos.length, 1);
  assert.equal(r.mesesDuplos[0].competencia, "2026-03");
  assert.deepEqual(r.mesesDuplos[0].lancamentos, { quantidade: 1, pontos: 5, treinos: 1 });
});

test("data no futuro e lançamento de atleta que não existe mais", () => {
  const r = conferirPontos({
    ...base,
    atletas: [ana],
    lancamentos: [lanc({ dataTreino: "2026-12-01" }), lanc({ atletaId: "apagado", pontos: 9 })],
    resumos: [resumo({ atletaId: "apagado", pontos: 1 })],
  });
  assert.equal(r.futuros.length, 1);
  assert.deepEqual(r.semAtleta, { lancamentos: 1, resumos: 1, pontos: 10 });
});

test("detalhe do mês: critério a critério e treinos juntados no mesmo lançamento", () => {
  const lancamentos = [
    lanc({ loteId: "s1", dataTreino: "2026-10-04" }),
    lanc({ loteId: "s1", dataTreino: "2026-10-04", regraId: "extra", regraDesc: "Treino extra", pontos: 3, tipoLancamento: "treino" }),
    lanc({ loteId: "s2", dataTreino: "2026-10-11", kmPercorrido: 10 }),
    lanc({ loteId: "s3", dataTreino: "2026-10-18", regraId: "falta_justificada", regraDesc: "Falta justificada", pontos: 0 }),
    lanc({ loteId: "s4", dataTreino: "2026-10-25", estornado: true }),
  ];
  const [outubro] = detalharAtleta("ana", lancamentos, [], "2026");
  assert.equal(outubro.competencia, "2026-10");
  assert.equal(outubro.treinos, 2);
  assert.equal(outubro.juntados, 1);
  assert.equal(outubro.pontos, 13);
  assert.equal(outubro.km, 10);
  assert.equal(outubro.faltasJustificadas, 1);
  assert.equal(outubro.estornados, 1);
  assert.deepEqual(outubro.criterios.map((c) => [c.descricao, c.vezes, c.pontos]), [["Treino", 2, 10], ["Treino extra", 1, 3]]);
});
