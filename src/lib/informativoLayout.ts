/**
 * Posição e tamanho de fonte de um campo do informativo, no espaço de
 * coordenadas do fundo (1672x941). Convenção — a mesma no PDF e no editor:
 * `x` é a borda esquerda da caixa do campo e `y` é o centro vertical do texto.
 */
export interface CampoLayout {
  x: number;
  y: number;
  fontSize: number;
}

export type CampoId =
  | "mesLabel"
  | "kpi1"
  | "kpi2"
  | "kpi3"
  | "kpi4"
  | "podio2Pts"
  | "podio2Treinos"
  | "podio2Km"
  | "podio1Pts"
  | "podio1Treinos"
  | "podio1Km"
  | "podio3Pts"
  | "podio3Treinos"
  | "podio3Km"
  | "rankRow1"
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
  /** Largura da caixa do campo (o texto é alinhado dentro dela). */
  boxW: number;
  align: "left" | "center" | "right";
}

export const CAMPOS_ORDEM: CampoId[] = [
  "mesLabel",
  "kpi1",
  "kpi2",
  "kpi3",
  "kpi4",
  "podio2Pts",
  "podio2Treinos",
  "podio2Km",
  "podio1Pts",
  "podio1Treinos",
  "podio1Km",
  "podio3Pts",
  "podio3Treinos",
  "podio3Km",
  "rankRow1",
  "rankEsqNome",
  "rankEsqPontos",
  "rankEsqTreinos",
  "rankEsqKm",
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
  mesLabel: { label: "Mês (ex: Junho de 2026)", grupo: "Cabeçalho", eixo: "xy", boxW: 260, align: "left" },
  kpi1: { label: "Pontos totais do mês", grupo: "KPIs", eixo: "xy", boxW: 138, align: "left" },
  kpi2: { label: "Quantidade de treinos", grupo: "KPIs", eixo: "xy", boxW: 138, align: "left" },
  kpi3: { label: "KM acumulados", grupo: "KPIs", eixo: "xy", boxW: 138, align: "left" },
  kpi4: { label: "Atletas no ranking", grupo: "KPIs", eixo: "xy", boxW: 158, align: "left" },

  podio2Pts: { label: "2º lugar — pontos", grupo: "Pódio", eixo: "xy", boxW: 90, align: "left" },
  podio2Treinos: { label: "2º lugar — treinos", grupo: "Pódio", eixo: "xy", boxW: 90, align: "left" },
  podio2Km: { label: "2º lugar — km", grupo: "Pódio", eixo: "xy", boxW: 90, align: "left" },
  podio1Pts: { label: "1º lugar — pontos", grupo: "Pódio", eixo: "xy", boxW: 90, align: "left" },
  podio1Treinos: { label: "1º lugar — treinos", grupo: "Pódio", eixo: "xy", boxW: 90, align: "left" },
  podio1Km: { label: "1º lugar — km", grupo: "Pódio", eixo: "xy", boxW: 90, align: "left" },
  podio3Pts: { label: "3º lugar — pontos", grupo: "Pódio", eixo: "xy", boxW: 90, align: "left" },
  podio3Treinos: { label: "3º lugar — treinos", grupo: "Pódio", eixo: "xy", boxW: 90, align: "left" },
  podio3Km: { label: "3º lugar — km", grupo: "Pódio", eixo: "xy", boxW: 90, align: "left" },

  rankRow1: { label: "Altura da 1ª linha", grupo: "Ranking geral", eixo: "y", boxW: 78, align: "center" },
  rankEsqNome: { label: "Esquerda — atleta", grupo: "Ranking geral", eixo: "x", boxW: 195, align: "left" },
  rankEsqPontos: { label: "Esquerda — pontos", grupo: "Ranking geral", eixo: "x", boxW: 73, align: "center" },
  rankEsqTreinos: { label: "Esquerda — treinos", grupo: "Ranking geral", eixo: "x", boxW: 72, align: "center" },
  rankEsqKm: { label: "Esquerda — km", grupo: "Ranking geral", eixo: "x", boxW: 70, align: "center" },
  rankDirNome: { label: "Direita — atleta", grupo: "Ranking geral", eixo: "x", boxW: 223, align: "left" },
  rankDirPontos: { label: "Direita — pontos", grupo: "Ranking geral", eixo: "x", boxW: 78, align: "center" },
  rankDirTreinos: { label: "Direita — treinos", grupo: "Ranking geral", eixo: "x", boxW: 78, align: "center" },
  rankDirKm: { label: "Direita — km", grupo: "Ranking geral", eixo: "x", boxW: 86, align: "center" },

  destaque1Titulo: { label: "Maior quilometragem — título", grupo: "Destaques", eixo: "xy", boxW: 355, align: "left" },
  destaque1Linha1: { label: "Maior quilometragem — 1ª linha", grupo: "Destaques", eixo: "xy", boxW: 355, align: "left" },
  destaque2Titulo: { label: "Mais treinos — título", grupo: "Destaques", eixo: "xy", boxW: 382, align: "left" },
  destaque2Linha1: { label: "Mais treinos — 1ª linha", grupo: "Destaques", eixo: "xy", boxW: 382, align: "left" },
  destaque3Titulo: { label: "Maior pontuação — título", grupo: "Destaques", eixo: "xy", boxW: 411, align: "left" },
  destaque3Linha1: { label: "Maior pontuação — 1ª linha", grupo: "Destaques", eixo: "xy", boxW: 411, align: "left" },
};

