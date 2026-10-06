import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gerarTrimestresDoAno,
  janelaDaPremiacao,
  normalizarCalendario,
  planoDoCalendario,
  somarDias,
  trimestreVigente,
  validarCalendario,
  type CalendarioPremiacaoDoc,
} from "../src/lib/calendarioPremiacao";

function calendario(premiacoes: Record<string, string>, dias = 7): CalendarioPremiacaoDoc {
  const trimestres = [...gerarTrimestresDoAno(2026), ...gerarTrimestresDoAno(2027)].map((t) => ({
    ...t,
    premiacao: premiacoes[t.id] ?? "",
  }));
  return normalizarCalendario({ ativo: true, diasOcultos: dias, mensagem: "x", trimestres });
}

test("gera os 4 trimestres com o fim de mês certo (inclusive fevereiro bissexto)", () => {
  const t = gerarTrimestresDoAno(2028);
  assert.deepEqual(t.map((x) => [x.inicio, x.fim]), [
    ["2028-01-01", "2028-03-31"],
    ["2028-04-01", "2028-06-30"],
    ["2028-07-01", "2028-09-30"],
    ["2028-10-01", "2028-12-31"],
  ]);
  assert.equal(t[0].nome, "1º trimestre 2028");
});

test("somarDias atravessa mês e ano", () => {
  assert.equal(somarDias("2027-01-05", -7), "2026-12-29");
  assert.equal(somarDias("2026-02-28", 1), "2026-03-01");
});

test("trimestre segue valendo depois do fim até a premiação; depois o próximo assume", () => {
  const cal = calendario({ "2026-t4": "2027-01-15" });
  assert.equal(trimestreVigente(cal, "2026-11-10")?.id, "2026-t4");
  assert.equal(trimestreVigente(cal, "2027-01-10")?.id, "2026-t4"); // conferência do resultado
  assert.equal(trimestreVigente(cal, "2027-01-15")?.id, "2026-t4");
  assert.equal(trimestreVigente(cal, "2027-01-16")?.id, "2027-t1");
  // Premiação dentro do próprio trimestre: troca no início do seguinte.
  const cal2 = calendario({ "2026-t3": "2026-09-25" });
  assert.equal(trimestreVigente(cal2, "2026-10-01")?.id, "2026-t4");
});

test("ocultação: N dias antes até o dia da premiação, inclusive", () => {
  const cal = calendario({ "2026-t4": "2027-01-15" }, 7);
  assert.deepEqual(janelaDaPremiacao(cal.trimestres.find((t) => t.id === "2026-t4")!, 7), { inicio: "2027-01-08", fim: "2027-01-15", exata: true });
  assert.equal(planoDoCalendario(cal, "2027-01-07").oculto, false);
  assert.equal(planoDoCalendario(cal, "2027-01-08").oculto, true);
  assert.equal(planoDoCalendario(cal, "2027-01-15").oculto, true);
  assert.equal(planoDoCalendario(cal, "2027-01-16").oculto, false);
});

test("plano programa a próxima ocultação e o trimestre certo", () => {
  const cal = calendario({ "2026-t4": "2027-01-15", "2027-t1": "2027-04-12" }, 5);
  const p = planoDoCalendario(cal, "2026-10-06");
  assert.deepEqual(p.trimestre, { ativo: true, nome: "4º trimestre 2026", inicio: "2026-10-01", fim: "2026-12-31" });
  assert.equal(p.ocultacao?.inicio, "2027-01-10");
  assert.equal(p.oculto, false);
  // Depois da premiação de jan, já programa a de abril.
  assert.equal(planoDoCalendario(cal, "2027-01-16").ocultacao?.fim, "2027-04-12");
});

