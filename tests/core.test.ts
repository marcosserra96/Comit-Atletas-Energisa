import assert from "node:assert/strict";
import test from "node:test";
import { consolidarAtividades } from "../src/lib/activityConsolidation";
import { dataIsoLocal } from "../src/lib/date";
import { modalidadeDoAtleta, rankingOcultoAgora } from "../src/lib/rankingVisibility";
import { calcularResultadosRanking } from "../src/lib/rankingPeriods";
import { calcularPosicoesRanking } from "../src/lib/rankingPosition";
import { perfilAtletaVisivel } from "../src/lib/athleteVisibility";
import {
  diasNoIntervalo,
  intervaloAusenciaValido,
  justificativaAbrangeData,
  justificativasAusenciaSobrepostas,
  periodosAusenciaSobrepostos,
} from "../src/lib/justificativasAusencia";
import {
  DOCUMENTOS_POR_MODALIDADE,
  aceiteDocumentoProgramaId,
  documentoProgramaComFallback,
  modalidadeDocumentoDaEquipe,
  modalidadeDocumentoLabel,
} from "../src/lib/termosPrograma";
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
  exibirParaAtletas: true,
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

test("atribui a mesma posição a pontuações empatadas sem critério de desempate", () => {
  assert.deepEqual(calcularPosicoesRanking([50, 40, 40, 25]), [1, 2, 2, 4]);
  assert.deepEqual(calcularPosicoesRanking([50, 50, 50, 25]), [1, 1, 1, 4]);
});

test("mantém cadastros antigos visíveis e respeita a ocultação explícita", () => {
  assert.equal(perfilAtletaVisivel(atletaRanking()), true);
  assert.equal(perfilAtletaVisivel(atletaRanking({ visivelNasListas: true })), true);
  assert.equal(perfilAtletaVisivel(atletaRanking({ visivelNasListas: false })), false);
});

test("não publica perfil oculto no ranking", () => {
  const resultados = calcularResultadosRanking(
    [atletaRanking({ visivelNasListas: false })],
    [lancamento()],
    "geral",
  );

  assert.deepEqual(resultados, []);
});

test("valida e calcula períodos civis de ausência", () => {
  assert.equal(intervaloAusenciaValido("2026-09-20", "2026-09-22"), true);
  assert.equal(intervaloAusenciaValido("2026-09-22", "2026-09-20"), false);
  assert.equal(intervaloAusenciaValido("2026-02-30", "2026-03-01"), false);
  assert.equal(diasNoIntervalo("2026-09-20", "2026-09-22"), 3);
});

test("detecta sobreposição inclusiva entre justificativas", () => {
  assert.equal(
    periodosAusenciaSobrepostos("2026-09-10", "2026-09-15", "2026-09-15", "2026-09-20"),
    true,
  );
  assert.equal(
    periodosAusenciaSobrepostos("2026-09-10", "2026-09-14", "2026-09-15", "2026-09-20"),
    false,
  );
});

test("aplica automaticamente apenas justificativa aprovada dentro do período", () => {
  const base = { inicio: "2026-09-10", fim: "2026-09-20" };
  assert.equal(justificativaAbrangeData({ ...base, status: "aprovada" }, "2026-09-10"), true);
  assert.equal(justificativaAbrangeData({ ...base, status: "aprovada" }, "2026-09-20"), true);
  assert.equal(justificativaAbrangeData({ ...base, status: "aprovada" }, "2026-09-21"), false);
  assert.equal(justificativaAbrangeData({ ...base, status: "pendente" }, "2026-09-15"), false);
});

test("aplica recorrências semanais e mensais apenas nos dias configurados", () => {
  const semanal = {
    inicio: "2026-09-01",
    fim: "2026-10-31",
    status: "aprovada" as const,
    periodicidade: "semanal" as const,
    diasSemana: [2],
  };
  assert.equal(justificativaAbrangeData(semanal, "2026-09-22"), true);
  assert.equal(justificativaAbrangeData(semanal, "2026-09-23"), false);

  const mensal = {
    inicio: "2026-09-01",
    fim: "",
    semDataFinal: true,
    status: "aprovada" as const,
    periodicidade: "mensal" as const,
    diasMes: [15],
  };
  assert.equal(justificativaAbrangeData(mensal, "2026-10-15"), true);
  assert.equal(justificativaAbrangeData(mensal, "2026-10-16"), false);
});

test("encerramento preserva datas anteriores e bloqueia as futuras", () => {
  const encerrada = {
    inicio: "2026-09-01",
    fim: "",
    semDataFinal: true,
    status: "encerrada" as const,
    periodicidade: "semanal" as const,
    diasSemana: [2],
    encerradaAPartirDe: "2026-09-24",
  };
  assert.equal(justificativaAbrangeData(encerrada, "2026-09-22"), true);
  assert.equal(justificativaAbrangeData(encerrada, "2026-09-29"), false);
});

test("permite recorrências coexistentes quando os dias não coincidem", () => {
  const base = { inicio: "2026-09-01", fim: "2026-12-31" };
  assert.equal(
    justificativasAusenciaSobrepostas(
      { ...base, periodicidade: "semanal", diasSemana: [1] },
      { ...base, periodicidade: "semanal", diasSemana: [2] },
    ),
    false,
  );
  assert.equal(
    justificativasAusenciaSobrepostas(
      { ...base, periodicidade: "semanal", diasSemana: [1] },
      { ...base, periodicidade: "mensal", diasMes: [7] },
    ),
    true,
  );
});

test("seleciona apenas os dois documentos da modalidade do atleta", () => {
  assert.deepEqual(DOCUMENTOS_POR_MODALIDADE.corrida, [
    "corrida_regulamento",
    "corrida_termo_responsabilidade",
  ]);
  assert.deepEqual(DOCUMENTOS_POR_MODALIDADE.bicicleta, [
    "bicicleta_regulamento",
    "bicicleta_termo_responsabilidade",
  ]);
  assert.equal(modalidadeDocumentoDaEquipe("fila_corrida"), "corrida");
  assert.equal(modalidadeDocumentoDaEquipe("bicicleta"), "bicicleta");
  assert.equal(modalidadeDocumentoDaEquipe("comite"), null);
});

test("versiona cada documento e aceite de forma independente", () => {
  const regulamento = documentoProgramaComFallback("corrida_regulamento", {
    titulo: "Regulamento atualizado",
    versao: 3,
    ativo: false,
  });
  const termo = documentoProgramaComFallback("corrida_termo_responsabilidade");

  assert.equal(regulamento.versao, 3);
  assert.equal(regulamento.ativo, false);
  assert.equal(termo.versao, 1);
  assert.equal(
    aceiteDocumentoProgramaId("uid-1", "corrida_regulamento"),
    "uid-1__corrida_regulamento",
  );
});

test("migra a nomenclatura antiga de Mountain Bike para Bike", () => {
  const documento = documentoProgramaComFallback("bicicleta_regulamento", {
    titulo: "Regulamento — Mountain Bike",
    conteudo: "Regulamento do Programa de Montain Bike Atletas Energisa.",
    versao: 1,
  });

  assert.equal(documento.titulo, "Regulamento — Bike");
  assert.equal(documento.conteudo, "Regulamento do Programa de Bike Atletas Energisa.");
  assert.equal(documento.versao, 2);
  assert.equal(modalidadeDocumentoLabel("bicicleta"), "Bike");
});
