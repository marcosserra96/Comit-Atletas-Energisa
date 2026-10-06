import { test } from "node:test";
import assert from "node:assert/strict";
import { textoAusencia, validarAusenciaEvento } from "../src/lib/ausenciasEvento";
import { eventoOnline } from "../src/lib/eventos";
import { tempoDoPeriodo, textoTempoDoPeriodo } from "../src/lib/tempoPeriodo";

test("não vou: motivo é obrigatório; 'outro' pede explicação", () => {
  assert.deepEqual(validarAusenciaEvento({}), { erro: "Escolha o motivo." });
  assert.deepEqual(validarAusenciaEvento({ motivo: "inventado" }), { erro: "Escolha o motivo." });
  assert.ok("erro" in validarAusenciaEvento({ motivo: "outro", detalhe: " " }));
  assert.deepEqual(validarAusenciaEvento({ motivo: "trabalho" }), { motivo: "trabalho", detalhe: "" });
  assert.deepEqual(validarAusenciaEvento({ motivo: "outro", detalhe: "  casamento   da irmã " }), {
    motivo: "outro",
    detalhe: "casamento da irmã",
  });
  assert.ok("erro" in validarAusenciaEvento({ motivo: "viagem", detalhe: "x".repeat(301) }));
});

test("texto do aviso junta motivo e detalhe", () => {
  assert.equal(textoAusencia({ motivo: "saude", detalhe: "" }), "Saúde ou lesão");
  assert.equal(textoAusencia({ motivo: "trabalho", detalhe: "plantão" }), "Trabalho · plantão");
});

test("evento online: marcado ou, nos antigos, local escrito Online", () => {
  assert.equal(eventoOnline({ online: true, local: "Online" }), true);
  assert.equal(eventoOnline({ local: " online " }), true);
  assert.equal(eventoOnline({ local: "Sala 3" }), false);
  assert.equal(eventoOnline({ online: false, local: "Auditório" }), false);
});

test("tempo do trimestre: antes, durante (contando hoje) e depois", () => {
  const meioDia = (iso: string) => new Date(`${iso}T15:00:00Z`); // 12h em Brasília
  assert.deepEqual(tempoDoPeriodo("2026-10-01", "2026-12-31", meioDia("2026-09-28")), { fase: "antes", dias: 3, progresso: 0 });
  const durante = tempoDoPeriodo("2026-10-01", "2026-12-31", meioDia("2026-10-06"));
  assert.equal(durante.fase, "durante");
  assert.equal(durante.dias, 87);
  assert.ok(durante.progresso > 0.05 && durante.progresso < 0.07);
  assert.equal(textoTempoDoPeriodo(tempoDoPeriodo("2026-10-01", "2026-12-31", meioDia("2026-12-31"))), "Último dia");
  assert.equal(tempoDoPeriodo("2026-10-01", "2026-12-31", meioDia("2027-01-02")).fase, "depois");
});

test("o dia vira no horário de Brasília, não em UTC", () => {
  // 01/10 às 23h em Brasília = 02/10 02h UTC: ainda é o primeiro dia.
  const t = tempoDoPeriodo("2026-10-01", "2026-12-31", new Date("2026-10-02T02:00:00Z"));
  assert.equal(t.dias, 92);
});
