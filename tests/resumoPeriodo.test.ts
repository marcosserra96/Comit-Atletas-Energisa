import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoDeResumoParaEnviar, fechaJuntoComOMes, fechamentoLiberado, mensagemDoResumo, mesParaConfirmar, periodoQueFechou, periodosDoResumo, tamanhoDoTitulo, textoDoFechamento, trimestreDoResumo } from "../src/lib/resumoPeriodo";

const TRI = [
  { nome: "2º Trimestre", inicio: "2026-06-01", fim: "2026-08-31" },
  { nome: "3º Trimestre", inicio: "2026-09-01", fim: "2026-11-30" },
  { nome: "4º Trimestre", inicio: "2026-12-01", fim: "2027-02-28" },
];
const brasilia = (iso: string) => Date.parse(`${iso}-03:00`);

test("opções da imagem: mês atual, passado, trimestre e o ano só em dezembro e janeiro", () => {
  assert.deepEqual(periodosDoResumo("2026-10-23", TRI).map((p) => p.rotulo), ["Outubro", "Setembro", "Trimestre"]);
  const dez = periodosDoResumo("2026-12-05", TRI);
  assert.deepEqual(dez.map((p) => p.rotulo), ["Dezembro", "Novembro", "Trimestre", "2026"]);
  // Até 15 dias depois do fim, o trimestre da imagem é o que fechou.
  assert.equal(dez[2].titulo, "3º Trimestre");
  assert.equal(dez[2].fim, "2026-11-30");
  assert.equal(dez[3].fim, "2026-12-05"); // o ano até hoje
  assert.equal(trimestreDoResumo(TRI, "2026-12-20")?.nome, "4º Trimestre");
  const jan = periodosDoResumo("2027-01-10", TRI);
  assert.deepEqual(jan.at(-1)!.titulo, "2026");
  assert.equal(jan.at(-1)!.fim, "2026-12-31");
  // Sem calendário: sem a opção Trimestre.
  assert.deepEqual(periodosDoResumo("2026-10-23", []).map((p) => p.id), ["este", "passado"]);
});

test("destaque no Início: só depois do fechamento (confirmado ou no dia 7); ano, depois trimestre, depois mês", () => {
  // Sem confirmação, o mês só vira destaque no dia 7 e some depois de 14 dias.
  assert.equal(periodoQueFechou("2026-10-05", TRI), null);
  assert.equal(periodoQueFechou("2026-10-07", TRI)?.titulo, "Setembro");
  assert.equal(periodoQueFechou("2026-10-16", TRI), null);
  // Confirmado pelo comitê: já no dia seguinte.
  assert.equal(periodoQueFechou("2026-10-02", TRI, { "2026-09": { em: "2026-10-02" } })?.titulo, "Setembro");
  // Novembro fecha junto com o 3º trimestre: o trimestre tem prioridade.
  assert.equal(periodoQueFechou("2026-12-02", TRI, { "2026-11": { em: "2026-12-02" } })?.titulo, "3º Trimestre");
  // Dezembro fecha o ano.
  assert.equal(periodoQueFechou("2027-01-03", TRI, { "2026-12": { em: "2027-01-03" } })?.titulo, "2026");
  assert.equal(periodoQueFechou("2027-01-03", TRI), null);
});

