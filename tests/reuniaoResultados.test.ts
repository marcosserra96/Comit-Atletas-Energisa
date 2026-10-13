import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agendaDoAno,
  intervaloDeMeses,
  mesesDoPeriodo,
  montarRoteiro,
  novosAtletas,
  paginarClassificacao,
  periodosDeApuracao,
  regrasParaSlide,
  resultadosDaEquipe,
  reuniaoPadrao,
  validarReuniao,
  verificarAntesDeApresentar,
  aniversariantesDoPeriodo,
  completarSecoes,
  destaquesDoPeriodo,
  periodoAnterior,
  trechoEquivalente,
  sortearEntre,
  resumoParaAtletas,
  estiloDoLivre,
  estiloSalvo,
  fundoEscuro,
} from "../src/lib/reuniaoResultados";
import type { AtletaDoc, EventoDoc, HistoricoPontoDoc, RegraPontuacaoDoc } from "../src/lib/types";

const atleta = (id: string, nome: string, equipe: AtletaDoc["equipe"], extra: Partial<AtletaDoc> = {}) =>
  ({ id, nome, equipe, ativo: true, email: null, role: "atleta", pontuacaoTotal: 0, authUid: null, criadoEm: null, atualizadoEm: null, ...extra }) as AtletaDoc;

const lanc = (atletaId: string, dataTreino: string, pontos: number, km = 5) =>
  ({ id: `${atletaId}-${dataTreino}-${pontos}`, atletaId, dataTreino, pontos, kmPercorrido: km, regraId: "r1", tipoLancamento: "treino", loteId: `${atletaId}-${dataTreino}`, estornado: false }) as unknown as HistoricoPontoDoc;

test("meses do período como na reunião", () => {
  assert.equal(mesesDoPeriodo("2026-06-01", "2026-08-31"), "Junho – Julho – Agosto");
  assert.equal(mesesDoPeriodo("2026-03-01", "2026-11-30"), "Março a Novembro");
  assert.equal(intervaloDeMeses("2026-06-01", "2026-08-31"), "(Junho a Agosto)");
});

test("resultados da equipe: só o período, empates e totais com km por treino", () => {
  const atletas = [atleta("a", "Ana", "corrida"), atleta("b", "Bia", "corrida"), atleta("c", "Caio", "corrida"), atleta("x", "Xis", "bicicleta"), atleta("i", "Inativo", "corrida", { ativo: false })];
  const lancamentos = [
    lanc("a", "2026-06-02", 2, 10), lanc("a", "2026-06-09", 2, 8),
    lanc("b", "2026-06-03", 2, 5), lanc("b", "2026-07-03", 2, 7),
    lanc("c", "2026-06-05", 1, 4),
    lanc("a", "2026-05-30", 9, 9), // fora do período
    lanc("x", "2026-06-02", 2, 40),
  ];
  const r = resultadosDaEquipe({ modalidade: "corrida", atletas, lancamentos, resumosMensais: [], inicio: "2026-06-01", fim: "2026-08-31", novos: new Set(["c"]) });
  assert.deepEqual(r.ranking.map((l) => [l.nome, l.posicao, l.pontos]), [["Ana", 1, 4], ["Bia", 1, 4], ["Caio", 2, 1]]);
  assert.equal(r.totais.atletas, 3);
  assert.equal(r.totais.treinos, 5);
  assert.equal(r.totais.km, 34);
  assert.ok(Math.abs(r.totais.kmPorTreino - 6.8) < 0.001);
  assert.equal(r.podio[0].total, 2);
  assert.equal(r.ranking[2].novo, true);
});

test("novos atletas: entrou na equipe no período, com ajustes do comitê", () => {
  const atletas = [
    atleta("a", "Ana", "corrida", { entrouNaEquipeEm: "2026-07-10" }),
    atleta("b", "Bia", "bicicleta", { entrouNaEquipeEm: "2026-01-10" }),
    atleta("c", "Caio", "corrida"),
    atleta("f", "Fila", "fila_corrida", { entrouNaEquipeEm: "2026-07-10" }),
  ];
  const ids = (xs: AtletaDoc[]) => xs.map((a) => a.id);
  assert.deepEqual(ids(novosAtletas({ atletas, inicio: "2026-06-01", ate: "2026-09-30" })), ["a"]);
  assert.deepEqual(ids(novosAtletas({ atletas, inicio: "2026-06-01", ate: "2026-09-30", incluir: ["c"], excluir: ["a"] })), ["c"]);
});

