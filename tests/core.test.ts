import assert from "node:assert/strict";
import test from "node:test";
import { consolidarAtividades } from "../src/lib/activityConsolidation";
import { dataIsoLocal } from "../src/lib/date";
import { modalidadeDoAtleta, rankingOcultoAgora } from "../src/lib/rankingVisibility";
import { calcularResultadosRanking } from "../src/lib/rankingPeriods";
import type { RankingVisibilityConfigDoc } from "../src/lib/types";
import type { AtletaDoc, HistoricoPontoDoc } from "../src/lib/types";

function lancamento(
  overrides: Partial<HistoricoPontoDoc> = {},
): HistoricoPontoDoc {
  return {
    id: "registro-1",
    atletaId: "atleta-1",
    atletaNome: "Atleta",
    equipe: "corrida",
    regraId: "participacao",
    regraDesc: "Participação",
    pontos: 5,
    kmPercorrido: 10,
    tipoLancamento: "treino",
    dataTreino: "2026-09-14",
    loteId: "lote-1",
    criadoPor: "admin",
    criadoPorNome: "Admin",
    criadoEm: null,
    estornado: false,
    ...overrides,
  };
}

test("consolida regras do mesmo treino sem multiplicar KM", () => {
  const atividades = consolidarAtividades([
    lancamento(),
    lancamento({ id: "registro-2", regraId: "distancia", pontos: 3, kmPercorrido: 10 }),
  ]);

  assert.equal(atividades.length, 1);
  assert.equal(atividades[0].pontos, 8);
  assert.equal(atividades[0].km, 10);
});

test("não junta o mesmo lote usado em datas diferentes", () => {
  const atividades = consolidarAtividades([
    lancamento(),
    lancamento({ id: "registro-2", dataTreino: "2026-09-15" }),
  ]);

  assert.equal(atividades.length, 2);
});

test("ignora estornos e falta justificada como atividade realizada", () => {
  const atividades = consolidarAtividades([
    lancamento({ estornado: true }),
    lancamento({ id: "registro-2", regraId: "falta_justificada", pontos: 0 }),
  ]);

  assert.deepEqual(atividades, []);
});

test("formata a data civil usando os componentes locais", () => {
  assert.equal(dataIsoLocal(new Date(2026, 8, 14, 23, 30)), "2026-09-14");
});


const visibilidade: RankingVisibilityConfigDoc = {
  corrida: {
    ativo: true,
    inicio: "2026-09-10",
    fim: "2026-09-20",
    mensagem: "Fechamento",
  },
  bicicleta: {
    ativo: false,
    inicio: "",
    fim: "",
    mensagem: "",
  },
};

test("oculta o ranking apenas dentro do período inclusivo", () => {
  assert.equal(rankingOcultoAgora(visibilidade, "corrida", "2026-09-09"), false);
  assert.equal(rankingOcultoAgora(visibilidade, "corrida", "2026-09-10"), true);
  assert.equal(rankingOcultoAgora(visibilidade, "corrida", "2026-09-20"), true);
  assert.equal(rankingOcultoAgora(visibilidade, "corrida", "2026-09-21"), false);
  assert.equal(rankingOcultoAgora(visibilidade, "bicicleta", "2026-09-15"), false);
});

test("converte equipes e filas para a modalidade do atleta", () => {
  assert.equal(modalidadeDoAtleta("corrida"), "corrida");
  assert.equal(modalidadeDoAtleta("fila_bicicleta"), "bicicleta");
  assert.equal(modalidadeDoAtleta("comite"), null);
});


function atletaRanking(overrides: Partial<AtletaDoc> = {}): AtletaDoc {
  return {
    id: "atleta-1",
    nome: "Atleta",
    email: null,
    role: "atleta",
    equipe: "corrida",
    ativo: true,
    pontuacaoTotal: 0,
    authUid: null,
    criadoEm: null,
    atualizadoEm: null,
    ...overrides,
  };
}

test("calcula pontos, treinos e KM sem duplicar regras do mesmo treino", () => {
  const resultados = calcularResultadosRanking(
    [atletaRanking()],
    [
      lancamento(),
      lancamento({
        id: "registro-2",
        regraId: "distancia",
        pontos: 3,
        kmPercorrido: 10,
      }),
    ],
    "geral",
  );

  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].pontuacaoTotal, 8);
  assert.equal(resultados[0].treinos, 1);
  assert.equal(resultados[0].km, 10);
});

test("respeita datas personalizadas do ranking trimestral", () => {
  const resultados = calcularResultadosRanking(
    [atletaRanking()],
    [
      lancamento({ dataTreino: "2026-06-30" }),
      lancamento({ id: "registro-2", loteId: "lote-2", dataTreino: "2026-07-01" }),
      lancamento({ id: "registro-3", loteId: "lote-3", dataTreino: "2026-09-30" }),
      lancamento({ id: "registro-4", loteId: "lote-4", dataTreino: "2026-10-01" }),
    ],
    "trimestre",
    "2026-07-01",
    "2026-09-30",
  );

  assert.equal(resultados[0].pontuacaoTotal, 10);
  assert.equal(resultados[0].treinos, 2);
  assert.equal(resultados[0].km, 20);
});
