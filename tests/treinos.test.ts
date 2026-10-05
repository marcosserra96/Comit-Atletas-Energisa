import assert from "node:assert/strict";
import test from "node:test";
import { consolidarAtividades, regraContaComoTreino, regrasDeTreino } from "../src/lib/activityConsolidation";
import { calcularResumoRankingPeriodo } from "../src/lib/rankingMensal";
import type { AtletaDoc, HistoricoPontoDoc, TipoLancamento } from "../src/lib/types";

function lanc(dia: string, regraId: string, tipo: TipoLancamento, pontos = 1): HistoricoPontoDoc {
  return {
    id: `${dia}-${regraId}`, atletaId: "w", atletaNome: "Weslei", equipe: "corrida", regraId, regraDesc: regraId,
    pontos, tipoLancamento: tipo, dataTreino: `2026-09-${dia}`, loteId: "importacao-unica",
    criadoPor: "g", criadoPorNome: "Gabriel", criadoEm: null, estornado: false,
  } as unknown as HistoricoPontoDoc;
}

const regras = [
  { id: "dia_hora", descricao: "Dia/Hora Definido + Uniforme", tiposLancamento: ["treino"] as TipoLancamento[] },
  { id: "avulso", descricao: "Treino avulso", tiposLancamento: ["avulso"] as TipoLancamento[] },
  { id: "extra", descricao: "Treino extra", tiposLancamento: ["avulso", "treino"] as TipoLancamento[] },
  { id: "ajuste", descricao: "Ajuste aprovado pelo comitê", tiposLancamento: ["avulso"] as TipoLancamento[] },
  { id: "post", descricao: "Treino na rede social", tiposLancamento: ["avulso"] as TipoLancamento[], contaComoTreino: false },
];

test("critério conta como treino: tipo Treino, nome com 'treino' ou marcado no cadastro", () => {
  assert.deepEqual([...regrasDeTreino(regras)].sort(), ["avulso", "dia_hora", "extra"]);
  assert.equal(regraContaComoTreino({ descricao: "Bônus", tiposLancamento: ["avulso"], contaComoTreino: true }), true);
});

test("treinos lançados como Avulso de critério de treino entram na contagem", () => {
  const lancamentos = [
    ...["03", "10", "19", "24", "26"].map((d) => lanc(d, "avulso", "avulso")),
    ...["09", "14", "16", "21"].map((d) => lanc(d, "dia_hora", "treino", 2)),
    lanc("30", "ajuste", "avulso", 5),
  ];
  const ids = regrasDeTreino(regras);
  const atividades = consolidarAtividades(lancamentos, ids);
  assert.equal(atividades.filter((a) => a.tipo === "treino").length, 9);
  // Sem os critérios, só os do tipo Treino contavam (o problema relatado).
  assert.equal(consolidarAtividades(lancamentos).filter((a) => a.tipo === "treino").length, 4);

  const atletas = [{ id: "w", nome: "Weslei", equipe: "corrida", ativo: true } as unknown as AtletaDoc];
  const [r] = calcularResumoRankingPeriodo({ atletas, lancamentos, de: "2026-09", ate: "2026-09", regrasTreino: ids });
  assert.equal(r.treinosMes, 9);
  assert.equal(r.pontosMes, 5 + 8 + 5);
});

test("presença em reunião soma pontos mas nunca conta como treino", () => {
  const reuniao = { ...lanc("05", "reuniao_regra", "reuniao", 3), eventoId: "r1", loteId: "reuniao_r1" } as HistoricoPontoDoc;
  // Mesmo que o critério estivesse marcado como treino, reunião não vira treino.
  const atividades = consolidarAtividades([reuniao], new Set(["reuniao_regra"]));
  assert.equal(atividades.filter((a) => a.tipo === "treino").length, 0);
  assert.equal(atividades[0].pontos, 3);
});