test("classificação em colunas iguais, até 45 por slide", () => {
  const n = (k: number) => Array.from({ length: k }, (_, i) => i);
  assert.deepEqual(paginarClassificacao(n(44)).map((s) => s.map((c) => c.length)), [[15, 15, 14]]);
  assert.deepEqual(paginarClassificacao(n(22)).map((s) => s.map((c) => c.length)), [[11, 11]]);
  assert.deepEqual(paginarClassificacao(n(10)).map((s) => s.map((c) => c.length)), [[10]]);
  // Sobra pequena cabe no mesmo slide, com linhas mais baixas.
  assert.deepEqual(paginarClassificacao(n(46)).map((s) => s.map((c) => c.length)), [[16, 16, 14]]);
  assert.deepEqual(paginarClassificacao(n(54)).map((s) => s.map((c) => c.length)), [[18, 18, 18]]);
  // Passou do limite: divide por igual, nunca um slide com um nome só.
  assert.deepEqual(paginarClassificacao(n(55)).map((s) => s.map((c) => c.length)), [[14, 14], [14, 13]]);
  assert.deepEqual(paginarClassificacao(n(109)).map((s) => s.flat().length), [37, 37, 35]);
  assert.deepEqual(paginarClassificacao(n(0)), []);
});

test("regras, agenda e períodos para os slides", () => {
  const regras = [
    { id: "a", descricao: "Treino fora", pontos: 1, modalidade: "ambas" },
    { id: "b", descricao: "Treino oficial", pontos: 2, modalidade: "ambas" },
    { id: "falta_justificada", descricao: "Falta", pontos: 0, modalidade: "ambas" },
  ] as RegraPontuacaoDoc[];
  assert.deepEqual(regrasParaSlide(regras).map((r) => r.pontos), [2, 1]);
  const ev = (id: string, data: string, modalidade: EventoDoc["modalidade"], tipo?: EventoDoc["tipo"]) => ({ id, data, modalidade, tipo, titulo: id, local: "x" }) as EventoDoc;
  const agenda = agendaDoAno([ev("c1", "2026-06-14", "corrida"), ev("b1", "2026-07-12", "bicicleta"), ev("r", "2026-07-01", "ambas", "reuniao"), ev("velho", "2025-12-01", "corrida")], "2026", "2026-07-01");
  assert.deepEqual(agenda.map((c) => [c.titulo, c.eventos.map((e) => [e.id, e.feito])]), [["Time Corrida", [["c1", true]]], ["Time Bike", [["b1", false]]]]);
  const p = periodosDeApuracao([{ nome: "1º", inicio: "2026-03-01", fim: "2026-05-31" }, { nome: "2º", inicio: "2026-06-01", fim: "2026-08-31" }, { nome: "3º", inicio: "2026-09-01", fim: "2026-11-30" }], "2026", "2026-07-15");
  assert.deepEqual(p.map((x) => x.situacao), ["fechado", "andamento", "proximo"]);
});

