import assert from "node:assert/strict";
import test from "node:test";
import { consolidarAtividades } from "../src/lib/activityConsolidation";
import { dataIsoLocal } from "../src/lib/date";
import { modalidadeDoAtleta, rankingOcultoAgora } from "../src/lib/rankingVisibility";
import type { RankingVisibilityConfigDoc } from "../src/lib/types";
import type { HistoricoPontoDoc } from "../src/lib/types";

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