/**
 * Ponto de partida medido pixel a pixel nas imagens informativo-fundo-*.png
 * (centro dos ícones, linhas e colunas da tabela, cards de destaque).
 */
export const INFORMATIVO_LAYOUT_PADRAO: Record<CampoId, CampoLayout> = {
  mesLabel: { x: 525, y: 137, fontSize: 15 },
  kpi1: { x: 831, y: 138.5, fontSize: 21 },
  kpi2: { x: 1051, y: 138, fontSize: 21 },
  kpi3: { x: 1266, y: 136, fontSize: 21 },
  kpi4: { x: 1517, y: 137.5, fontSize: 21 },

  podio2Pts: { x: 90, y: 448, fontSize: 12 },
  podio2Treinos: { x: 90, y: 494.5, fontSize: 12 },
  podio2Km: { x: 90, y: 539.5, fontSize: 12 },
  podio1Pts: { x: 274, y: 444.5, fontSize: 12 },
  podio1Treinos: { x: 274, y: 470.5, fontSize: 12 },
  podio1Km: { x: 274, y: 509.5, fontSize: 12 },
  podio3Pts: { x: 464, y: 471, fontSize: 12 },
  podio3Treinos: { x: 464, y: 508.5, fontSize: 12 },
  podio3Km: { x: 464, y: 550, fontSize: 12 },

  rankRow1: { x: 576, y: 259.5, fontSize: 9 },
  rankEsqNome: { x: 662, y: 259.5, fontSize: 9 },
  rankEsqPontos: { x: 857, y: 259.5, fontSize: 9 },
  rankEsqTreinos: { x: 930, y: 259.5, fontSize: 9 },
  rankEsqKm: { x: 1002, y: 259.5, fontSize: 9 },
  rankDirNome: { x: 1179, y: 259.5, fontSize: 9 },
  rankDirPontos: { x: 1402, y: 259.5, fontSize: 9 },
  rankDirTreinos: { x: 1480, y: 259.5, fontSize: 9 },
  rankDirKm: { x: 1558, y: 259.5, fontSize: 9 },

  destaque1Titulo: { x: 160, y: 753, fontSize: 11.5 },
  destaque1Linha1: { x: 160, y: 788, fontSize: 10 },
  destaque2Titulo: { x: 682, y: 753, fontSize: 11.5 },
  destaque2Linha1: { x: 682, y: 788, fontSize: 10 },
  destaque3Titulo: { x: 1225, y: 753, fontSize: 11.5 },
  destaque3Linha1: { x: 1225, y: 788, fontSize: 10 },
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