test("sem premiação ou com 0 dias, nada é ocultado; sem trimestre hoje, desliga o trimestral", () => {
  assert.equal(planoDoCalendario(calendario({}), "2026-10-06").ocultacao, null);
  assert.equal(planoDoCalendario(calendario({ "2026-t4": "2027-01-15" }, 0), "2027-01-15").oculto, false);
  assert.equal(planoDoCalendario(calendario({}), "2030-01-01").trimestre.ativo, false);
});

test("validação aponta datas trocadas, sobreposição e premiação antes do início", () => {
  const cal = normalizarCalendario({
    ativo: true,
    trimestres: [
      { id: "a", nome: "A", inicio: "2026-01-01", fim: "2026-03-31", premiacao: "" },
      { id: "b", nome: "B", inicio: "2026-03-15", fim: "2026-06-30", premiacao: "" },
      { id: "c", nome: "C", inicio: "2026-08-01", fim: "2026-07-01", premiacao: "" },
      { id: "d", nome: "D", inicio: "2026-10-01", fim: "2026-12-31", premiacao: "2026-09-01" },
    ],
  });
  const v = validarCalendario(cal).porTrimestre;
  assert.match(v.b, /Começa antes/);
  assert.match(v.c, /depois do início/);
  assert.match(v.d, /premiação/);
  assert.equal(v.a, undefined);
  assert.equal(validarCalendario(normalizarCalendario({ ativo: true })).geral !== null, true);
});

test("normalização limita os dias e aceita documento vazio", () => {
  assert.equal(normalizarCalendario({ diasOcultos: 999 }).diasOcultos, 60);
  assert.equal(normalizarCalendario({ diasOcultos: -3 }).diasOcultos, 0);
  assert.equal(normalizarCalendario(undefined).ativo, false);
});

test("só o mês da premiação: oculta de N dias antes do dia 1 até o fim do mês", () => {
  const cal = normalizarCalendario({
    ativo: true,
    diasOcultos: 7,
    trimestres: [
      { id: "t4", nome: "4º", inicio: "2026-10-01", fim: "2026-12-31", premiacao: "", premiacaoMes: "2027-01" },
      { id: "t1", nome: "1º", inicio: "2027-01-01", fim: "2027-03-31", premiacao: "", premiacaoMes: "" },
    ],
  });
  assert.deepEqual(janelaDaPremiacao(cal.trimestres[0], 7), { inicio: "2026-12-25", fim: "2027-01-31", exata: false });
  assert.equal(planoDoCalendario(cal, "2026-12-24").oculto, false);
  assert.equal(planoDoCalendario(cal, "2026-12-25").oculto, true);
  assert.equal(planoDoCalendario(cal, "2027-01-31").oculto, true);
  assert.equal(planoDoCalendario(cal, "2027-02-01").oculto, false);
  // O 4º segue valendo o mês da premiação inteiro; depois, o 1º assume.
  assert.equal(trimestreVigente(cal, "2027-01-20")?.id, "t4");
  assert.equal(trimestreVigente(cal, "2027-02-01")?.id, "t1");
});

test("o dia exato vale mais que o mês", () => {
  const t = { id: "x", nome: "x", inicio: "2026-10-01", fim: "2026-12-31", premiacao: "2027-01-12", premiacaoMes: "2027-01" };
  assert.deepEqual(janelaDaPremiacao(t, 3), { inicio: "2027-01-09", fim: "2027-01-12", exata: true });
});

test("mês da premiação antes do trimestre é recusado; mês inválido é descartado", () => {
  const cal = normalizarCalendario({
    ativo: true,
    trimestres: [{ id: "a", nome: "A", inicio: "2026-10-01", fim: "2026-12-31", premiacao: "", premiacaoMes: "2026-09" }],
  });
  assert.match(validarCalendario(cal).porTrimestre.a, /mês da premiação/);
  const lixo = normalizarCalendario({ trimestres: [{ id: "a", nome: "A", inicio: "2026-10-01", fim: "2026-12-31", premiacao: "", premiacaoMes: "jan" }] });
  assert.equal(lixo.trimestres[0].premiacaoMes, "");
});
