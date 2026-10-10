import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularMedalhas,
  calcularSequencia,
  distanciaNoRanking,
  equivalenciaDaEquipe,
  proximaMedalha,
  segundaDaSemana,
  textoDistancia,
} from "../src/lib/conquistas";
import type { HistoricoPontoDoc } from "../src/lib/types";

let n = 0;
function l(p: Partial<HistoricoPontoDoc>): HistoricoPontoDoc {
  n += 1;
  return {
    id: `l${n}`,
    atletaId: "a",
    atletaNome: "Ana",
    equipe: "corrida",
    regraId: "treino",
    regraDesc: "Participação em treino",
    pontos: 5,
    tipoLancamento: "treino",
    dataTreino: "2026-10-01",
    loteId: `lote${n}`,
    criadoPor: "u",
    criadoPorNome: "C",
    criadoEm: null,
    estornado: false,
    ...p,
  } as HistoricoPontoDoc;
}

test("semana começa na segunda", () => {
  assert.equal(segundaDaSemana("2026-10-11"), "2026-10-05"); // domingo
  assert.equal(segundaDaSemana("2026-10-05"), "2026-10-05");
});

test("sequência: semana justificada não quebra; semana atual sem treino ainda não quebra", () => {
  const lanc = [
    l({ dataTreino: "2026-09-15" }),
    l({ dataTreino: "2026-09-22" }),
    l({ regraId: "falta_justificada", regraDesc: "Falta justificada", pontos: 0, dataTreino: "2026-09-29" }),
    l({ dataTreino: "2026-10-06" }),
  ];
  const s = calcularSequencia(lanc, undefined, "2026-10-14"); // semana de 12/10 ainda sem treino
  assert.equal(s.atual, 3);
  assert.equal(s.treinouEstaSemana, false);
  const quebrou = calcularSequencia([l({ dataTreino: "2026-09-01" }), l({ dataTreino: "2026-10-06" })], undefined, "2026-10-07");
  assert.equal(quebrou.atual, 1);
  assert.equal(quebrou.melhor, 1);
});

test("medalhas: treinos, km com a data em que passou da meta, prova e recorde", () => {
  const lanc = [
    ...Array.from({ length: 10 }, (_, i) => l({ dataTreino: `2026-09-${String(i + 1).padStart(2, "0")}`, kmPercorrido: 6 })),
    l({ tipoLancamento: "evento", regraDesc: "Prova oficial", pontos: 20, dataTreino: "2026-09-20", kmPercorrido: 10 }),
    l({ tipoLancamento: "evento", regraDesc: "Recorde pessoal", pontos: 10, dataTreino: "2026-09-20", loteId: "x", kmPercorrido: 10 }),
    l({ dataTreino: "2026-09-25", estornado: true, kmPercorrido: 100 }),
  ];
  const { medalhas } = calcularMedalhas({ lancamentos: lanc, regrasTreino: undefined, modalidade: "corrida", hoje: "2026-10-01" });
  const m = Object.fromEntries(medalhas.map((x) => [x.id, x]));
  assert.equal(m.treinos_1.em, "2026-09-01");
  assert.equal(m.treinos_10.em, "2026-09-10");
  assert.equal(m.treinos_25.conquistada, false);
  assert.deepEqual(m.treinos_25.progresso, { atual: 10, meta: 25 });
  assert.equal(m.km_50.em, "2026-09-09"); // 9 × 6 = 54
  assert.equal(m.km_100.conquistada, false); // estorno não conta
  assert.equal(m.prova.conquistada, true);
  assert.equal(m.recorde.em, "2026-09-20");
  assert.equal(m.podio.conquistada, false);
  assert.equal(proximaMedalha(medalhas)?.id, "km_100");
});

test("medalhas do servidor e km da bike com outra escala", () => {
  const { medalhas } = calcularMedalhas({ lancamentos: [l({ equipe: "bicicleta", kmPercorrido: 300 })], regrasTreino: undefined, modalidade: "bicicleta", hoje: "2026-10-01", doServidor: { podio: "2026-09-30" } });
  const m = Object.fromEntries(medalhas.map((x) => [x.id, x]));
  assert.equal(m.km_250.conquistada, true);
  assert.equal(m.km_500.conquistada, false);
  assert.equal(m.podio.em, "2026-09-30");
  assert.equal(m.lider.conquistada, false);
});

test("quanto falta: até o 3º para quem está fora do pódio; empate conta", () => {
  const lista = [
    { atletaId: "a", pontos: 100 },
    { atletaId: "b", pontos: 90 },
    { atletaId: "c", pontos: 90 },
    { atletaId: "d", pontos: 80 },
    { atletaId: "e", pontos: 60 },
  ];
  assert.equal(textoDistancia(distanciaNoRanking(lista, "e")), "Faltam 20 pontos para o 3º lugar");
  assert.equal(textoDistancia(distanciaNoRanking(lista, "d")), "Faltam 10 pontos para o 2º lugar");
  assert.equal(textoDistancia(distanciaNoRanking(lista, "a")), "Você lidera, 10 pontos à frente do 2º");
});

test("equivalência da equipe", () => {
  assert.equal(equivalenciaDaEquipe(4817, "corrida"), "114 maratonas");
  assert.equal(equivalenciaDaEquipe(12561, "bicicleta"), "31% de uma volta ao mundo");
  assert.equal(equivalenciaDaEquipe(45000, "bicicleta"), "1,1 volta ao mundo");
});
