import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularPremio, mesesParaMedia, novoPremio, rotuloDoCriterio, textoDoValor, validarPremio, type PremioPersonalizado } from "../src/lib/premiacaoPersonalizada";
import { montarRoteiro, nomeDaSecao, passosDoSlide, validarReuniao, temaDaReuniao, type ResultadoEquipe } from "../src/lib/reuniaoResultados";
import type { DadosAnalise } from "../src/lib/analises/motor";
import type { AtletaDoc, HistoricoPontoDoc } from "../src/lib/types";

const atleta = (id: string, extra: Partial<AtletaDoc> = {}) => ({ id, nome: id.toUpperCase(), equipe: "corrida", ativo: true, pontuacaoTotal: 0, sexo: "F", ...extra }) as AtletaDoc;
let n = 0;
const lanc = (atletaId: string, dataTreino: string, pontos: number, extra: Partial<HistoricoPontoDoc> = {}) =>
  ({ id: `l${++n}`, atletaId, atletaNome: atletaId, equipe: "corrida", regraId: "treino", regraDesc: "Treino", pontos, tipoLancamento: "treino", dataTreino, loteId: `lote${n}`, estornado: false, ...extra }) as HistoricoPontoDoc;
const dias = (atletaId: string, qtd: number, pontos: number, extra: Partial<HistoricoPontoDoc> = {}) =>
  Array.from({ length: qtd }, (_, i) => lanc(atletaId, `2026-0${1 + (i % 9)}-${String(10 + Math.floor(i / 9)).padStart(2, "0")}`, pontos, extra));

// Ana: 4 treinos de 5 pts (20 pts). Caio: 8 treinos de 1 pt (8 pts). Bia (bike): 2 de 3 pts. Dani inativa.
const dados: DadosAnalise = {
  hoje: "2026-11-19",
  atletas: [atleta("ana"), atleta("caio", { sexo: "M" }), atleta("bia", { equipe: "bicicleta" }), atleta("dani", { ativo: false })],
  lancamentos: [...dias("ana", 4, 5), ...dias("caio", 8, 1), ...dias("bia", 2, 3, { equipe: "bicicleta" }), ...dias("dani", 20, 9)],
  resumos: [],
};
const ano = { nome: "Ano de 2026", inicio: "2026-01-01", fim: "2026-09-30" };
const atletaDoAno = (extra: Partial<PremioPersonalizado> = {}): PremioPersonalizado => ({
  id: "p1",
  titulo: "Atleta do ano",
  periodo: "ano",
  equipe: "todas",
  sexo: "todos",
  quantidade: 3,
  criterios: [
    { id: "c1", medida: "pontos", peso: 60, exibir: "total" },
    { id: "c2", medida: "treinos", peso: 40, exibir: "mediaMensal" },
  ],
  ...extra,
});

test("média por mês divide pelos meses que já começaram", () => {
  assert.equal(mesesParaMedia(ano, "2026-11-19"), 9);
  assert.equal(mesesParaMedia(ano, "2026-03-05"), 3);
  assert.equal(mesesParaMedia({ inicio: "2026-07-01", fim: "2026-09-30" }, "2026-06-01"), 1);
});

test("nota: o maior de cada critério vale 100, depois a média pelos pesos", () => {
  const r = calcularPremio(atletaDoAno(), dados, ano);
  assert.equal(r.meses, 9);
  const [g] = r.grupos;
  assert.deepEqual(g.classificacao.map((c) => c.id), ["ana", "caio", "bia"]);
  // Ana: 60 × 20/20 + 40 × 0,4/0,9 = 77,8. Caio: 60 × 8/20 + 40 = 64. Inativa fica de fora.
  assert.deepEqual(g.classificacao[0].valores, [20, 0.4]);
  assert.equal(g.classificacao[0].nota, 77.8);
  assert.equal(g.classificacao[1].nota, 64);
  assert.deepEqual(g.classificacao.map((c) => c.posicao), [1, 2, 3]);
});

test("pesos que não somam 100 valem pela proporção; um pódio por equipe; só mulheres", () => {
  const proporcional = calcularPremio(atletaDoAno({ criterios: [{ id: "a", medida: "pontos", peso: 30, exibir: "total" }, { id: "b", medida: "treinos", peso: 20, exibir: "mediaMensal" }] }), dados, ano);
  assert.equal(proporcional.grupos[0].classificacao[0].nota, 77.8);
  const separadas = calcularPremio(atletaDoAno({ equipe: "separadas" }), dados, ano);
  assert.deepEqual(separadas.grupos.map((g) => [g.equipe, g.classificacao.map((c) => c.id)]), [["corrida", ["ana", "caio"]], ["bicicleta", ["bia"]]]);
  assert.equal(separadas.grupos[1].classificacao[0].nota, 100);
  const mulheres = calcularPremio(atletaDoAno({ sexo: "F" }), dados, ano);
  assert.deepEqual(mulheres.grupos[0].classificacao.map((c) => c.id), ["ana", "bia"]);
});

