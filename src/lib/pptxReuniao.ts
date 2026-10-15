"use client";

/**
 * Exporta a apresentação da reunião para PowerPoint (.pptx).
 * - Slides escritos pelo comitê (divisória e conteúdo) saem com texto
 *   editável sobre o fundo, nas mesmas cores, fonte e posições.
 * - Os slides de números (pódio, tabela, totais…) saem como imagem fiel,
 *   porque o desenho deles depende dos dados.
 * - As anotações do apresentador vão para as anotações de cada slide.
 */
import { ESCALA_TAMANHO, FONTES_SLIDE, fundoEscuro, type EstiloLivre, type FonteSlide, type SlideDef } from "@/lib/reuniaoResultados";

const L = 1920;
const A = 1080;
/** Slide 16:9 do PowerPoint: 13,333 × 7,5 polegadas. */
const POL = 13.333 / L;
/** 1080 px = 540 pt. */
const PT = 0.5;

const FUNDOS: Record<string, string> = {
  divisoria: "/reuniao/fundo-divisoria.webp",
  resultados: "/reuniao/fundo-resultados.webp",
  premiacao: "/reuniao/fundo-premiacao.webp",
  agenda: "/reuniao/fundo-agenda.webp",
  conteudo: "/reuniao/fundo-conteudo.webp",
  claro: "/reuniao/fundo-claro.webp",
};
const LOGO = "/reuniao/logo-atletas.webp";

const hex = (c: string) => c.replace("#", "").toUpperCase();
const px = (n: number) => n * POL;

/** O PowerPoint não lê WebP: converte para JPEG (fundo) ou PNG (logo). */
async function imagemParaPptx(url: string, png = false): Promise<{ data: string; w: number; h: number }> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return { data: canvas.toDataURL(png ? "image/png" : "image/jpeg", 0.88), w: img.naturalWidth, h: img.naturalHeight };
}

/** "texto com **negrito**" → trechos com e sem negrito. */
export function trechosComNegrito(linha: string) {
  return linha
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((p) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? { texto: p.slice(2, -2), negrito: true } : { texto: p, negrito: false }));
}

