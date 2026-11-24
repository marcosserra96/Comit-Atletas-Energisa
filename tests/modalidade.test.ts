import { test } from "node:test";
import assert from "node:assert/strict";
import {
  idDoAtleta,
  modalidadeNaData,
  problemaNasTrocas,
  recortarNasJanelas,
  separarPorModalidade,
  sugerirTroca,
  trechosDeModalidade,
  valeNoPeriodo,
} from "../src/lib/modalidade";
import { calcularResultadosRanking } from "../src/lib/rankingPeriods";
import { calcularPremio, novoPremio } from "../src/lib/premiacaoPersonalizada";
import { executarAnalise, type ConfigAnalise, type DadosAnalise } from "../src/lib/analises/motor";
import { resultadosDaEquipe } from "../src/lib/reuniaoResultados";
import { montarInformativo } from "../src/lib/informativo";
import type { AtletaDoc, HistoricoMensalDoc, HistoricoPontoDoc } from "../src/lib/types";

const atleta = (id: string, extra: Partial<AtletaDoc> = {}) => ({ id, nome: id.toUpperCase(), equipe: "corrida", ativo: true, pontuacaoTotal: 0, sexo: "F", ...extra }) as AtletaDoc;
let n = 0;
const lanc = (atletaId: string, dataTreino: string, pontos: number, km: number, equipe: "corrida" | "bicicleta") =>
  ({ id: `l${++n}`, atletaId, atletaNome: atletaId, equipe, regraId: "treino", regraDesc: "Treino", pontos, kmPercorrido: km, tipoLancamento: "treino", dataTreino, loteId: `lote${n}`, estornado: false }) as HistoricoPontoDoc;

// Bia pedalou até julho (muitos km) e passou para a Corrida em 1º de agosto.
const bia = atleta("bia", { equipe: "corrida", trocasModalidade: [{ de: "bicicleta", para: "corrida", data: "2026-08-01" }] });
const caio = atleta("caio");
const duda = atleta("duda", { equipe: "bicicleta" });
const lancamentos = [
  lanc("bia", "2026-06-10", 10, 80, "bicicleta"),
  lanc("bia", "2026-07-10", 10, 90, "bicicleta"),
  lanc("bia", "2026-08-10", 5, 6, "corrida"),
  lanc("caio", "2026-08-11", 8, 12, "corrida"),
  lanc("caio", "2026-08-12", 8, 10, "corrida"),
  lanc("duda", "2026-07-15", 6, 40, "bicicleta"),
];
const resumos: HistoricoMensalDoc[] = [];

test("modalidade em cada dia e trechos", () => {
  assert.equal(modalidadeNaData(bia, "2026-07-31"), "bicicleta");
  assert.equal(modalidadeNaData(bia, "2026-08-01"), "corrida");
  assert.equal(modalidadeNaData(caio, "2020-01-01"), "corrida");
  assert.deepEqual(trechosDeModalidade(bia), [
    { modalidade: "bicicleta", inicio: "", fim: "2026-07-31" },
    { modalidade: "corrida", inicio: "2026-08-01", fim: "" },
  ]);
  const idaEVolta = atleta("x", { equipe: "bicicleta", trocasModalidade: [{ de: "corrida", para: "bicicleta", data: "2026-09-01" }, { de: "bicicleta", para: "corrida", data: "2026-03-01" }] });
  // Fora de ordem no cadastro: vale a ordem das datas.
  assert.equal(modalidadeNaData(idaEVolta, "2026-02-28"), "bicicleta");
  assert.equal(modalidadeNaData(idaEVolta, "2026-05-01"), "corrida");
  assert.equal(modalidadeNaData(idaEVolta, "2026-09-01"), "bicicleta");
});

test("separar: a parte da Bike vira uma fatia com id próprio e leva só os registros dela", () => {
  const sep = separarPorModalidade({ atletas: [bia, caio], lancamentos, resumos });
  assert.deepEqual(sep.atletas.map((a) => [a.id, a.equipe]), [["bia", "corrida"], ["bia~bicicleta", "bicicleta"], ["caio", "corrida"]]);
  assert.deepEqual(sep.lancamentos.filter((l) => idDoAtleta(l.atletaId) === "bia").map((l) => l.atletaId), ["bia~bicicleta", "bia~bicicleta", "bia"]);
  const fatia = sep.atletas[1];
  assert.equal(fatia.entrouNaEquipeEm, undefined);
  assert.equal(valeNoPeriodo(fatia, "2026-08-01", "2026-10-31"), false);
  assert.equal(valeNoPeriodo(fatia, "2026-06-01", "2026-08-31"), true);
  assert.equal(valeNoPeriodo(sep.atletas[0], "2026-01-01", "2026-03-31"), false);
  assert.equal(valeNoPeriodo(sep.atletas[0], "2026-07", "2026-08"), true);
  assert.deepEqual(recortarNasJanelas(sep.atletas[0], "2026-06-01", "2026-09-30"), [{ de: "2026-08-01", ate: "2026-09-30" }]);
  // Sem ninguém com troca, nada muda.
  assert.deepEqual(separarPorModalidade({ atletas: [caio], lancamentos, resumos }).lancamentos, lancamentos);
});

