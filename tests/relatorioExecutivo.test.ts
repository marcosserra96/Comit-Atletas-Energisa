import test from "node:test";
import assert from "node:assert/strict";
import { montarRelatorio, periodosDoRelatorio } from "../src/lib/relatorioExecutivo";
import type { AtletaDoc, DespesaDoc, EventoDoc, HistoricoPontoDoc } from "../src/lib/types";

const TRI = [
  { id: "t2", nome: "2º trimestre", inicio: "2026-06-01", fim: "2026-08-31" },
  { id: "t3", nome: "3º trimestre", inicio: "2026-09-01", fim: "2026-11-30" },
];

test("períodos: trimestre atual parcial compara com o mesmo trecho do anterior", () => {
  const p = periodosDoRelatorio(TRI, "2026-10-11");
  assert.deepEqual(p.map((x) => x.id), ["trimestre_atual", "trimestre_anterior", "mes_atual", "mes_anterior", "ano"]);
  const atual = p[0];
  assert.equal(atual.ate, "2026-10-11");
  assert.equal(atual.parcial, true);
  // 40 dias corridos desde 1/9 → anterior de 1/6 a 11/7.
  assert.deepEqual(atual.anterior && { inicio: atual.anterior.inicio, fim: atual.anterior.fim }, { inicio: "2026-06-01", fim: "2026-07-11" });
  const mesAnterior = p.find((x) => x.id === "mes_anterior")!;
  assert.equal(mesAnterior.nome, "Setembro de 2026");
  assert.equal(mesAnterior.parcial, false);
  assert.deepEqual([mesAnterior.anterior!.inicio, mesAnterior.anterior!.fim], ["2026-08-01", "2026-08-31"]);
  // Sem calendário: só mês e ano.
  assert.deepEqual(periodosDoRelatorio([], "2026-01-15").map((x) => x.id), ["mes_atual", "mes_anterior", "ano"]);
});

let n = 0;
function l(p: Partial<HistoricoPontoDoc>): HistoricoPontoDoc {
  n += 1;
  return { id: `l${n}`, atletaId: "a", atletaNome: "Ana", equipe: "corrida", regraId: "treino", regraDesc: "Treino", pontos: 5, tipoLancamento: "treino", dataTreino: "2026-09-10", loteId: `lote${n}`, criadoPor: "u", criadoPorNome: "C", criadoEm: null, estornado: false, ...p } as HistoricoPontoDoc;
}
const atleta = (id: string, nome: string, equipe: string, extra: Partial<AtletaDoc> = {}) => ({ id, nome, equipe, ativo: true, pontuacaoTotal: 0, ...extra }) as AtletaDoc;

test("relatório: totais, variação, pódio, quem está parado e investimento do ano", () => {
  const atletas = [atleta("a", "Ana", "corrida"), atleta("b", "Bia", "corrida", { entrouNaEquipeEm: "2026-09-20" }), atleta("c", "Caio", "bicicleta"), atleta("f", "Fila", "fila_corrida")];
  const lancamentos = [
    l({ atletaId: "a", dataTreino: "2026-09-10", kmPercorrido: 10 }),
    l({ atletaId: "a", dataTreino: "2026-10-05", kmPercorrido: 12 }),
    l({ atletaId: "b", dataTreino: "2026-09-25", kmPercorrido: 8 }),
    l({ atletaId: "a", dataTreino: "2026-06-10", kmPercorrido: 5 }), // período anterior
    l({ atletaId: "c", equipe: "bicicleta", dataTreino: "2026-07-01", kmPercorrido: 40 }), // anterior; Caio parado desde então
  ];
  const despesas = [
    { anoReferencia: 2026, totalRealizado: 300, totalProposto: 1000, avulso: false },
    { anoReferencia: 2025, totalRealizado: 999, totalProposto: 999, avulso: false },
  ] as DespesaDoc[];
  const eventos = [
    { id: "e1", titulo: "Prova X", data: "2026-09-12", local: "Cataguases", modalidade: "corrida" },
    { id: "e2", titulo: "Corrida de Natal", data: "2026-11-22", local: "Juiz de Fora", modalidade: "corrida", inscritos: ["a"] },
  ] as EventoDoc[];
  const periodo = periodosDoRelatorio(TRI, "2026-10-11")[0];
  const r = montarRelatorio({ periodo, atletas, lancamentos, resumosMensais: [], eventos, despesas, hoje: "2026-10-11" });

  assert.equal(r.treinos.valor, 3);
  assert.equal(r.treinos.anterior, 2);
  assert.equal(r.treinos.variacao, 50);
  assert.equal(r.km.valor, 30);
  assert.deepEqual([r.treinaram.valor, r.treinaram.total, r.treinaram.pct], [2, 3, 67]);
  assert.equal(r.equipes[0].podio[0].nome, "Ana");
  assert.deepEqual(r.novos.map((x) => x.nome), ["Bia"]);
  assert.deepEqual(r.semTreinar.map((x) => [x.nome, x.ultimo]), [["Caio", "2026-07-01"]]);
  assert.deepEqual(r.fila, { corrida: 1, bike: 0 });
  assert.deepEqual(r.eventosSemPontos.map((e) => e.titulo), ["Prova X"]);
  assert.equal(r.proximosEventos[0].confirmados, 1);
  assert.deepEqual(r.investimento && [r.investimento.realizado, r.investimento.previsto, r.investimento.treinosNoAno], [300, 1000, 5]);
  assert.equal(r.serie.length, 6);
  assert.equal(r.serie.at(-1)!.rotulo, "out");
  assert.match(r.resumo, /^2 de 3 atletas treinaram \(67%\), somando 3 treinos e 30 km\. 50% mais treinos que no período anterior, no mesmo ponto do período\.$/);
});
