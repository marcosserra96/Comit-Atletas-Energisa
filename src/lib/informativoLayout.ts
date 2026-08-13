/**
 * Posição, tamanho e comportamento de um campo do informativo, no espaço de
 * coordenadas do fundo (1672x941). Convenção — a mesma no PDF e no editor:
 * `x` é a borda esquerda da caixa e `y` é o centro vertical do texto.
 */
export interface CampoLayout {
  x: number;
  y: number;
  fontSize: number;
  /** Largura da caixa. O texto é alinhado dentro dela e, se quebrar, quebra nessa largura. */
  boxW: number;
  /** Quando falso, o texto fica numa linha só (corta com "…" se não couber). */
  quebraLinha: boolean;
}

export type CampoId =
  | "mesLabel"
  | "kpi1"
  | "kpi2"
  | "kpi3"
  | "kpi4"
  | "kpi1Label"
  | "kpi2Label"
  | "kpi3Label"
  | "kpi4Label"
  | "podio2Nome"
  | "podio2Pts"
  | "podio2Treinos"
  | "podio2Km"
  | "podio1Nome"
  | "podio1Pts"
  | "podio1Treinos"
  | "podio1Km"
  | "podio3Nome"
  | "podio3Pts"
  | "podio3Treinos"
  | "podio3Km"
  | "rankRow1"
  | "rankEsqPos"
  | "rankDirPos"
  | "rankEsqNome"
  | "rankEsqPontos"
  | "rankEsqTreinos"
  | "rankEsqKm"
  | "rankDirNome"
  | "rankDirPontos"
  | "rankDirTreinos"
  | "rankDirKm"
  | "destaque1Titulo"
  | "destaque1Linha1"
  | "destaque2Titulo"
  | "destaque2Linha1"
  | "destaque3Titulo"
  | "destaque3Linha1";

/** Em que eixo o campo pode ser arrastado — colunas da tabela só fazem sentido mover na horizontal, e a linha 1 só na vertical. */
export type Eixo = "x" | "y" | "xy";

export interface CampoInfo {
  label: string;
  grupo: string;
  eixo: Eixo;
  align: "left" | "center" | "right";
}

export const CAMPOS_ORDEM: CampoId[] = [
  "mesLabel",
  "kpi1",
  "kpi2",
  "kpi3",
  "kpi4",
  "kpi1Label",
  "kpi2Label",
  "kpi3Label",
  "kpi4Label",
  "podio1Nome",
  "podio1Pts",
  "podio1Treinos",
  "podio1Km",
  "podio2Nome",
  "podio2Pts",
  "podio2Treinos",
  "podio2Km",
  "podio3Nome",
  "podio3Pts",
  "podio3Treinos",
  "podio3Km",
  "rankRow1",
  "rankEsqPos",
  "rankEsqNome",
  "rankEsqPontos",
  "rankEsqTreinos",
  "rankEsqKm",
  "rankDirPos",
  "rankDirNome",
  "rankDirPontos",
  "rankDirTreinos",
  "rankDirKm",
  "destaque1Titulo",
  "destaque1Linha1",
  "destaque2Titulo",
  "destaque2Linha1",
  "destaque3Titulo",
  "destaque3Linha1",
];