test("roteiro padrão segue a reunião de setembro e pula seções vazias", () => {
  const base = reuniaoPadrao({ nome: "2º Trimestre", inicio: "2026-06-01", fim: "2026-08-31" }, "ev1");
  const equipe = (modalidade: "corrida" | "bicicleta", nomes: string[]) =>
    resultadosDaEquipe({ modalidade, atletas: nomes.map((n) => atleta(n, n, modalidade)), lancamentos: nomes.map((n, i) => lanc(n, "2026-06-10", 10 - i)), resumosMensais: [], inicio: "2026-06-01", fim: "2026-08-31" });
  const slides = montarRoteiro({
    reuniao: base,
    corrida: equipe("corrida", ["A", "B", "C"]),
    bicicleta: equipe("bicicleta", ["X", "Y"]),
    novos: [],
    regras: [],
    periodos: [],
    agenda: [],
    evento: { id: "ev1", titulo: "Reunião", horario: "19:00 às 20:00" },
    pontosReuniao: 3,
    hoje: "2026-09-10",
  });
  assert.deepEqual(slides.map((s) => s.tipo), [
    "capa", "presenca", "divisoria", "conteudo", "regras", "divisoria", "totais",
    "divisoria", "podio", "classificacao", "podio", "classificacao", "divisoria", "divisoria", "app", "obrigado",
  ]);
  assert.equal(new Set(slides.map((s) => s.chave)).size, slides.length, "chaves únicas");
  // Cada slide sabe de que seção veio e tem um nome para a miniatura.
  assert.ok(slides.every((s) => s.secaoId && s.rotulo));
  assert.deepEqual(slides.slice(7, 10).map((s) => s.rotulo), ["Premiação · abertura", "Pódio · Corrida", "Classificação · Corrida"]);
  assert.equal(slides[2].rotulo, "Fala da Diretoria");
});

test("antes de apresentar: eventos sem pontos, período aberto, fotos, QR e slide vazio", () => {
  const base = reuniaoPadrao({ nome: "3º Trimestre", inicio: "2026-09-01", fim: "2026-11-30" }, null);
  base.livres[1].texto = "";
  const v = verificarAntesDeApresentar({
    reuniao: base,
    eventos: [
      { id: "e1", titulo: "Serra da Onça", data: "2026-10-04" },
      { id: "e2", titulo: "Corrida X", data: "2026-09-06" },
      { id: "e3", titulo: "Futura", data: "2026-11-20" },
      { id: "r1", titulo: "Reunião", data: "2026-10-07", tipo: "reuniao" },
    ],
    lancamentos: [{ eventoId: "e2", estornado: false }],
    semFoto: [{ id: "a", nome: "Ana" }],
    hoje: "2026-10-12",
  });
  assert.deepEqual(v.map((x) => x.id), ["eventos", "periodo", "fotos", "presenca", "vazios"]);
  assert.match(v[0].texto, /^1 evento/);
  assert.equal(v[0].acao?.href, "/gestao/pontuacao?evento=e1");
  // Período fechado, tudo certo: lista vazia.
  const ok = reuniaoPadrao({ nome: "2º", inicio: "2026-06-01", fim: "2026-08-31" }, "r1");
  assert.deepEqual(verificarAntesDeApresentar({ reuniao: ok, eventos: [], lancamentos: [], semFoto: [], hoje: "2026-10-12" }), []);
});

test("validação: período obrigatório, seções livres precisam do slide", () => {
  assert.ok("erro" in validarReuniao({ periodo: { inicio: "x", fim: "y" } }));
  const base = reuniaoPadrao({ nome: "T", inicio: "2026-06-01", fim: "2026-08-31" }, null);
  const r = validarReuniao({ ...base, livres: [] });
  assert.ok("dados" in r && r.dados.secoes.every((s) => s.tipo !== "livre"));
});

test("aniversariantes: dia e mês dentro do período, inclusive virando o ano", () => {
  const atletas = [
    atleta("a", "Ana", "corrida", { dataNascimento: "1990-07-12" }),
    atleta("b", "Bia", "bicicleta", { dataNascimento: "1985-06-01" }),
    atleta("c", "Caio", "corrida", { dataNascimento: "1992-09-01" }),
    atleta("d", "Duda", "fila_corrida", { dataNascimento: "1990-07-01" }),
    atleta("e", "Edu", "corrida", { dataNascimento: "2000-01-05" }),
  ];
  assert.deepEqual(aniversariantesDoPeriodo(atletas, "2026-06-01", "2026-08-31").map((x) => [x.nome, x.dia]), [["Bia", "01/06"], ["Ana", "12/07"]]);
  assert.deepEqual(aniversariantesDoPeriodo(atletas, "2026-12-01", "2027-02-28").map((x) => x.nome), ["Edu"]);
});