test("empate na nota: decide o critério de maior peso (e, com pesos iguais, o primeiro)", () => {
  const lancs = [...dias("ana", 2, 4), ...dias("caio", 4, 1)];
  const com = (criterios: PremioPersonalizado["criterios"]) => calcularPremio(atletaDoAno({ criterios }), { ...dados, lancamentos: lancs }, ano).grupos[0].classificacao.map((c) => [c.id, c.nota]);
  // Ana: o dobro de pontos; Caio: o dobro de treinos. Com 50/50, os dois ficam com 75.
  assert.deepEqual(com([{ id: "a", medida: "pontos", peso: 50, exibir: "total" }, { id: "b", medida: "treinos", peso: 50, exibir: "total" }]), [["ana", 75], ["caio", 75]]);
  assert.deepEqual(com([{ id: "b", medida: "treinos", peso: 50, exibir: "total" }, { id: "a", medida: "pontos", peso: 50, exibir: "total" }]), [["caio", 75], ["ana", 75]]);
});

test("textos dos critérios e dos valores", () => {
  assert.equal(rotuloDoCriterio({ medida: "treinos", exibir: "mediaMensal" }), "Treinos por mês");
  assert.equal(rotuloDoCriterio({ medida: "aderencia", exibir: "mediaMensal" }), "Aderência");
  assert.equal(textoDoValor({ medida: "pontos", exibir: "total" }, 1240), "1.240 pontos");
  assert.equal(textoDoValor({ medida: "treinos", exibir: "mediaMensal" }, 14.2), "14,2 treinos/mês");
  assert.equal(textoDoValor({ medida: "treinos", exibir: "total" }, 1), "1 treino");
  assert.equal(textoDoValor({ medida: "aderencia", exibir: "total" }, 87.4), "87% de aderência");
  assert.equal(textoDoValor({ medida: "km", exibir: "total" }, 1234.56), "1.234,6 km");
});

test("validar limpa o prêmio", () => {
  assert.equal(validarPremio({ id: "<script>" }), null);
  const p = validarPremio({
    id: "p-1",
    titulo: "  ",
    periodo: "x",
    equipe: "?",
    sexo: "Z",
    quantidade: 9,
    criterios: [
      { id: "a", medida: "pontos", peso: 150, exibir: "mediaMensal" },
      { id: "b", medida: "pontos", peso: 10, exibir: "total" },
      { id: "c", medida: "aderencia", peso: -5, exibir: "mediaMensal" },
      { id: "d", medida: "inventada", peso: 10 },
    ],
  })!;
  assert.equal(p.titulo, "Premiação");
  assert.equal(p.periodo, "reuniao");
  assert.equal(p.equipe, "separadas");
  assert.equal(p.sexo, "todos");
  assert.equal(p.quantidade, 3);
  assert.deepEqual(p.criterios.map((c) => [c.medida, c.peso, c.exibir]), [["pontos", 100, "mediaMensal"], ["aderencia", 0, "total"]]);
  assert.equal(validarPremio({ id: "p", criterios: [] })!.criterios.length, 1);
  assert.equal(novoPremio("mais-constante").criterios.length, 2);
});

const vazio = (modalidade: "corrida" | "bicicleta") =>
  ({ modalidade, ranking: [], podio: [], totais: { atletas: 0, treinos: 0, pontos: 0, km: 0 }, ativos: 0 }) as unknown as ResultadoEquipe;

test("roteiro: um slide de prêmio por equipe, com a conta e o pódio revelado aos poucos", () => {
  const premio = atletaDoAno({ equipe: "separadas", quantidade: 2 });
  const reuniao = { periodo: { nome: "3º Trimestre", inicio: "2026-07-01", fim: "2026-09-30" }, secoes: [{ id: "p1", tipo: "premio" as const, ativo: true }], livres: [], premios: [premio] };
  const slides = montarRoteiro({
    reuniao,
    corrida: vazio("corrida"),
    bicicleta: vazio("bicicleta"),
    novos: [],
    regras: [],
    periodos: [],
    agenda: [],
    evento: null,
    pontosReuniao: null,
    hoje: "2026-11-19",
    premios: { p1: calcularPremio(premio, dados, ano) },
  });
  assert.deepEqual(slides.map((s) => s.rotulo), ["Atleta do ano · Corrida", "Atleta do ano · Bike"]);
  const [corrida] = slides;
  assert.ok(corrida.tipo === "premio");
  if (corrida.tipo !== "premio") return;
  assert.deepEqual(corrida.criterios, [{ rotulo: "Pontos", peso: 60 }, { rotulo: "Treinos por mês", peso: 40 }]);
  assert.deepEqual(corrida.colocados.map((c) => [c.atleta.id, c.valores]), [["ana", ["20 pontos", "0,4 treinos/mês"]], ["caio", ["8 pontos", "0,9 treinos/mês"]]]);
  assert.match(corrida.periodo, /^Ano de 2026 · Janeiro a Setembro/);
  assert.equal(passosDoSlide(corrida, temaDaReuniao({ revelarPodio: true })), 2);
  assert.equal(nomeDaSecao({ tipo: "premio" }, undefined, premio), "Atleta do ano");
});

test("validar a reunião guarda os prêmios do roteiro e tira os soltos", () => {
  const r = validarReuniao({
    periodo: { nome: "T", inicio: "2026-07-01", fim: "2026-09-30" },
    secoes: [
      { id: "p1", tipo: "premio", ativo: true },
      { id: "sem-premio", tipo: "premio", ativo: true },
      { id: "c", tipo: "capa", ativo: true },
    ],
    livres: [],
    premios: [atletaDoAno(), atletaDoAno({ id: "solto" })],
  });
  assert.ok("dados" in r);
  if (!("dados" in r)) return;
  assert.deepEqual(r.dados.secoes.map((s) => s.id), ["p1", "c"]);
  assert.deepEqual(r.dados.premios?.map((p) => p.id), ["p1"]);
});
