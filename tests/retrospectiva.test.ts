import { test } from "node:test";
import assert from "node:assert/strict";
import { capituloDoCaminho, duracaoLegivel, ehMusica, montarCenas, OPCOES_PADRAO, ordenarItens, rotuloDoMes, tamanhoReduzido, tipoDoArquivo, tituloDoCapitulo, type ItemRetro } from "../src/lib/retrospectiva";
import { opcoesDaRetrospectiva, validarReuniao } from "../src/lib/reuniaoResultados";

const dia = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const item = (id: string, data: string, extra: Partial<ItemRetro> = {}): ItemRetro => ({ id, nome: `${id}.jpg`, url: `blob:${id}`, tipo: "foto", data: dia(data), capitulo: "", retrato: false, ...extra });

test("arquivos aceitos: fotos, HEIC do iPhone, vídeos e música", () => {
  assert.equal(tipoDoArquivo({ type: "image/jpeg", name: "a.jpg" }), "foto");
  assert.equal(tipoDoArquivo({ type: "", name: "IMG_1.PNG" }), "foto");
  assert.equal(tipoDoArquivo({ type: "image/heic", name: "a.heic" }), "heic");
  assert.equal(tipoDoArquivo({ type: "", name: "IMG_2.HEIC" }), "heic");
  assert.equal(tipoDoArquivo({ type: "video/quicktime", name: "v.mov" }), "video");
  assert.equal(tipoDoArquivo({ type: "text/plain", name: "x.txt" }), null);
  assert.equal(tipoDoArquivo({ type: "image/jpeg", name: "._lixo.jpg" }), null);
  assert.equal(ehMusica({ type: "audio/mpeg", name: "trilha.mp3" }), true);
  assert.equal(ehMusica({ type: "", name: "trilha.M4A" }), true);
});

test("capítulos pelas subpastas e ordem pela data", () => {
  assert.equal(capituloDoCaminho("Retro/Corrida de março/IMG_1.jpg"), "Corrida de março");
  assert.equal(capituloDoCaminho("Retro/IMG_1.jpg"), "");
  assert.equal(capituloDoCaminho("Retro/A/B/IMG_1.jpg"), "A");
  assert.equal(tituloDoCapitulo("01 - Largada"), "Largada");
  assert.equal(tituloDoCapitulo("2026"), "2026");
  // Sem números: o capítulo que começa antes vem antes.
  const porData = ordenarItens([item("b2", "2026-05-02", { capitulo: "Bike" }), item("c1", "2026-03-01", { capitulo: "Corrida" }), item("b1", "2026-05-01", { capitulo: "Bike" }), item("solta", "2026-09-01")]);
  assert.deepEqual(porData.map((i) => i.id), ["solta", "c1", "b1", "b2"]);
  // Numerados: vale o número.
  const numerados = ordenarItens([item("x", "2026-01-01", { capitulo: "02 - Final" }), item("y", "2026-12-01", { capitulo: "01 - Começo" })]);
  assert.deepEqual(numerados.map((i) => i.id), ["y", "x"]);
});

test("cenas: capítulo, duplas de fotos em pé, legenda do mês, favorita, oculta e encerramento", () => {
  const itens = [
    item("a", "2026-03-01", { capitulo: "Corrida" }),
    item("b", "2026-03-02", { capitulo: "Corrida", retrato: true }),
    item("c", "2026-03-03", { capitulo: "Corrida", retrato: true }),
    item("d", "2026-04-01", { capitulo: "Corrida", favorita: true }),
    item("e", "2026-04-02", { capitulo: "Corrida", oculta: true }),
    item("v", "2026-04-03", { capitulo: "Corrida", tipo: "video", duracao: 42 }),
  ];
  const { cenas, total } = montarCenas(itens, OPCOES_PADRAO);
  assert.deepEqual(
    cenas.map((c) => c.tipo),
    ["capitulo", "foto", "dupla", "foto", "video", "encerramento"],
  );
  assert.deepEqual(cenas.map((c) => ("legenda" in c ? c.legenda : "-")), ["-", "Março 2026", null, "Abril 2026", null, "-"]);
  assert.equal(cenas[3].duracao, 8);
  assert.equal(cenas[4].duracao, 20);
  assert.equal(cenas[5].tipo === "encerramento" && cenas[5].total, 5);
  assert.equal(total, 4 + 3.5 + 5 + 6.5 + 8 + 20);
  // Repetir: sem encerramento. Sem legendas: nenhuma.
  const r = montarCenas(itens, { ...OPCOES_PADRAO, repetir: true, legendas: false }).cenas;
  assert.equal(r.at(-1)!.tipo, "video");
  assert.ok(r.every((c) => !("legenda" in c) || c.legenda === null));
});

