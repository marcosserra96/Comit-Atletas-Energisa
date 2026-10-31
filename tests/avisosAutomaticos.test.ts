import test from "node:test";
import assert from "node:assert/strict";
import {
  detectarUltrapassagens,
  ehHoraDaVespera,
  mensagemDeAcessoLiberado,
  mensagemDeConvite,
  mensagemDeVespera,
  precisaConviteParaTreinar,
  mensagemDePontos,
  mensagemDeUltrapassagem,
  normalizarPreferencias,
  podeReceberAvisoComite,
  resumirPontosPorAtleta,
} from "../src/lib/push/automaticos";

const l = (atletaId: string, nome: string, pontos: number, visivel = true) => ({ atletaId, nome, pontos, visivel });

test("pontos: agrupa por atleta e ignora estorno, importação e QR do próprio atleta", () => {
  const r = resumirPontosPorAtleta([
    { atletaId: "a", pontos: 5, descricaoLote: "Treino coletivo", dataTreino: "2026-10-09" },
    { atletaId: "a", pontos: 10, regraDesc: "Recorde pessoal", dataTreino: "2026-10-09" },
    { atletaId: "a", pontos: 5, estornado: true },
    { atletaId: "b", pontos: 20, tipoLancamento: "importacao" },
    { atletaId: "c", pontos: 10, origemPresenca: "qrcode" },
    { atletaId: "d", pontos: -5 },
  ]);
  assert.deepEqual([...r.keys()], ["a"]);
  assert.equal(r.get("a")?.total, 15);
  const m = mensagemDePontos(r.get("a")!);
  assert.equal(m.titulo, "Você ganhou 15 pontos");
  assert.equal(m.corpo, "Treino coletivo, Recorde pessoal · 09/10");
});

test("ranking: quem passou à frente gera aviso; empate não", () => {
  const antes = { ana: 1, bia: 2, caio: 3 };
  // Bia passa Ana; Caio empata com Ana.
  const agora = [l("ana", "Ana Lima", 100), l("bia", "Bia Souza", 110), l("caio", "Caio Reis", 100)];
  const u = detectarUltrapassagens(antes, agora);
  assert.equal(u.length, 1);
  assert.equal(u[0].atletaId, "ana");
  assert.equal(u[0].posicaoAgora, 2);
  assert.deepEqual(u[0].quem, ["Bia Souza"]);
  assert.equal(u[0].faltam, 10);
  assert.equal(mensagemDeUltrapassagem(u[0]).titulo, "Bia Souza passou você no ranking");
});

test("ranking: perfil oculto vira 'um colega' e quem entra no ranking também ultrapassa", () => {
  const u = detectarUltrapassagens({ ana: 1 }, [l("ana", "Ana", 50), l("novo", "Fulano de Tal Silva", 60, false)]);
  assert.equal(u.length, 1);
  assert.equal(mensagemDeUltrapassagem(u[0]).titulo, "Alguém passou você no ranking");
});

test("ranking: manter a posição não avisa; quem foi passado sim", () => {
  assert.equal(detectarUltrapassagens({ ana: 2, bia: 1 }, [l("ana", "Ana", 80), l("bia", "Bia", 90)]).length, 0);
  const u = detectarUltrapassagens({ ana: 2, bia: 1 }, [l("ana", "Ana", 90), l("bia", "Bia", 80)]);
  assert.deepEqual(u.map((x) => x.atletaId), ["bia"]);
});

test("preferências e quem do comitê recebe", () => {
  assert.equal(normalizarPreferencias({ ranking: false }).ranking, false);
  assert.equal(normalizarPreferencias(null).pontos, true);
  assert.equal(podeReceberAvisoComite({ role: "administrador" }, "comite_acesso"), true);
  assert.equal(podeReceberAvisoComite({ role: "comite", permissoes: ["atletas"] }, "comite_acesso"), false);
  assert.equal(podeReceberAvisoComite({ role: "comite", permissoes: ["registrar"] }, "comite_justificativa"), true);
  assert.equal(podeReceberAvisoComite({ role: "comite", permissoes: ["atletas"] }, "comite_senha"), true);
  assert.equal(podeReceberAvisoComite({ role: "atleta" }, "comite_senha"), false);
});