export const CAMPOS_INFO: Record<CampoId, CampoInfo> = {
  mesLabel: { label: "Mês / período", grupo: "Cabeçalho", eixo: "xy", align: "left" },
  kpi1: { label: "Pontos totais", grupo: "KPIs", eixo: "xy", align: "left" },
  kpi2: { label: "Quantidade de treinos", grupo: "KPIs", eixo: "xy", align: "left" },
  kpi3: { label: "KM acumulados", grupo: "KPIs", eixo: "xy", align: "left" },
  kpi4: { label: "Atletas no ranking", grupo: "KPIs", eixo: "xy", align: "left" },
  kpi1Label: { label: "Rótulo — pontos totais", grupo: "KPIs", eixo: "xy", align: "left" },
  kpi2Label: { label: "Rótulo — quantidade de treinos", grupo: "KPIs", eixo: "xy", align: "left" },
  kpi3Label: { label: "Rótulo — KM acumulados", grupo: "KPIs", eixo: "xy", align: "left" },
  kpi4Label: { label: "Rótulo — atletas no ranking", grupo: "KPIs", eixo: "xy", align: "left" },

  podio1Nome: { label: "1º lugar — nome", grupo: "Pódio", eixo: "xy", align: "center" },
  podio1Pts: { label: "1º lugar — pontos", grupo: "Pódio", eixo: "xy", align: "left" },
  podio1Treinos: { label: "1º lugar — treinos", grupo: "Pódio", eixo: "xy", align: "left" },
  podio1Km: { label: "1º lugar — km", grupo: "Pódio", eixo: "xy", align: "left" },
  podio2Nome: { label: "2º lugar — nome", grupo: "Pódio", eixo: "xy", align: "center" },
  podio2Pts: { label: "2º lugar — pontos", grupo: "Pódio", eixo: "xy", align: "left" },
  podio2Treinos: { label: "2º lugar — treinos", grupo: "Pódio", eixo: "xy", align: "left" },
  podio2Km: { label: "2º lugar — km", grupo: "Pódio", eixo: "xy", align: "left" },
  podio3Nome: { label: "3º lugar — nome", grupo: "Pódio", eixo: "xy", align: "center" },
  podio3Pts: { label: "3º lugar — pontos", grupo: "Pódio", eixo: "xy", align: "left" },
  podio3Treinos: { label: "3º lugar — treinos", grupo: "Pódio", eixo: "xy", align: "left" },
  podio3Km: { label: "3º lugar — km", grupo: "Pódio", eixo: "xy", align: "left" },

  rankRow1: { label: "Altura da 1ª linha", grupo: "Ranking geral", eixo: "y", align: "center" },
  rankEsqPos: { label: "Esquerda — posição", grupo: "Ranking geral", eixo: "x", align: "center" },
  rankEsqNome: { label: "Esquerda — atleta", grupo: "Ranking geral", eixo: "x", align: "left" },
  rankEsqPontos: { label: "Esquerda — pontos", grupo: "Ranking geral", eixo: "x", align: "center" },
  rankEsqTreinos: { label: "Esquerda — treinos", grupo: "Ranking geral", eixo: "x", align: "center" },
  rankEsqKm: { label: "Esquerda — km", grupo: "Ranking geral", eixo: "x", align: "center" },
  rankDirPos: { label: "Direita — posição", grupo: "Ranking geral", eixo: "x", align: "center" },
  rankDirNome: { label: "Direita — atleta", grupo: "Ranking geral", eixo: "x", align: "left" },
  rankDirPontos: { label: "Direita — pontos", grupo: "Ranking geral", eixo: "x", align: "center" },
  rankDirTreinos: { label: "Direita — treinos", grupo: "Ranking geral", eixo: "x", align: "center" },
  rankDirKm: { label: "Direita — km", grupo: "Ranking geral", eixo: "x", align: "center" },

  destaque1Titulo: { label: "Maior quilometragem — título", grupo: "Destaques", eixo: "xy", align: "left" },
  destaque1Linha1: { label: "Maior quilometragem — 1ª linha", grupo: "Destaques", eixo: "xy", align: "left" },
  destaque2Titulo: { label: "Mais treinos — título", grupo: "Destaques", eixo: "xy", align: "left" },
  destaque2Linha1: { label: "Mais treinos — 1ª linha", grupo: "Destaques", eixo: "xy", align: "left" },
  destaque3Titulo: { label: "Maior pontuação — título", grupo: "Destaques", eixo: "xy", align: "left" },
  destaque3Linha1: { label: "Maior pontuação — 1ª linha", grupo: "Destaques", eixo: "xy", align: "left" },
};

/**
 * Ponto de partida medido pixel a pixel nas imagens informativo-fundo-*.png
 * (centro dos ícones, linhas e colunas da tabela, cards de destaque).
 */
