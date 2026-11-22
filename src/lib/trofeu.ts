/**
 * Troféus e lembranças em acrílico: a arte vai para a gráfica, que imprime
 * em adesivo branco, cola no acrílico e corta no contorno. Aqui ficam as
 * formas de corte (em unidades de desenho, 1000 de largura), as áreas onde
 * o texto cabe em cada forma e a conta do tamanho de impressão.
 */

export type FormatoTrofeu = "facetado" | "taca" | "medalha" | "escudo" | "placa";
export type EstiloTrofeu = "claro" | "marinho" | "dourado";
export type TipoPeca = "participacao" | "premiacao";

export const LARGURA_BASE = 1000;
/** Qualidade de impressão. */
export const DPI = 300;

export interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FormaTrofeu {
  id: FormatoTrofeu;
  nome: string;
  descricao: string;
  altura: number;
  /** Contorno de corte (SVG path, em unidades de desenho). */
  contorno: string;
  /** Onde o conteúdo principal cabe sem encostar na borda. */
  conteudo: Caixa;
  /** Taça: a placa da base, onde vai o nome. */
  base?: Caixa;
}

type Ponto = [number, number];

/** Polígono com cantos arredondados (raio r) — os cantos vivos quebram no acrílico. */
export function poligonoArredondado(pontos: Ponto[], r: number) {
  const n = pontos.length;
  const partes: string[] = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = pontos[(i - 1 + n) % n];
    const [cx, cy] = pontos[i];
    const [nx, ny] = pontos[(i + 1) % n];
    const d1 = Math.hypot(cx - px, cy - py);
    const d2 = Math.hypot(nx - cx, ny - cy);
    const k1 = Math.min(r, d1 / 2) / d1;
    const k2 = Math.min(r, d2 / 2) / d2;
    const a: Ponto = [cx + (px - cx) * k1, cy + (py - cy) * k1];
    const b: Ponto = [cx + (nx - cx) * k2, cy + (ny - cy) * k2];
    partes.push(`${i === 0 ? "M" : "L"}${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${cx} ${cy} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
  }
  return `${partes.join(" ")} Z`;
}

// Sentido horário, como os polígonos: as partes que se sobrepõem se somam.
const circulo = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;

export const FORMAS: Record<FormatoTrofeu, FormaTrofeu> = {
  facetado: {
    id: "facetado",
    nome: "Facetado",
    descricao: "Como a peça do Corrida & Pedal",
    altura: 1000,
    contorno: poligonoArredondado(
      [
        [300, 22],
        [700, 22],
        [945, 205],
        [985, 575],
        [790, 975],
        [210, 975],
        [15, 575],
        [55, 205],
      ],
      34,
    ),
    conteudo: { x: 95, y: 95, w: 810, h: 810 },
  },
  taca: {
    id: "taca",
    nome: "Taça",
    descricao: "Troféu com alças e base",
    altura: 1240,
    contorno: [
      // Copa
      "M170 40 L830 40 Q850 40 848 62 C836 360 720 600 560 668 L560 690 L440 690 L440 668 C280 600 164 360 152 62 Q150 40 170 40 Z",
      // Alças (meia-lua de cada lado, sem furo: o corte fica simples)
      // (as duas no mesmo sentido do resto: senão a sobreposição com a copa vira um furo)
      "M184 176 C118 172 92 210 102 262 C118 340 190 392 262 410 L270 470 C170 450 70 380 40 270 C20 190 40 110 176 110 Z",
      "M824 110 C960 110 980 190 960 270 C930 380 830 450 730 470 L738 410 C810 392 882 340 898 262 C908 210 882 172 816 176 Z",
      // Haste
      "M455 680 L545 680 L560 860 L440 860 Z",
      // Base
      poligonoArredondado(
        [
          [330, 850],
          [670, 850],
          [700, 905],
          [780, 905],
          [800, 1215],
          [200, 1215],
          [220, 905],
          [300, 905],
        ],
        14,
      ),
    ].join(" "),
    conteudo: { x: 230, y: 85, w: 540, h: 525 },
    base: { x: 245, y: 925, w: 510, h: 270 },
  },
  medalha: {
    id: "medalha",
    nome: "Medalha",
    descricao: "Redonda, com a alça em cima",
    altura: 1080,
    contorno: `${circulo(500, 600, 470)} ${poligonoArredondado(
      [
        [420, 20],
        [580, 20],
        [600, 150],
        [400, 150],
      ],
      20,
    )}`,
    conteudo: { x: 175, y: 260, w: 650, h: 680 },
  },
  escudo: {
    id: "escudo",
    nome: "Escudo",
    descricao: "Clássico de premiação",
    altura: 1180,
    contorno: "M500 18 C620 70 760 88 960 80 Q982 80 982 102 L982 560 C982 860 760 1060 500 1162 C240 1060 18 860 18 560 L18 102 Q18 80 40 80 C240 88 380 70 500 18 Z",
    conteudo: { x: 120, y: 150, w: 760, h: 760 },
  },
  placa: {
    id: "placa",
    nome: "Placa",
    descricao: "Retângulo em pé, cantos chanfrados",
    altura: 1300,
    contorno: poligonoArredondado(
      [
        [90, 15],
        [910, 15],
        [985, 90],
        [985, 1210],
        [910, 1285],
        [90, 1285],
        [15, 1210],
        [15, 90],
      ],
      16,
    ),
    conteudo: { x: 100, y: 110, w: 800, h: 1080 },
  },
};

export const ORDEM_FORMATOS: FormatoTrofeu[] = ["facetado", "taca", "medalha", "escudo", "placa"];

export const ESTILOS: { id: EstiloTrofeu; nome: string; descricao: string }[] = [
  { id: "claro", nome: "Claro", descricao: "Branco, como a peça do Corrida & Pedal" },
  { id: "marinho", nome: "Marinho", descricao: "Azul-escuro com filete dourado" },
  { id: "dourado", nome: "Marfim", descricao: "Marfim com filete e detalhes dourados" },
];

/** Tamanho na impressão: a largura é a que o comitê pede; a altura segue a forma. */
export function tamanhoImpresso(formato: FormatoTrofeu, larguraCm: number) {
  const f = FORMAS[formato];
  const alturaCm = Math.round(((larguraCm * f.altura) / LARGURA_BASE) * 10) / 10;
  const px = (cm: number) => Math.round((cm / 2.54) * DPI);
  return { larguraCm, alturaCm, larguraPx: px(larguraCm), alturaPx: px(alturaCm), escala: px(larguraCm) / LARGURA_BASE };
}

/** Pontos do PDF (1 pt = 1/72 pol). */
export const cmParaPt = (cm: number) => (cm / 2.54) * 72;

export interface TextosParticipacao {
  sobretitulo: string;
  titulo: string;
  local: string;
  data: string;
}

export interface TextosPremiacao {
  /** "Atleta do ano", "Destaque do trimestre". */
  premio: string;
  /** "2026", "3º trimestre 2026". */
  periodo: string;
}

/** "1º lugar"; o 1º do Atleta do ano vira "Campeão". */
export function textoDaColocacao(colocacao: number | undefined, campeao = false) {
  if (!colocacao) return "";
  if (colocacao === 1 && campeao) return "Campeão";
  return `${colocacao}º lugar`;
}

/** "trofeu-atleta-do-ano-corrida-1-mariana.png". */
export function nomeDoArquivoTrofeu(partes: (string | number | undefined)[], extensao: "png" | "pdf") {
  const base = partes
    .filter((p) => p !== undefined && p !== "")
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${base || "trofeu"}.${extensao}`;
}
