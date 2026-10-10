import test from "node:test";
import assert from "node:assert/strict";
import {
  agruparPorLote,
  camposEditaveis,
  criteriosParaEdicao,
  dataCurta,
  extratoCsv,
  FILTRO_VAZIO,
  filtrarLancamentos,
  resumirMudancas,
  resumoDoExtrato,
} from "../src/lib/extrato";
import type { HistoricoPontoDoc, RegraPontuacaoDoc } from "../src/lib/types";

const quando = (iso: string) => new Date(iso);
function l(p: Partial<HistoricoPontoDoc> & { id: string }): HistoricoPontoDoc {
  return {
    atletaId: "a1",
    atletaNome: "Ana Lima",
    equipe: "corrida",
    regraId: "r-treino",
    regraDesc: "Participação em treino",
    pontos: 5,
    tipoLancamento: "treino",
    dataTreino: "2026-08-22",
    loteId: "lote1",
    descricaoLote: "Treino coletivo",
    criadoPor: "u1",
    criadoPorNome: "Comitê",
    criadoEm: quando("2026-10-10T17:56:00"),
    estornado: false,
    ...p,
  } as HistoricoPontoDoc;
}

const base = [
  l({ id: "1" }),
  l({ id: "2", atletaId: "a2", atletaNome: "Bruno Costa", equipe: "bicicleta" }),
  l({ id: "3", atletaId: "a3", atletaNome: "Célia Dias", estornado: true }),
  l({ id: "4", loteId: "lote2", descricaoLote: "Prova da cidade", regraId: "r-prova", regraDesc: "Prova oficial", pontos: 20, tipoLancamento: "evento", dataTreino: "2026-09-06", criadoEm: quando("2026-09-07T10:00:00"), criadoPor: "u2" }),
];

test("agrupa por lançamento, do mais recente ao mais antigo, com totais", () => {
  const lotes = agruparPorLote(base, "registro");
  assert.deepEqual(lotes.map((x) => x.id), ["lote1", "lote2"]);
  assert.deepEqual(agruparPorLote(base, "treino").map((x) => x.id), ["lote2", "lote1"]);
  assert.equal(lotes[0].atletas, 3);
  assert.equal(lotes[0].pontosValidos, 10);
  assert.equal(lotes[0].estornados, 1);
  assert.equal(lotes[0].titulo, "Treino coletivo");
});

test("filtros: período pela data do treino ou do registro, critério, situação, equipe e quem registrou", () => {
  const f = { ...FILTRO_VAZIO };
  assert.deepEqual(filtrarLancamentos(base, { ...f, de: "2026-09-01" }).map((x) => x.id), ["4"]);
  assert.deepEqual(filtrarLancamentos(base, { ...f, campoData: "registro", de: "2026-10-01" }).map((x) => x.id), ["1", "2", "3"]);
  assert.deepEqual(filtrarLancamentos(base, { ...f, regraId: "r-prova" }).map((x) => x.id), ["4"]);
  assert.deepEqual(filtrarLancamentos(base, { ...f, situacao: "estornados" }).map((x) => x.id), ["3"]);
  assert.deepEqual(filtrarLancamentos(base, { ...f, equipe: "bicicleta" }).map((x) => x.id), ["2"]);
  assert.deepEqual(filtrarLancamentos(base, { ...f, pessoa: "u2" }).map((x) => x.id), ["4"]);
  assert.deepEqual(filtrarLancamentos(base, { ...f, busca: "celia" }).map((x) => x.id), ["3"]);
});

test("resumo soma só os válidos e conta lançamentos por bloco", () => {
  const r = resumoDoExtrato(base);
  assert.equal(r.lancamentos, 2);
  assert.equal(r.pontosValidos, 30);
  assert.equal(r.pontosEstornados, 5);
  assert.equal(r.atletas, 3);
});

test("edição: o que pode mudar em cada tipo", () => {
  assert.equal(camposEditaveis(l({ id: "x" })).criterio, true);
  assert.equal(camposEditaveis(l({ id: "x", estornado: true })).observacao, false);
  const reuniao = camposEditaveis(l({ id: "x", tipoLancamento: "reuniao" }));
  assert.equal(reuniao.data, false);
  assert.equal(reuniao.observacao, true);
  assert.equal(camposEditaveis(l({ id: "x", regraId: "falta_justificada" })).criterio, false);
});

test("edição: critérios compatíveis e o atual sempre presente", () => {
  const regras = [
    { id: "r-treino", descricao: "Participação em treino", pontos: 5, modalidade: "ambas", tiposLancamento: ["treino"] },
    { id: "r-longo", descricao: "Treino longo", pontos: 10, modalidade: "corrida", tiposLancamento: ["treino"] },
    { id: "r-bike", descricao: "Pedal", pontos: 8, modalidade: "bicicleta", tiposLancamento: ["treino"] },
    { id: "r-prova", descricao: "Prova", pontos: 20, modalidade: "ambas", tiposLancamento: ["evento"] },
  ] as unknown as RegraPontuacaoDoc[];
  assert.deepEqual(criteriosParaEdicao(regras, l({ id: "x" })).map((r) => r.id), ["r-treino", "r-longo"]);
  assert.equal(criteriosParaEdicao(regras, l({ id: "x", regraId: "apagada", regraDesc: "Antigo" }))[0].id, "apagada");
});

test("edição: resume só o que mudou", () => {
  const antes = l({ id: "x", kmPercorrido: 5 });
  const r = resumirMudancas(antes, { regraId: "r-longo", regraDesc: "Treino longo", pontos: 10, dataTreino: "2026-08-23", kmPercorrido: 5, observacao: "" });
  assert.equal(r.resumo, "Critério: Participação em treino → Treino longo · Pontos: 5 → 10 · Data: 22/08 → 23/08");
  assert.equal(r.mudou.kmPercorrido, undefined);
  assert.equal(resumirMudancas(antes, { dataTreino: "2026-08-22" }).vazio, true);
});

test("datas curtas e planilha", () => {
  assert.equal(dataCurta("2026-07-30", "2026"), "30/07");
  assert.equal(dataCurta("2025-07-30", "2026"), "30/07/25");
  const csv = extratoCsv([l({ id: "1", observacao: 'disse "ok"; voltou' })]);
  assert.ok(csv.startsWith("﻿Data do treino;Atleta"));
  assert.ok(csv.includes('"disse ""ok""; voltou"'));
});