test("aviso de fechou: espera o comitê (ou o dia 7), um só, o maior", () => {
  // Dia 1º sem confirmação: nada.
  assert.equal(avisoDeResumoParaEnviar(brasilia("2026-10-01T10:05:00"), TRI, {}), null);
  // Confirmado: sai entre 8h e 21h.
  const conf = { "2026-09": { em: "2026-10-03T14:00:00Z" } };
  assert.equal(avisoDeResumoParaEnviar(brasilia("2026-10-03T22:00:00"), TRI, {}, conf), null);
  const out = avisoDeResumoParaEnviar(brasilia("2026-10-03T15:00:00"), TRI, {}, conf)!;
  assert.equal(out.periodo.titulo, "Setembro");
  assert.equal(out.link, "/dashboard?compartilhar=mes");
  assert.equal(avisoDeResumoParaEnviar(brasilia("2026-10-03T15:10:00"), TRI, out.marcas, conf), null);
  // Sem confirmação: sozinho no dia 7, a partir das 10h.
  assert.equal(avisoDeResumoParaEnviar(brasilia("2026-10-07T09:00:00"), TRI, {}), null);
  assert.equal(avisoDeResumoParaEnviar(brasilia("2026-10-07T10:00:00"), TRI, {})?.periodo.titulo, "Setembro");
  // Novembro + 3º trimestre: sai o do trimestre e marca os dois.
  const dez = avisoDeResumoParaEnviar(brasilia("2026-12-02T11:00:00"), TRI, { mes: "2026-10" }, { "2026-11": { em: "x" } })!;
  assert.equal(dez.periodo.titulo, "3º Trimestre");
  assert.deepEqual(dez.marcas, { mes: "2026-11", trimestre: "2026-09-01:2026-11-30" });
  // Dezembro + ano: sai o do ano.
  const jan = avisoDeResumoParaEnviar(brasilia("2027-01-04T10:30:00"), TRI, {}, { "2026-12": { em: "x" } })!;
  assert.equal(jan.periodo.titulo, "2026");
  assert.equal(jan.link, "/dashboard?compartilhar=ano");
  // Depois de 14 dias, nada (mesmo sem aviso enviado).
  assert.equal(avisoDeResumoParaEnviar(brasilia("2026-10-16T12:00:00"), TRI, {}), null);
});

test("pergunta ao comitê: o mês anterior, na primeira semana, até ser confirmado", () => {
  assert.deepEqual(mesParaConfirmar("2026-11-03", {}), { competencia: "2026-10", nome: "outubro", fim: "2026-10-31" });
  assert.equal(mesParaConfirmar("2026-11-03", { "2026-10": { em: "x" } }), null);
  assert.equal(mesParaConfirmar("2026-11-08", {}), null); // já saiu sozinho no dia 7
  assert.equal(mesParaConfirmar("2027-01-02", {})?.competencia, "2026-12");
  assert.equal(textoDoFechamento("outubro", fechaJuntoComOMes("2026-10", TRI)), "de outubro");
  assert.equal(textoDoFechamento("novembro", fechaJuntoComOMes("2026-11", TRI)), "de novembro e do 3º Trimestre");
  assert.equal(
    textoDoFechamento("dezembro", fechaJuntoComOMes("2026-12", [{ nome: "4º Trimestre", inicio: "2026-10-01", fim: "2026-12-31" }])),
    "de dezembro, do 4º Trimestre e do ano de 2026",
  );
  assert.equal(fechamentoLiberado("2026-10-31", "2026-11-01", { "2026-10": { em: "x" } }), true);
});

test("mensagens do aviso", () => {
  const [, set] = periodosDoResumo("2026-10-01", TRI);
  assert.deepEqual(mensagemDoResumo({ periodo: set, treinos: 12, km: 86.4 }), {
    titulo: "Seu setembro fechou",
    corpo: "12 treinos e 86,4 km no mês. Toque para ver o resumo e compartilhar no status ou nos stories.",
  });
  const ano = periodosDoResumo("2027-01-01", TRI).at(-1)!;
  assert.match(mensagemDoResumo({ periodo: ano, treinos: 1, km: 0 }).corpo, /^1 treino no ano\. Toque para ver a sua retrospectiva/);
  assert.equal(mensagemDoResumo({ periodo: ano, treinos: 1, km: 0 }).titulo, "Seu 2026 fechou");
});

test("título da imagem diminui para nomes longos", () => {
  assert.equal(tamanhoDoTitulo("Outubro"), 230);
  assert.ok(tamanhoDoTitulo("3º Trimestre") < 180);
});

test("período em andamento avisa na imagem que os números são até hoje", () => {
  const [atual, passado, tri] = periodosDoResumo("2026-10-23", TRI);
  assert.equal(atual.emAndamento, true);
  assert.equal(atual.subtitulo, "2026 · até 23/10");
  assert.equal(passado.emAndamento, false);
  assert.equal(passado.subtitulo, "2026");
  assert.equal(tri.subtitulo, "Set a Nov · até 23/10");
  const ano = periodosDoResumo("2026-12-05", TRI).at(-1)!;
  assert.equal(ano.subtitulo, "Meu ano até 05/12");
  assert.equal(periodosDoResumo("2027-01-05", TRI).at(-1)!.subtitulo, "Meu ano no programa");
});