export const INFORMATIVO_LAYOUT_PADRAO: Record<CampoId, CampoLayout> = {
  mesLabel: { x: 525, y: 137, fontSize: 15, boxW: 260, quebraLinha: false },
  kpi1: { x: 831, y: 138.5, fontSize: 21, boxW: 138, quebraLinha: false },
  kpi2: { x: 1051, y: 138, fontSize: 21, boxW: 138, quebraLinha: false },
  kpi3: { x: 1266, y: 136, fontSize: 21, boxW: 138, quebraLinha: false },
  kpi4: { x: 1517, y: 137.5, fontSize: 21, boxW: 158, quebraLinha: false },
  kpi1Label: { x: 745, y: 100, fontSize: 8, boxW: 210, quebraLinha: false },
  kpi2Label: { x: 975, y: 100, fontSize: 8, boxW: 208, quebraLinha: false },
  kpi3Label: { x: 1197, y: 100, fontSize: 8, boxW: 208, quebraLinha: false },
  kpi4Label: { x: 1422, y: 100, fontSize: 8, boxW: 238, quebraLinha: false },

  podio1Nome: { x: 202, y: 400, fontSize: 12.5, boxW: 178, quebraLinha: true },
  podio1Pts: { x: 274, y: 444.5, fontSize: 12, boxW: 90, quebraLinha: false },
  podio1Treinos: { x: 274, y: 470.5, fontSize: 12, boxW: 90, quebraLinha: false },
  podio1Km: { x: 274, y: 509.5, fontSize: 12, boxW: 90, quebraLinha: false },
  podio2Nome: { x: 18, y: 413, fontSize: 12.5, boxW: 172, quebraLinha: true },
  podio2Pts: { x: 90, y: 448, fontSize: 12, boxW: 90, quebraLinha: false },
  podio2Treinos: { x: 90, y: 494.5, fontSize: 12, boxW: 90, quebraLinha: false },
  podio2Km: { x: 90, y: 539.5, fontSize: 12, boxW: 90, quebraLinha: false },
  podio3Nome: { x: 395, y: 431, fontSize: 12.5, boxW: 170, quebraLinha: true },
  podio3Pts: { x: 464, y: 471, fontSize: 12, boxW: 90, quebraLinha: false },
  podio3Treinos: { x: 464, y: 508.5, fontSize: 12, boxW: 90, quebraLinha: false },
  podio3Km: { x: 464, y: 550, fontSize: 12, boxW: 90, quebraLinha: false },

  rankRow1: { x: 576, y: 259.5, fontSize: 9, boxW: 78, quebraLinha: false },
  rankEsqPos: { x: 578, y: 259.5, fontSize: 11, boxW: 74, quebraLinha: false },
  rankEsqNome: { x: 662, y: 259.5, fontSize: 9, boxW: 195, quebraLinha: false },
  rankEsqPontos: { x: 857, y: 259.5, fontSize: 9, boxW: 73, quebraLinha: false },
  rankEsqTreinos: { x: 930, y: 259.5, fontSize: 9, boxW: 72, quebraLinha: false },
  rankEsqKm: { x: 1002, y: 259.5, fontSize: 9, boxW: 70, quebraLinha: false },
  rankDirPos: { x: 1094, y: 259.5, fontSize: 11, boxW: 75, quebraLinha: false },
  rankDirNome: { x: 1179, y: 259.5, fontSize: 9, boxW: 223, quebraLinha: false },
  rankDirPontos: { x: 1402, y: 259.5, fontSize: 9, boxW: 78, quebraLinha: false },
  rankDirTreinos: { x: 1480, y: 259.5, fontSize: 9, boxW: 78, quebraLinha: false },
  rankDirKm: { x: 1558, y: 259.5, fontSize: 9, boxW: 86, quebraLinha: false },

  destaque1Titulo: { x: 160, y: 753, fontSize: 11.5, boxW: 355, quebraLinha: false },
  destaque1Linha1: { x: 160, y: 788, fontSize: 10, boxW: 355, quebraLinha: false },
  destaque2Titulo: { x: 682, y: 753, fontSize: 11.5, boxW: 382, quebraLinha: false },
  destaque2Linha1: { x: 682, y: 788, fontSize: 10, boxW: 382, quebraLinha: false },
  destaque3Titulo: { x: 1225, y: 753, fontSize: 11.5, boxW: 411, quebraLinha: false },
  destaque3Linha1: { x: 1225, y: 788, fontSize: 10, boxW: 411, quebraLinha: false },
};

/** Espaçamentos repetidos — não são um ponto arrastável, só uma distância entre linhas. */
export interface InformativoLayoutExtras {
  /** Distância vertical entre duas linhas do Ranking geral. */
  rankingRowHeight: number;
  /** Distância vertical entre as 3 linhas de cada card de Destaques. */
  destaqueLinhaGap: number;
}

export const INFORMATIVO_LAYOUT_EXTRAS_PADRAO: InformativoLayoutExtras = {
  rankingRowHeight: 23.08,
  destaqueLinhaGap: 30,
};

export interface LayoutInformativo {
  campos: Record<CampoId, CampoLayout>;
  extras: InformativoLayoutExtras;
}

export const LAYOUT_INFORMATIVO_PADRAO: LayoutInformativo = {
  campos: INFORMATIVO_LAYOUT_PADRAO,
  extras: INFORMATIVO_LAYOUT_EXTRAS_PADRAO,
};

/** Quantas linhas de atleta cada uma das duas colunas do "Ranking geral" comporta na arte. */
export const RANKING_ROWS_POR_COLUNA = 19;

/** Quantos atletas cabem no Ranking geral da arte (as duas colunas somadas). */
export const CAPACIDADE_RANKING = RANKING_ROWS_POR_COLUNA * 2;

/** Amarelo dos números de posição, amostrado da própria arte — usado só quando precisamos redesenhá-los. */
export const COR_POSICAO = "#ffff03";