test("período anterior: trimestre do calendário ou a mesma duração logo antes", () => {
  const tri = [{ nome: "1º", inicio: "2026-03-01", fim: "2026-05-31" }, { nome: "2º", inicio: "2026-06-01", fim: "2026-08-31" }];
  assert.deepEqual(periodoAnterior({ inicio: "2026-06-01", fim: "2026-08-31" }, tri), { nome: "1º", inicio: "2026-03-01", fim: "2026-05-31" });
  assert.deepEqual(periodoAnterior({ inicio: "2026-10-01", fim: "2026-10-31" }, []), { nome: "período anterior", inicio: "2026-08-31", fim: "2026-09-30" });
});

test("destaques: evolução, sequência e mais km por equipe", () => {
  const atletas = ["A", "B", "X"].map((n, i) => atleta(n, n, i < 2 ? "corrida" : "bicicleta"));
  const res = (modalidade: "corrida" | "bicicleta", linhas: [string, number, number][]) =>
    ({ modalidade, podio: [], totais: { atletas: 0, treinos: 0, pontos: 0, km: 0, kmPorTreino: 0 }, ranking: linhas.map(([id, treinos, km]) => ({ id, nome: id, posicao: 1, pontos: treinos * 5, treinos, km, novo: false })) });
  const d = destaquesDoPeriodo({
    atletas,
    atual: { corrida: res("corrida", [["A", 20, 150], ["B", 12, 200]]), bicicleta: res("bicicleta", [["X", 8, 900]]) },
    anterior: { corrida: res("corrida", [["A", 18, 0], ["B", 3, 0]]), bicicleta: res("bicicleta", [["X", 8, 0]]) },
    sequencias: new Map([["A", 9], ["B", 4]]),
  });
  assert.deepEqual(d.map((x) => [x.id, x.atleta.id, x.valor]), [["evolucao", "B", "+9"], ["sequencia", "A", "9"], ["km-corrida", "B", "200"], ["km-bicicleta", "X", "900"]]);
});

test("reuniões antigas ganham as seções novas no lugar certo", () => {
  const velha = { secoes: reuniaoPadrao({ nome: "T", inicio: "2026-06-01", fim: "2026-08-31" }, null).secoes.filter((x) => x.tipo !== "destaques" && x.tipo !== "aniversariantes") };
  const nova = completarSecoes(velha).secoes.map((x) => x.tipo);
  assert.equal(nova[nova.indexOf("novos") + 1], "aniversariantes");
  assert.equal(nova[nova.indexOf("resultados") + 1], "destaques");
  const completa = { secoes: completarSecoes(velha).secoes };
  assert.equal(completarSecoes(completa), completa);
});

test("período em andamento compara com o mesmo trecho do anterior", () => {
  const t = trechoEquivalente({ nome: "2º Trimestre", inicio: "2026-06-01", fim: "2026-08-31" }, "2026-09-01", "2026-10-12");
  assert.deepEqual(t, { nome: "2º Trimestre até 12/07", inicio: "2026-06-01", fim: "2026-07-12" });
  const inteiro = { nome: "2º", inicio: "2026-06-01", fim: "2026-08-31" };
  assert.equal(trechoEquivalente(inteiro, "2026-09-01", "2026-12-15"), inteiro);
});

test("sorteio: sorteia um elegível e nunca sai da lista", () => {
  assert.equal(sortearEntre([], () => 0.5), null);
  assert.equal(sortearEntre(["a", "b", "c"], () => 0), "a");
  assert.equal(sortearEntre(["a", "b", "c"], () => 0.999999), "c");
  assert.equal(sortearEntre(["a", "b"], () => 1), "b");
});