test("mosaico de vez em quando e ajuste à música", () => {
  const itens = Array.from({ length: 12 }, (_, i) => item(`f${i}`, `2026-05-${String(i + 1).padStart(2, "0")}`));
  const { cenas } = montarCenas(itens, OPCOES_PADRAO);
  assert.deepEqual(cenas.map((c) => c.tipo).slice(0, 9), ["foto", "foto", "foto", "foto", "foto", "foto", "foto", "mosaico", "foto"]);
  // 7 fotos (35 s) + mosaico (8 s) + 2 fotos (10 s) + abertura 4 = 57 s; música de 110 s dobra o tempo das fotos.
  const ajustado = montarCenas(itens, { ...OPCOES_PADRAO, ajustarMusica: true }, 110);
  assert.equal(ajustado.cenas[0].duracao, 10);
  assert.equal(Math.round(ajustado.total), 110);
  // Sem música, "ajustar" não muda nada.
  assert.equal(montarCenas(itens, { ...OPCOES_PADRAO, ajustarMusica: true }, null).cenas[0].duracao, 5);
});

test("embaralhar é repetível e não mistura capítulos", () => {
  const itens = [...Array.from({ length: 6 }, (_, i) => item(`a${i}`, `2026-01-0${i + 1}`, { capitulo: "01 A" })), ...Array.from({ length: 6 }, (_, i) => item(`b${i}`, `2026-02-0${i + 1}`, { capitulo: "02 B" }))];
  const ordem = (o: typeof OPCOES_PADRAO) => montarCenas(itens, o).cenas.flatMap((c) => (c.tipo === "foto" ? [c.item.id] : c.tipo === "mosaico" ? c.itens.map((i) => i.id) : []));
  const um = ordem({ ...OPCOES_PADRAO, embaralhar: true });
  assert.deepEqual(um, ordem({ ...OPCOES_PADRAO, embaralhar: true }));
  assert.notDeepEqual(um, ordem(OPCOES_PADRAO));
  assert.ok(um.slice(0, 6).every((id) => id.startsWith("a")));
});

test("textos auxiliares e opções salvas", () => {
  assert.equal(rotuloDoMes(dia("2026-12-31")), "Dezembro 2026");
  assert.equal(duracaoLegivel(45), "45 s");
  assert.equal(duracaoLegivel(200), "3 min 20 s");
  assert.deepEqual(tamanhoReduzido(4032, 3024), { largura: 1920, altura: 1440 });
  assert.deepEqual(tamanhoReduzido(800, 600), { largura: 800, altura: 600 });
  assert.deepEqual(opcoesDaRetrospectiva({}), { segundos: 5, repetir: false, embaralhar: false, legendas: true, ajustarMusica: false });
  const r = validarReuniao({
    periodo: { nome: "T", inicio: "2026-06-01", fim: "2026-08-31" },
    secoes: [{ id: "r", tipo: "livre", ativo: true }],
    livres: [{ id: "r", layout: "retrospectiva", titulo: "R", sobretitulo: "", texto: "", imagemId: null, segundos: 99, retro: { repetir: true, embaralhar: "x" } }],
  });
  assert.ok("dados" in r);
  if ("dados" in r) {
    assert.equal(r.dados.livres[0].segundos, 15);
    assert.deepEqual(r.dados.livres[0].retro, { repetir: true, embaralhar: false, legendas: true, ajustarMusica: false });
  }
});
