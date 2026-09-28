import assert from "node:assert/strict";
import test from "node:test";
import { calcularEstatisticasDashboard } from "../src/lib/dashboardStats";
import type { AtletaDoc, HistoricoPontoDoc } from "../src/lib/types";

const hoje = new Date();
const iso = (diasAtras: number) => {
  const d = new Date(hoje.getTime() - diasAtras * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function atleta(id: string, equipe: "corrida" | "bicicleta", pontuacaoTotal = 0): AtletaDoc {
  return { id, nome: id, email: null, role: "atleta", equipe, ativo: true, pontuacaoTotal, authUid: null, criadoEm: null, atualizadoEm: null } as AtletaDoc;
}

function lanc(p: Partial<HistoricoPontoDoc> & { atletaId: string; pontos: number; dataTreino: string; loteId: string }): HistoricoPontoDoc {
  return { id: `${p.atletaId}-${p.loteId}-${p.regraId ?? "r"}`, regraId: "r", regraDesc: "Regra", tipoLancamento: "treino", estornado: false, kmPercorrido: 0, ...p } as HistoricoPontoDoc;
}

test("cartão de modalidades usa a mesma consolidação do Ranking", () => {
  const atletas = [atleta("ana", "corrida"), atleta("paula", "bicicleta", 12), atleta("bruno", "bicicleta")];
  const lancamentos = [
    // Uma atividade com duas regras: 1 participação, 15 pontos, km contado uma vez.
    lanc({ atletaId: "ana", loteId: "l1", dataTreino: iso(2), pontos: 5, regraId: "treino", kmPercorrido: 8 }),
    lanc({ atletaId: "ana", loteId: "l1", dataTreino: iso(2), pontos: 10, regraId: "recorde", kmPercorrido: 8 }),
    // Falta justificada não conta como atividade.
    lanc({ atletaId: "bruno", loteId: "l2", dataTreino: iso(3), pontos: 0, regraId: "falta_justificada" }),
    lanc({ atletaId: "bruno", loteId: "l3", dataTreino: iso(40), pontos: 5 }),
  ];
  const s = calcularEstatisticasDashboard({ atletas, lancamentos, despesas: [], eventos: [], regras: [] });

  assert.equal(s.corrida.participacoes, 1);
  assert.equal(s.corrida.pontos, 15);
  assert.equal(s.corrida.km, 8);
  assert.equal(s.participacoesTotal, 2);

  // Pontuação importada sem lançamentos (paula) não entra no pódio nem nos totais.
  assert.deepEqual(s.podioBike.map((a) => [a.id, a.pontuacaoTotal]), [["bruno", 5]]);
  assert.equal(s.bike.pontos, 5);
  // Bruno só teve falta justificada nos últimos 30 dias: segue inativo.
  assert.deepEqual(s.bike.inativosList.map((a) => a.id).sort(), ["bruno", "paula"]);
  assert.equal(s.podioCorrida[0].pontuacaoTotal, s.corrida.pontos);
});
