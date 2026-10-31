import test from "node:test";
import assert from "node:assert/strict";
import {
  acaoDePontosDoDesafio,
  agruparPorAtleta,
  desafiosDoAtleta,
  diasRestantes,
  mensagemDeDesafioNovo,
  participacaoNoDesafio,
  progressoNoDesafio,
  statusDoDesafio,
  textoMetaGestao,
  textoPeriodo,
  validarDesafio,
  type DesafioDoc,
} from "../src/lib/desafios";
import { proximaMedalha, textoProgresso } from "../src/lib/conquistas";
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

function d(p: Partial<DesafioDoc>): DesafioDoc {
  return {
    id: "d1",
    titulo: "Outubro Rosa",
    modalidade: "todas",
    tipo: "km",
    metas: { corrida: 40, bicicleta: 150 },
    inicio: "2026-10-01",
    fim: "2026-10-31",
    icone: "coracao",
    nivel: 3,
    ...p,
  };
}

test("validação: nome, metas por modalidade, datas e semanas possíveis", () => {
  const base = { titulo: "Outubro Rosa", modalidade: "todas", tipo: "km", metas: { corrida: 40, bicicleta: 150 }, inicio: "2026-10-01", fim: "2026-10-31", icone: "coracao", nivel: 3 };
  const ok = validarDesafio(base);
  assert.ok("dados" in ok && ok.dados.metas.bicicleta === 150);
  assert.ok("erro" in validarDesafio({ ...base, titulo: "ab" }));
  assert.match((validarDesafio({ ...base, metas: { corrida: 40 } }) as { erro: string }).erro, /Bike/);
  assert.ok("erro" in validarDesafio({ ...base, metas: { corrida: 40.5, bicicleta: 150 } }));
  assert.ok("erro" in validarDesafio({ ...base, fim: "2026-09-30" }));
  // Só a modalidade escolhida entra nas metas.
  const corrida = validarDesafio({ ...base, modalidade: "corrida", metas: { corrida: 40, bicicleta: 999 } });
  assert.deepEqual("dados" in corrida && corrida.dados.metas, { corrida: 40 });
  // Outubro de 2026 tem 5 semanas (começando segunda 28/09).
  assert.match((validarDesafio({ ...base, tipo: "semanas", metas: { corrida: 6, bicicleta: 6 } }) as { erro: string }).erro, /5 semanas/);
  assert.ok("dados" in validarDesafio({ ...base, tipo: "semanas", metas: { corrida: 5, bicicleta: 5 } }));
});

test("status, dias restantes e textos de período", () => {
  const x = d({});
  assert.equal(statusDoDesafio(x, "2026-09-30"), "agendado");
  assert.equal(statusDoDesafio(x, "2026-10-31"), "ativo");
  assert.equal(statusDoDesafio(x, "2026-11-01"), "encerrado");
  assert.equal(diasRestantes(x, "2026-10-31"), 1);
  assert.equal(diasRestantes(x, "2026-10-10"), 22);
  assert.equal(textoPeriodo(x), "1 a 31 de outubro");
  assert.equal(textoPeriodo({ inicio: "2026-10-15", fim: "2026-11-15" }), "15/10 a 15/11");
  assert.equal(textoMetaGestao(x), "40 km na Corrida, 150 km na Bike");
  assert.equal(textoMetaGestao(d({ tipo: "treinos", metas: { corrida: 8, bicicleta: 8 } })), "8 treinos");
  assert.equal(mensagemDeDesafioNovo(x, "corrida", "2026-10-10").corpo, "Some 40 km de 1 a 31 de outubro e ganhe a medalha.");
});