test("sorteio entra desligado no roteiro e antes do encerramento", () => {
  const r = reuniaoPadrao({ nome: "T", inicio: "2026-06-01", fim: "2026-08-31" }, null);
  const tipos = r.secoes.map((x) => x.tipo);
  assert.equal(tipos[tipos.indexOf("obrigado") - 1], "sorteio");
  assert.equal(r.secoes.find((x) => x.tipo === "sorteio")?.ativo, false);
  const velha = { secoes: r.secoes.filter((x) => x.tipo !== "sorteio") };
  const nova = completarSecoes(velha).secoes;
  assert.equal(nova[nova.findIndex((x) => x.tipo === "obrigado") - 1].tipo, "sorteio");
});

test("notas do apresentador passam pela validação com limite", () => {
  const r = reuniaoPadrao({ nome: "T", inicio: "2026-06-01", fim: "2026-08-31" }, null);
  const v = validarReuniao({ ...r, notas: { [r.secoes[0].id]: "Abrir com a meta", x: "a".repeat(3000), y: 5 as unknown as string } });
  assert.ok("dados" in v);
  if ("dados" in v) {
    assert.equal(v.dados.notas?.[r.secoes[0].id], "Abrir com a meta");
    assert.equal(v.dados.notas?.x?.length, 2000);
    assert.equal(v.dados.notas?.y, undefined);
  }
});

test("resumo para os atletas com números, pódio e destaques", () => {
  const atletas = ["Ana", "Bia", "Caio"].map((n) => atleta(n, n, "corrida"));
  const lancamentos = [lanc("Ana", "2026-06-10", 30, 10), lanc("Bia", "2026-06-11", 20, 8), lanc("Caio", "2026-06-12", 10, 4)];
  const corrida = resultadosDaEquipe({ modalidade: "corrida", atletas, lancamentos, resumosMensais: [], inicio: "2026-06-01", fim: "2026-08-31" });
  const bicicleta = resultadosDaEquipe({ modalidade: "bicicleta", atletas: [], lancamentos: [], resumosMensais: [], inicio: "2026-06-01", fim: "2026-08-31" });
  const r = resumoParaAtletas({
    periodo: { nome: "2º Trimestre" },
    corrida,
    bicicleta,
    desafios: [{ titulo: "100 km", concluidos: 1, participantes: 3 }],
    novos: 2,
  });
  assert.equal(r.titulo, "Resultados do 2º Trimestre");
  assert.match(r.resumo, /3 treinos e 22 km/);
  assert.match(r.corpo, /^Corrida\n3 atletas · 3 treinos · 22 km\n1º Ana \(30 pts\)/);
  assert.doesNotMatch(r.corpo, /Bike/);
  assert.match(r.corpo, /100 km: 1 de 3 participantes concluiu/);
  assert.match(r.corpo, /aos 2 atletas novos/);
});

test("formatação do slide livre: guarda só o que muda e limpa o inválido", () => {
  assert.equal(estiloDoLivre({ layout: "divisoria" }).alinhamento, "centro");
  assert.equal(estiloDoLivre({ layout: "conteudo" }).fundo, "conteudo");
  assert.equal(estiloSalvo("conteudo", { fonte: "barlow", alinhamento: "esquerda" }), undefined);
  assert.deepEqual(estiloSalvo("conteudo", { fonte: "serifada", corTitulo: "#FF0000", fundo: "claro", corFundo: "#000000" }), { fonte: "serifada", corTitulo: "#ff0000", fundo: "claro" });
  const r = reuniaoPadrao({ nome: "T", inicio: "2026-06-01", fim: "2026-08-31" }, null);
  const livre = { ...r.livres[0], estilo: { fonte: "comic" as never, corTexto: "red", tamanho: "gg" as const, fundo: "cor" as const, corFundo: "#0B2C5F" } };
  const v = validarReuniao({ ...r, livres: [livre, ...r.livres.slice(1)] });
  assert.ok("dados" in v);
  if ("dados" in v) assert.deepEqual(v.dados.livres[0].estilo, { tamanho: "gg", fundo: "cor", corFundo: "#0b2c5f" });
  assert.equal(fundoEscuro("#0b2c5f"), true);
  assert.equal(fundoEscuro("#ffffff"), false);
  assert.equal(fundoEscuro("#e7a913"), false);
});