function nomeDaFonte(fonte: FonteSlide, temaFonte: FonteSlide) {
  const f = fonte === "barlow" ? temaFonte : fonte;
  // Primeiro nome da pilha CSS, sem aspas ("'DM Sans', ..." → "DM Sans").
  return FONTES_SLIDE[f].familia.split(",")[0].replace(/['"]/g, "").trim();
}

export async function gerarPptxDosSlides(params: {
  slides: SlideDef[];
  /** Mesmos nós renderizados para o PDF, na ordem dos slides. */
  nos: HTMLElement[];
  notas: (indice: number) => string;
  imagens: Record<string, string>;
  temaFonte: FonteSlide;
  nomeArquivo: string;
  titulo: string;
  onProgresso?: (feitos: number) => void;
}) {
  const [{ default: PptxGenJS }, { toJpeg }] = await Promise.all([import("pptxgenjs"), import("html-to-image")]);
  await document.fonts.ready;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Comitê Atletas Energisa";
  pptx.title = params.titulo;

  const cache = new Map<string, Promise<{ data: string; w: number; h: number }>>();
  const imagem = (url: string, png = false) => {
    const chave = `${url}|${png}`;
    if (!cache.has(chave)) cache.set(chave, imagemParaPptx(url, png));
    return cache.get(chave)!;
  };

  for (const [i, sl] of params.slides.entries()) {
    const s = pptx.addSlide();
    const editavel = (sl.tipo === "divisoria" || sl.tipo === "conteudo") && sl.estilo;
    if (editavel) {
      const estilo = sl.estilo as EstiloLivre;
      const solido = estilo.fundo === "cor";
      const escuro = solido && fundoEscuro(estilo.corFundo);
      const escala = ESCALA_TAMANHO[estilo.tamanho];
      const fontFace = nomeDaFonte(estilo.fonte, params.temaFonte);
      const corTitulo = hex(estilo.corTitulo ?? (escuro ? "#ffffff" : "#0b2c5f"));
      const corTexto = hex(estilo.corTexto ?? (escuro ? "#ffffff" : "#0b2c5f"));
      const destaque = hex(estilo.corDestaque ?? "#f37021");
      if (solido) s.background = { color: hex(estilo.corFundo) };
      else s.background = { data: (await imagem(FUNDOS[estilo.fundo] ?? FUNDOS.conteudo)).data };
      const align = estilo.alinhamento === "centro" ? "center" : "left";

      if (sl.tipo === "divisoria") {
        const comArte = !solido && estilo.fundo !== "conteudo";
        const x = comArte ? 760 : 160;
        const w = L - x - (comArte ? 70 : 160);
        const runs: { text: string; options: Record<string, unknown> }[] = [];
        if (sl.sobretitulo) runs.push({ text: sl.sobretitulo, options: { fontSize: 120 * escala * PT, color: destaque, bold: true, breakLine: true } });
        runs.push({ text: sl.titulo, options: { fontSize: (sl.titulo.length > 16 ? 112 : 150) * escala * PT, color: corTitulo, bold: true, breakLine: !!sl.subtitulo } });
        if (sl.subtitulo) runs.push({ text: sl.subtitulo.replace(/\*\*/g, ""), options: { fontSize: 46 * escala * PT, color: corTexto, bold: true } });
        s.addText(runs as never, { x: px(x), y: 0, w: px(w), h: px(A), align, valign: "middle", fontFace, lineSpacingMultiple: 0.95, fit: "shrink" });
      } else {
        const linhas = sl.texto.split("\n").map((l) => l.trim()).filter(Boolean);
        const imagemSlide = sl.imagemId ? params.imagens[sl.imagemId] : undefined;
        s.addText(sl.titulo.toUpperCase(), { x: px(72), y: px(40), w: px(L - 144), h: px(88), fontFace, fontSize: 56 * Math.min(escala, 1.15) * PT, bold: true, color: corTitulo, align, valign: "bottom", fit: "shrink" });
        if (estilo.fundo === "cor" || estilo.fundo !== "conteudo") {
          s.addShape("rect", { x: px(72), y: px(128), w: px(L - 144), h: px(5), fill: { color: hex(estilo.corDestaque ?? (escuro ? "#ffffff" : "#1462c4")) }, line: { type: "none" } });
        }
        const auto = linhas.length > 7 ? 30 : linhas.length > 5 || imagemSlide ? 34 : 40;
        const largura = imagemSlide ? 1060 : L - 144;
        const xTexto = imagemSlide && estilo.imagemLado === "esquerda" ? 72 + 720 + 56 : 72;
        const paragrafos = linhas.flatMap((l, n) => {
          const trechos = trechosComNegrito(l);
          return trechos.map((t, j) => ({
            text: t.texto,
            options: {
              bold: t.negrito || estilo.lista !== "paragrafo",
              ...(j === 0 && estilo.lista === "numerada" ? { bullet: { type: "number" } } : {}),
              ...(j === 0 && estilo.lista === "marcadores" ? { bullet: { code: "25CF" } } : {}),
              ...(j === trechos.length - 1 && n < linhas.length - 1 ? { breakLine: true } : {}),
            },
          }));
        });
        if (paragrafos.length) {
          s.addText(paragrafos as never, {
            x: px(xTexto),
            y: px(170),
            w: px(largura),
            h: px(A - 170 - 130),
            fontFace,
            fontSize: auto * escala * PT,
            color: corTexto,
            align,
            valign: "middle",
            paraSpaceAfter: 10,
            fit: "shrink",
          });
        }
        if (imagemSlide) {
          s.addImage({ data: imagemSlide, x: px(estilo.imagemLado === "esquerda" ? 72 : L - 72 - 720), y: px(170), w: px(720), h: px(A - 170 - 130), sizing: { type: "contain", w: px(720), h: px(A - 300) } });
        }
      }
      const logo = await imagem(LOGO, true);
      s.addImage({ data: logo.data, x: px(L - 48 - 190), y: px(A - 36 - (190 * logo.h) / logo.w), w: px(190), h: px((190 * logo.h) / logo.w) });
    } else {
      const no = params.nos[i];
      if (no) s.addImage({ data: await toJpeg(no, { width: L, height: A, pixelRatio: 1, quality: 0.9, cacheBust: true }), x: 0, y: 0, w: 13.333, h: 7.5 });
    }
    const nota = params.notas(i).trim();
    if (nota) s.addNotes(nota);
    params.onProgresso?.(i + 1);
  }
  await pptx.writeFile({ fileName: params.nomeArquivo });
}