test("km: só dentro do período, km do mesmo treino conta uma vez, completa no dia certo", () => {
  const lanc = [
    l({ dataTreino: "2026-09-30", kmPercorrido: 30 }), // antes do período
    l({ dataTreino: "2026-10-03", kmPercorrido: 15, loteId: "x" }),
    l({ dataTreino: "2026-10-03", kmPercorrido: 15, loteId: "x", regraId: "bonus", pontos: 2 }), // mesmo treino
    l({ dataTreino: "2026-10-08", kmPercorrido: 20 }),
    l({ dataTreino: "2026-10-09", kmPercorrido: 12, estornado: true }),
    l({ dataTreino: "2026-10-12", kmPercorrido: 10 }),
  ];
  const p = progressoNoDesafio({ desafio: d({}), modalidade: "corrida", lancamentos: lanc, regrasTreino: undefined, hoje: "2026-10-20" })!;
  assert.deepEqual(p, { atual: 40, meta: 40, concluidoEm: "2026-10-12" });
  // Antes de 12/10 ainda faltava.
  const antes = progressoNoDesafio({ desafio: d({}), modalidade: "corrida", lancamentos: lanc, regrasTreino: undefined, hoje: "2026-10-10" })!;
  assert.deepEqual(antes, { atual: 35, meta: 40, concluidoEm: null });
  // Bike tem meta própria; desafio só de Corrida não vale para Bike.
  assert.equal(progressoNoDesafio({ desafio: d({}), modalidade: "bicicleta", lancamentos: lanc, regrasTreino: undefined, hoje: "2026-10-20" })!.meta, 150);
  assert.equal(progressoNoDesafio({ desafio: d({ modalidade: "corrida", metas: { corrida: 40 } }), modalidade: "bicicleta", lancamentos: lanc, regrasTreino: undefined, hoje: "2026-10-20" }), null);
});

test("semanas: semanas diferentes com treino; treinos e provas", () => {
  const lanc = [
    l({ dataTreino: "2026-10-01" }),
    l({ dataTreino: "2026-10-02" }), // mesma semana
    l({ dataTreino: "2026-10-07" }),
    l({ dataTreino: "2026-10-21" }),
    l({ dataTreino: "2026-10-18", tipoLancamento: "evento", regraId: "prova", regraDesc: "Prova", kmPercorrido: 10 }),
  ];
  const semanas = progressoNoDesafio({ desafio: d({ tipo: "semanas", metas: { corrida: 3 }, modalidade: "corrida" }), modalidade: "corrida", lancamentos: lanc, regrasTreino: undefined, hoje: "2026-10-31" })!;
  assert.deepEqual(semanas, { atual: 3, meta: 3, concluidoEm: "2026-10-21" });
  const treinos = progressoNoDesafio({ desafio: d({ tipo: "treinos", metas: { corrida: 5 }, modalidade: "corrida" }), modalidade: "corrida", lancamentos: lanc, regrasTreino: undefined, hoje: "2026-10-31" })!;
  assert.equal(treinos.atual, 4);
  assert.equal(treinos.concluidoEm, null);
  const provas = progressoNoDesafio({ desafio: d({ tipo: "provas", metas: { corrida: 1 }, modalidade: "corrida" }), modalidade: "corrida", lancamentos: lanc, regrasTreino: undefined, hoje: "2026-10-31" })!;
  assert.equal(provas.concluidoEm, "2026-10-18");
});

test("lista do atleta: ativos primeiro, encerrados só se completou; medalha com unidade", () => {
  const lanc = [l({ dataTreino: "2026-09-10", kmPercorrido: 50 })];
  const lista = desafiosDoAtleta({
    desafios: [
      d({ id: "set", titulo: "Setembro", inicio: "2026-09-01", fim: "2026-09-30" }), // completou
      d({ id: "ago", titulo: "Agosto", inicio: "2026-08-01", fim: "2026-08-31" }), // não completou: some
      d({ id: "nov", titulo: "Novembro", inicio: "2026-11-01", fim: "2026-11-30" }),
      d({ id: "out" }),
    ],
    modalidade: "corrida",
    lancamentos: lanc,
    regrasTreino: undefined,
    hoje: "2026-10-10",
  });
  assert.deepEqual(lista.map((x) => x.desafio.id), ["out", "nov", "set"]);
  const set = lista[2].medalha;
  assert.equal(set.id, "desafio_set");
  assert.equal(set.conquistada, true);
  assert.equal(textoProgresso(lista[0].medalha), "0 de 40 km");
  // Desafio não entra como "próxima medalha" das permanentes.
  assert.equal(proximaMedalha([lista[0].medalha]), null);
});

