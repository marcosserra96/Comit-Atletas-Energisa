import assert from "node:assert/strict";
import test from "node:test";
import {
  aderenciaDoAtleta,
  calcularAderencia,
  datasPrevistas,
  descreverDias,
  normalizarDiasTreino,
} from "../src/lib/aderencia";
import type { HistoricoPontoDoc } from "../src/lib/types";

// Setembro de 2026: dia 1 é terça.
const TER_QUI = { dias: [2, 4] as (2 | 4)[], desde: null };

test("datas previstas seguem a agenda, param em hoje e pulam datas sem treino", () => {
  assert.deepEqual(datasPrevistas(TER_QUI, "2026-09-01", "2026-09-10", [], "2026-09-30"), [
    "2026-09-01",
    "2026-09-03",
    "2026-09-08",
    "2026-09-10",
  ]);
  // Não conta o futuro.
  assert.deepEqual(datasPrevistas(TER_QUI, "2026-09-01", "2026-09-30", [], "2026-09-04"), ["2026-09-01", "2026-09-03"]);
  // Feriado / cancelamento.
  assert.deepEqual(datasPrevistas(TER_QUI, "2026-09-01", "2026-09-04", ["2026-09-03"], "2026-09-30"), ["2026-09-01"]);
  // Agenda só vale a partir de "desde".
  assert.deepEqual(
    datasPrevistas({ dias: [2, 4], desde: "2026-09-05" }, "2026-09-01", "2026-09-10", [], "2026-09-30"),
    ["2026-09-08", "2026-09-10"],
  );
  assert.deepEqual(datasPrevistas({ dias: [], desde: null }, "2026-09-01", "2026-09-30", [], "2026-09-30"), []);
});

test("aderência desconta faltas justificadas e não passa de 100%", () => {
  const previstas = ["2026-09-01", "2026-09-03", "2026-09-08", "2026-09-10"];
  assert.deepEqual(calcularAderencia({ previstas, treinosFeitos: 3 }), { feitos: 3, previstos: 4, percentual: 75 });
  assert.deepEqual(calcularAderencia({ previstas, treinosFeitos: 3, faltasJustificadas: ["2026-09-08"] }), {
    feitos: 3,
    previstos: 3,
    percentual: 100,
  });
  assert.equal(calcularAderencia({ previstas, treinosFeitos: 9 }).percentual, 100);
  assert.equal(calcularAderencia({ previstas: [], treinosFeitos: 2 }).percentual, null);
});

test("aderência do atleta usa treinos consolidados e o histórico mensal", () => {
  const base = { atletaId: "a", atletaNome: "A", equipe: "corrida", regraDesc: "", criadoPor: "", criadoPorNome: "", criadoEm: null, estornado: false, pontos: 5, tipoLancamento: "treino" };
  const lancamentos = [
    // Mesma atividade com duas regras conta como 1 treino.
    { ...base, id: "1", regraId: "treino", loteId: "l1", dataTreino: "2026-09-01" },
    { ...base, id: "2", regraId: "recorde", loteId: "l1", dataTreino: "2026-09-01" },
    { ...base, id: "3", regraId: "falta_justificada", loteId: "l2", dataTreino: "2026-09-03", pontos: 0 },
    { ...base, id: "4", regraId: "treino", loteId: "l3", dataTreino: "2026-09-08", estornado: true },
  ] as HistoricoPontoDoc[];
  const config = normalizarDiasTreino({ corrida: TER_QUI });
  const r = aderenciaDoAtleta({ modalidade: "corrida", config, lancamentos, de: "2026-09-01", ate: "2026-09-10", hoje: "2026-09-30" });
  // Previstos 4 − 1 falta = 3; feito 1.
  assert.deepEqual(r, { feitos: 1, previstos: 3, percentual: 33 });
  const comMensal = aderenciaDoAtleta({
    modalidade: "corrida", config, lancamentos, de: "2026-09-01", ate: "2026-09-10", hoje: "2026-09-30",
    resumosMensais: [{ competencia: "2026-09", treinos: 1 } as never],
  });
  assert.equal(comMensal.percentual, 67);
});

test("descreverDias lista na ordem da semana", () => {
  assert.equal(descreverDias([6, 2, 4]), "Ter, Qui e Sáb");
  assert.equal(descreverDias([0]), "Dom");
  assert.equal(descreverDias([]), "Sem treinos definidos");
});

function mensal(competencia: string, treinos: number, aderencia?: number | null) {
  return {
    id: `${competencia}_a1`, atletaId: "a1", atletaNome: "A", equipe: "corrida" as const, competencia,
    pontos: 0, km: 0, treinos, aderencia, criadoPor: "x", criadoPorNome: "x", criadoEm: null,
  };
}

test("aderência informada no histórico mensal vale para mês sem agenda", () => {
  const config = normalizarDiasTreino({ corrida: { dias: [2, 4], desde: "2026-09-01" } });
  const r = aderenciaDoAtleta({
    modalidade: "corrida", config, lancamentos: [], resumosMensais: [mensal("2026-08", 6, 80)],
    de: "2026-08-01", ate: "2026-08-31", hoje: "2026-09-30",
  });
  assert.equal(r.percentual, 80);
  assert.equal(r.informada, true);
});

test("aderência informada substitui o cálculo quando havia agenda", () => {
  // Setembro/2026 com Ter e Qui: 9 treinos previstos; 3 feitos daria 33%.
  const config = normalizarDiasTreino({ corrida: { dias: [2, 4], desde: null } });
  const r = aderenciaDoAtleta({
    modalidade: "corrida", config, lancamentos: [], resumosMensais: [mensal("2026-09", 3, 90)],
    de: "2026-09-01", ate: "2026-09-30", hoje: "2026-09-30",
  });
  assert.equal(r.previstos, 9);
  assert.equal(r.percentual, 90);
  // 95% de 9 previstos não pode virar 100% por arredondamento.
  const r95 = aderenciaDoAtleta({
    modalidade: "corrida", config, lancamentos: [], resumosMensais: [mensal("2026-09", 3, 95)],
    de: "2026-09-01", ate: "2026-09-30", hoje: "2026-09-30",
  });
  assert.equal(r95.percentual, 95);
});

test("período misto: mês informado sem agenda pesa como um mês comum", () => {
  // Agosto sem agenda (informado 100%), setembro calculado: 9 previstos, 0 feitos.
  const config = normalizarDiasTreino({ corrida: { dias: [2, 4], desde: "2026-09-01" } });
  const r = aderenciaDoAtleta({
    modalidade: "corrida", config, lancamentos: [], resumosMensais: [mensal("2026-08", 8, 100)],
    de: "2026-08-01", ate: "2026-09-30", hoje: "2026-09-30",
  });
  assert.equal(r.percentual, 50);
});

test("sem aderência informada o cálculo continua o mesmo", () => {
  const config = normalizarDiasTreino({ corrida: { dias: [2, 4], desde: null } });
  const r = aderenciaDoAtleta({
    modalidade: "corrida", config, lancamentos: [], resumosMensais: [mensal("2026-09", 3, null)],
    de: "2026-09-01", ate: "2026-09-30", hoje: "2026-09-30",
  });
  assert.deepEqual(r, { feitos: 3, previstos: 9, percentual: 33 });
});
