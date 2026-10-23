import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoDeResumoParaEnviar, mensagemDoResumo, periodoQueFechou, periodosDoResumo, tamanhoDoTitulo, trimestreDoResumo } from "../src/lib/resumoPeriodo";

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

test("destaque no Início: ano, depois trimestre, depois mês", () => {
  assert.equal(periodoQueFechou("2027-01-03", TRI)?.titulo, "2026");
  assert.equal(periodoQueFechou("2026-12-02", TRI)?.titulo, "3º Trimestre");
  assert.equal(periodoQueFechou("2026-10-05", TRI)?.titulo, "Setembro");
  assert.equal(periodoQueFechou("2026-10-08", TRI), null);
});

test("aviso de fechou: no dia seguinte a partir das 10h, um só, o maior", () => {
  // 1º/out: fecha só setembro.
  assert.equal(avisoDeResumoParaEnviar(brasilia("2026-10-01T09:00:00"), TRI, {}), null);
  const out = avisoDeResumoParaEnviar(brasilia("2026-10-01T10:05:00"), TRI, {})!;
  assert.equal(out.periodo.titulo, "Setembro");
  assert.equal(out.link, "/dashboard?compartilhar=mes");
  assert.equal(avisoDeResumoParaEnviar(brasilia("2026-10-01T10:10:00"), TRI, out.marcas), null);
  // 1º/dez: fecham novembro e o 3º trimestre → sai o do trimestre e marca os dois.
  const dez = avisoDeResumoParaEnviar(brasilia("2026-12-01T11:00:00"), TRI, { mes: "2026-10" })!;
  assert.equal(dez.periodo.titulo, "3º Trimestre");
  assert.deepEqual(dez.marcas, { mes: "2026-11", trimestre: "2026-09-01:2026-11-30" });
  assert.equal(avisoDeResumoParaEnviar(brasilia("2026-12-02T08:00:00"), TRI, dez.marcas), null);
  // 1º/jan: fecham dezembro e o ano → sai o do ano.
  const jan = avisoDeResumoParaEnviar(brasilia("2027-01-01T10:30:00"), TRI, {})!;
  assert.equal(jan.periodo.titulo, "2026");
  assert.equal(jan.link, "/dashboard?compartilhar=ano");
  assert.equal(avisoDeResumoParaEnviar(brasilia("2027-01-02T10:30:00"), TRI, jan.marcas), null);
  // Fora da folga de 3 dias, nada.
  assert.equal(avisoDeResumoParaEnviar(brasilia("2026-10-04T12:00:00"), TRI, {}), null);
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