test("gestão: participação só de ativos da modalidade, concluídos primeiro", () => {
  const lanc = [
    l({ atletaId: "b", dataTreino: "2026-10-05", kmPercorrido: 45 }),
    l({ atletaId: "c", dataTreino: "2026-10-03", kmPercorrido: 41 }),
    l({ atletaId: "a", dataTreino: "2026-10-04", kmPercorrido: 20 }),
  ];
  const atletas = [
    { id: "a", nome: "Ana", equipe: "corrida", ativo: true },
    { id: "b", nome: "Bia", equipe: "corrida", ativo: true },
    { id: "c", nome: "Caio", equipe: "corrida", ativo: true },
    { id: "z", nome: "Zé", equipe: "corrida", ativo: false },
    { id: "f", nome: "Fila", equipe: "fila_corrida", ativo: true },
    { id: "k", nome: "Kika", equipe: "bicicleta", ativo: true },
  ];
  const r = participacaoNoDesafio({ desafio: d({ modalidade: "corrida", metas: { corrida: 40 } }), atletas, porAtleta: agruparPorAtleta(lanc), regrasTreino: undefined, hoje: "2026-10-10" });
  assert.deepEqual(r.participantes.map((p) => p.atleta.id), ["c", "b", "a"]);
  assert.equal(r.concluidos, 2);
});

test("pontos do desafio: cria, ajusta, estorna e respeita estorno do comitê", () => {
  const ativo = { estornado: false, pontos: 20, dataTreino: "2026-10-12" };
  // Completou: cria no dia em que completou.
  assert.deepEqual(acaoDePontosDoDesafio({ pontos: 20, concluidoEm: "2026-10-12", existente: null }), { acao: "criar", pontos: 20, data: "2026-10-12" });
  // Só medalha ou não completou: nada.
  assert.equal(acaoDePontosDoDesafio({ pontos: 0, concluidoEm: "2026-10-12", existente: null }), null);
  assert.equal(acaoDePontosDoDesafio({ pontos: 20, concluidoEm: null, existente: null }), null);
  // Já tem e está igual: nada.
  assert.equal(acaoDePontosDoDesafio({ pontos: 20, concluidoEm: "2026-10-12", existente: ativo }), null);
  // Mudou o valor ou o dia em que completou: ajusta.
  assert.deepEqual(acaoDePontosDoDesafio({ pontos: 30, concluidoEm: "2026-10-12", existente: ativo }), { acao: "atualizar", pontos: 30, data: "2026-10-12" });
  // Deixou de completar, passou a valer 0 ou foi excluído: estorna, dizendo o motivo.
  assert.match((acaoDePontosDoDesafio({ pontos: 20, concluidoEm: null, existente: ativo }) as { motivo: string }).motivo, /deixou de estar completo/);
  assert.match((acaoDePontosDoDesafio({ pontos: 0, concluidoEm: "2026-10-12", existente: ativo }) as { motivo: string }).motivo, /deixou de valer pontos/);
  assert.match((acaoDePontosDoDesafio({ pontos: null, concluidoEm: null, existente: ativo }) as { motivo: string }).motivo, /excluído/);
  // Estorno do portal e voltou a completar: reativa. Estorno do comitê: respeita.
  assert.equal(acaoDePontosDoDesafio({ pontos: 20, concluidoEm: "2026-10-15", existente: { ...ativo, estornado: true, estornoAutomatico: true } })?.acao, "reativar");
  assert.equal(acaoDePontosDoDesafio({ pontos: 20, concluidoEm: "2026-10-15", existente: { ...ativo, estornado: true } }), null);
});

test("validação dos pontos do desafio e aviso de desafio novo", () => {
  const base = { titulo: "Outubro Rosa", modalidade: "corrida", tipo: "km", metas: { corrida: 40 }, inicio: "2026-10-01", fim: "2026-10-31" };
  const ok = validarDesafio({ ...base, pontos: "20" });
  assert.ok("dados" in ok && ok.dados.pontos === 20);
  const sem = validarDesafio(base);
  assert.ok("dados" in sem && sem.dados.pontos === 0);
  assert.ok("erro" in validarDesafio({ ...base, pontos: 2.5 }));
  assert.ok("erro" in validarDesafio({ ...base, pontos: 501 }));
  const d = { ...(ok as { dados: object }).dados, id: "x" } as Parameters<typeof mensagemDeDesafioNovo>[0];
  assert.match(mensagemDeDesafioNovo(d, "corrida", "2026-10-01").corpo, /ganhe a medalha e 20 pontos\./);
});
