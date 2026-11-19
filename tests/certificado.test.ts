import { test } from "node:test";
import assert from "node:assert/strict";
import { dataDoCertificado, periodoNaFrase, destinatariosDaMeta, destinatariosDoPremio, juntarValores, nomeDoArquivoCertificado, preencher, textosPadrao } from "../src/lib/certificado";
import { calcularPremio, type PremioPersonalizado } from "../src/lib/premiacaoPersonalizada";
import type { DadosAnalise } from "../src/lib/analises/motor";
import type { AtletaDoc, HistoricoPontoDoc } from "../src/lib/types";

const atleta = (id: string, extra: Partial<AtletaDoc> = {}) => ({ id, nome: id.toUpperCase(), equipe: "corrida", ativo: true, pontuacaoTotal: 0, sexo: "F", ...extra }) as AtletaDoc;
let n = 0;
const lanc = (atletaId: string, dataTreino: string, pontos = 2) =>
  ({ id: `l${++n}`, atletaId, atletaNome: atletaId, equipe: "corrida", regraId: "treino", regraDesc: "Treino", pontos, tipoLancamento: "treino", dataTreino, loteId: `lote${n}`, estornado: false }) as HistoricoPontoDoc;
const dados: DadosAnalise = {
  hoje: "2026-11-19",
  atletas: [atleta("ana"), atleta("caio", { equipe: "bicicleta" }), atleta("dani")],
  lancamentos: [lanc("ana", "2026-02-01", 5), lanc("ana", "2026-03-01", 5), lanc("ana", "2026-04-01", 5), lanc("caio", "2026-02-02", 1)],
  resumos: [],
};
const ano = { nome: "Ano de 2026", inicio: "2026-01-01", fim: "2026-12-31" };

test("campos do texto viram os dados da pessoa; campo vazio some", () => {
  const t = "O *{colocacao}* no {premio} ({periodo}), com {valores}. {equipe}{desconhecido}";
  assert.equal(
    preencher(t, { id: "a", nome: "Ana", equipe: "bicicleta", colocacao: 2, valores: ["10 pontos", "3 treinos", "1 prova"] }, { premio: "Atleta do ano", periodo: "ano de 2026" }),
    "O *2º lugar* no Atleta do ano (ano de 2026), com 10 pontos, 3 treinos e 1 prova. Bike{desconhecido}",
  );
  assert.equal(preencher("{nome} {colocacao}fim", { id: "a", nome: "Ana", valores: [] }, { premio: "", periodo: "" }), "Ana fim");
  assert.equal(juntarValores(["a", "b"]), "a e b");
  assert.equal(juntarValores([]), "");
});

test("data e textos padrão por origem", () => {
  assert.equal(dataDoCertificado("2026-11-19"), "Novembro de 2026");
  assert.match(textosPadrao("premio", "2026-11-19").texto, /\{colocacao\}/);
  assert.equal(textosPadrao("manual", "2026-11-19").subtitulo, "de participação");
});

test("premiação: um certificado por colocado, com os números de cada um", () => {
  const premio: PremioPersonalizado = { id: "p", titulo: "Atleta do ano", periodo: "ano", equipe: "separadas", sexo: "todos", quantidade: 3, criterios: [{ id: "c", medida: "pontos", peso: 100, exibir: "total" }] };
  const d = destinatariosDoPremio(premio, calcularPremio(premio, dados, ano));
  assert.deepEqual(d.map((x) => [x.id, x.colocacao, x.valores]), [["corrida-ana", 1, ["15 pontos"]], ["bicicleta-caio", 1, ["1 ponto"]]]);
});

test("meta: todos que chegaram ao mínimo; mínimo zero não inclui quem não treinou", () => {
  assert.deepEqual(destinatariosDaMeta({ medida: "treinos", minimo: 3, equipe: "todas" }, dados, ano).map((x) => [x.nome, x.valores]), [["ANA", ["3 treinos"]]]);
  assert.deepEqual(destinatariosDaMeta({ medida: "treinos", minimo: 0, equipe: "todas" }, dados, ano).map((x) => x.nome), ["ANA", "CAIO"]);
  assert.deepEqual(destinatariosDaMeta({ medida: "treinos", minimo: 1, equipe: "bicicleta" }, dados, ano).map((x) => x.nome), ["CAIO"]);
});

test("período na frase", () => {
  assert.equal(periodoNaFrase({ nome: "Ano de 2026", anual: true, ano: "2026" }), "em 2026");
  assert.equal(periodoNaFrase({ nome: "3º trimestre 2026", anual: false, ano: "2026" }), "no 3º trimestre 2026");
  assert.equal(periodoNaFrase({ nome: "Trimestre de inverno", anual: false, ano: "2026" }), "no trimestre de inverno de 2026");
});

test("nome do arquivo", () => {
  assert.equal(nomeDoArquivoCertificado("Mariana Conceição", "png"), "certificado-mariana-conceicao.png");
  assert.equal(nomeDoArquivoCertificado("Atleta do ano", "pdf", true), "certificados-atleta-do-ano.pdf");
});