test("preferências antigas ganham o resumo do mês ligado", () => {
  assert.equal(normalizarPreferencias({ pontos: false }).resumo_mes, true);
  assert.equal(normalizarPreferencias({ resumo_mes: false }).resumo_mes, false);
});

test("acesso liberado: mensagem com o primeiro nome", () => {
  assert.deepEqual(mensagemDeAcessoLiberado("Ana Beatriz Lima"), {
    titulo: "Seu acesso foi liberado!",
    corpo: "Boas-vindas ao Atletas Energisa, Ana. Toque para entrar no portal.",
  });
  assert.equal(mensagemDeAcessoLiberado("").corpo, "Boas-vindas ao Atletas Energisa. Toque para entrar no portal.");
});

test("véspera do evento: só no dia anterior, a partir das 18h de Brasília", () => {
  const br = (iso: string) => Date.parse(`${iso}-03:00`);
  assert.equal(ehHoraDaVespera("2026-11-08", br("2026-11-07T17:59:00")), false);
  assert.equal(ehHoraDaVespera("2026-11-08", br("2026-11-07T18:00:00")), true);
  assert.equal(ehHoraDaVespera("2026-11-08", br("2026-11-08T08:00:00")), false);
  assert.equal(ehHoraDaVespera("2027-01-01", br("2026-12-31T20:00:00")), true);
  assert.deepEqual(mensagemDeVespera({ titulo: "Corrida Unimed", local: "Parque das Águas", horaInicio: "07:00" }), {
    titulo: "Amanhã: Corrida Unimed",
    corpo: "Você confirmou presença, às 07:00, em Parque das Águas. Bom evento!",
  });
  assert.equal(mensagemDeVespera({ titulo: "Reunião mensal", local: "Online", horaInicio: "19:00", reuniao: true, online: true }).corpo, "Você confirmou presença, às 19:00, online. Até lá!");
  assert.equal(mensagemDeVespera({ titulo: "Treinão" }).corpo, "Você confirmou presença. Bom evento!");
});

test("convite para voltar a treinar: 3 semanas a 4 meses, sem justificativa, um por mês", () => {
  const base = { hoje: "2026-11-30", ausenciaJustificada: false };
  assert.equal(precisaConviteParaTreinar({ ...base, ultimaAtividade: "2026-11-10" }), false); // 20 dias
  assert.equal(precisaConviteParaTreinar({ ...base, ultimaAtividade: "2026-11-09" }), true); // 21 dias
  assert.equal(precisaConviteParaTreinar({ ...base, ultimaAtividade: "2026-07-01" }), false); // mais de 4 meses
  assert.equal(precisaConviteParaTreinar({ ...base, ultimaAtividade: null }), false); // nunca treinou
  assert.equal(precisaConviteParaTreinar({ ...base, ultimaAtividade: "2026-11-01", ausenciaJustificada: true }), false);
  assert.equal(precisaConviteParaTreinar({ ...base, ultimaAtividade: "2026-11-01", ultimoConvite: "2026-11-15" }), false);
  assert.equal(precisaConviteParaTreinar({ ...base, ultimaAtividade: "2026-10-01", ultimoConvite: "2026-10-31" }), true);
  assert.deepEqual(mensagemDeConvite("Ana Beatriz Lima", "2026-11-01", "2026-11-30"), {
    titulo: "Sentimos sua falta, Ana",
    corpo: "Faz 4 semanas do seu último treino. Que tal voltar esta semana? Veja os próximos treinos e provas na agenda.",
  });
});