test("ranking do ano: os km da Bike não entram na Corrida", () => {
  const sep = separarPorModalidade({ atletas: [bia, caio, duda], lancamentos, resumos });
  const ano = calcularResultadosRanking(sep.atletas, sep.lancamentos, "trimestre", "2026-01-01", "2026-12-31", sep.resumos);
  const linha = (id: string) => ano.find((r) => r.atletaId === id);
  assert.equal(linha("bia")?.km, 6);
  assert.equal(linha("bia")?.equipe, "corrida");
  assert.equal(linha("bia~bicicleta")?.km, 170);
  assert.equal(linha("bia~bicicleta")?.equipe, "bicicleta");
  // Último trimestre: Bia só aparece na Corrida (a fatia da Bike não aparece com zero).
  const t4 = calcularResultadosRanking(sep.atletas, sep.lancamentos, "trimestre", "2026-10-01", "2026-12-31", sep.resumos);
  assert.deepEqual(t4.map((r) => r.atletaId).sort(), ["bia", "caio", "duda"]);
});

test("reunião: mais km da Corrida é quem correu, não quem pedalou", () => {
  const sep = separarPorModalidade({ atletas: [bia, caio, duda], lancamentos, resumos });
  const comum = { atletas: sep.atletas, lancamentos: sep.lancamentos, resumosMensais: sep.resumos, inicio: "2026-01-01", fim: "2026-12-31" };
  const corrida = resultadosDaEquipe({ modalidade: "corrida", ...comum });
  const bike = resultadosDaEquipe({ modalidade: "bicicleta", ...comum });
  assert.equal([...corrida.ranking].sort((a, b) => b.km - a.km)[0].id, "caio");
  assert.equal(corrida.totais.km, 28);
  assert.equal(bike.totais.km, 210);
  assert.equal(bike.ranking[0].id, "bia~bicicleta");
});

const dados: DadosAnalise = { atletas: [bia, caio, duda], lancamentos, resumos, hoje: "2026-11-24" };
const cfg = (extra: Partial<ConfigAnalise>): ConfigAnalise => ({
  medida: "km",
  linhas: "atleta",
  colunas: null,
  periodo: { de: "2026-01-01", ate: "2026-12-31" },
  anterior: null,
  equipe: "todas",
  criterios: [],
  tipos: [],
  sexo: "todos",
  somenteAtivos: true,
  modo: "total",
  minimo: null,
  top: null,
  ...extra,
});

test("análises: recorte por equipe separa; todas as equipes mantém a pessoa inteira", () => {
  const corrida = executarAnalise(cfg({ equipe: "corrida" }), dados);
  assert.deepEqual(corrida.linhas.map((l) => [l.chave, l.valor]), [["caio", 22], ["bia", 6]]);
  const porEquipe = executarAnalise(cfg({ linhas: "equipe" }), dados);
  assert.deepEqual(Object.fromEntries(porEquipe.linhas.map((l) => [l.chave, l.valor])), { bicicleta: 210, corrida: 28 });
  const todas = executarAnalise(cfg({}), dados);
  assert.equal(todas.linhas.find((l) => l.chave === "bia")?.valor, 176);
});

test("premiação por equipe: o atleta do ano da Corrida não ganha com km da Bike", () => {
  const premio = { ...novoPremio("atleta-do-ano"), equipe: "separadas" as const, quantidade: 1, criterios: [{ id: "c", medida: "km" as const, peso: 100, exibir: "total" as const }] };
  const r = calcularPremio(premio, dados, { nome: "2026", inicio: "2026-01-01", fim: "2026-12-31" });
  const corrida = r.grupos.find((g) => g.equipe === "corrida")!;
  const bike = r.grupos.find((g) => g.equipe === "bicicleta")!;
  assert.equal(corrida.classificacao[0].id, "caio");
  assert.equal(bike.classificacao[0].id, "bia~bicicleta");
  assert.equal(bike.classificacao[0].nome, "BIA");
  assert.equal(bike.classificacao[0].equipe, "bicicleta");
});

test("informativo da Corrida: só os km corridos", () => {
  const info = montarInformativo({
    modalidade: "corrida",
    periodo: { de: "2026-06", ate: "2026-08" },
    atletas: [bia, caio, duda],
    lancamentos,
    resumosMensais: resumos,
    diasTreino: { corrida: { dias: [] }, bicicleta: { dias: [] } } as never,
    hoje: "2026-11-24",
  });
  assert.deepEqual(info.ranking.map((l) => [l.id, l.km]), [["caio", 22], ["bia", 6]]);
});

test("sugestão a partir dos lançamentos (troca antiga sem registro)", () => {
  const semRegistro = atleta("bia");
  assert.deepEqual(sugerirTroca(semRegistro, lancamentos.filter((l) => l.atletaId === "bia")), { de: "bicicleta", para: "corrida", data: "2026-08-10" });
  assert.equal(sugerirTroca(caio, lancamentos.filter((l) => l.atletaId === "caio")), null);
  assert.equal(sugerirTroca(bia, lancamentos.filter((l) => l.atletaId === "bia")), null, "já registrada");
});

test("validação das trocas", () => {
  assert.equal(problemaNasTrocas([{ de: "bicicleta", para: "corrida", data: "2026-08-01" }], "corrida"), null);
  assert.match(problemaNasTrocas([{ de: "bicicleta", para: "corrida", data: "" }], "corrida")!, /data/);
  assert.match(problemaNasTrocas([{ de: "corrida", para: "bicicleta", data: "2026-08-01" }], "corrida")!, /equipe atual/);
  assert.match(
    problemaNasTrocas([{ de: "bicicleta", para: "corrida", data: "2026-03-01" }, { de: "bicicleta", para: "corrida", data: "2026-08-01" }], "corrida")!,
    /não se encaixam/,
  );
});
