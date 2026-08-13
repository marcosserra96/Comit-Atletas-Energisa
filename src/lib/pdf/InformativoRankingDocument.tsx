import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Modalidade } from "@/lib/types";
import type { ResumoAtletaMensal } from "@/lib/rankingMensal";
import {
  CAMPOS_INFO,
  COR_POSICAO,
  RANKING_ROWS_POR_COLUNA,
  type CampoId,
  type LayoutInformativo,
} from "@/lib/informativoLayout";

const PAGE_W = 1672;
const PAGE_H = 941;
const BG = "#010a17";
const WHITE = "#ffffff";

function formatarNumero(valor: number, casas = 0) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function abs(top: number, left: number, width: number, extra: object = {}) {
  return { position: "absolute" as const, top, left, width, ...extra };
}

/** Caixa com o conteúdo centralizado verticalmente em `centerY`. Mesma convenção do editor: x = borda esquerda, y = centro. */
function caixa(centerY: number, left: number, width: number, height: number, extra: object = {}) {
  return {
    position: "absolute" as const,
    top: centerY - height / 2,
    left,
    width,
    height,
    justifyContent: "center" as const,
    ...extra,
  };
}

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica" },
  bg: { position: "absolute", top: 0, left: 0, width: PAGE_W, height: PAGE_H },
});

/**
 * Renderiza um campo configurável. Posição, tamanho de fonte, largura da caixa e
 * alinhamento vêm todos de informativoLayout.ts — é o que garante que o editor
 * de layout e o PDF final mostrem exatamente a mesma coisa.
 */
function Campo({
  campo,
  layout,
  children,
  offsetY = 0,
  cor = WHITE,
  bold = true,
  uppercase = false,
}: {
  campo: CampoId;
  layout: LayoutInformativo;
  children: ReactNode;
  offsetY?: number;
  cor?: string;
  bold?: boolean;
  uppercase?: boolean;
}) {
  const l = layout.campos[campo];
  const info = CAMPOS_INFO[campo];
  // Sem quebra: prende numa linha e corta com reticências se não couber na largura.
  const limiteDeLinha = l.quebraLinha ? {} : { maxLines: 1, textOverflow: "ellipsis" as const };
  return (
    <View style={caixa(l.y + offsetY, l.x, l.boxW, l.fontSize * 2.4)}>
      <Text
        style={{
          fontSize: l.fontSize,
          fontFamily: bold ? "Helvetica-Bold" : "Helvetica",
          color: cor,
          textAlign: info.align,
          lineHeight: 1.15,
          ...limiteDeLinha,
          ...(uppercase ? { textTransform: "uppercase" as const } : {}),
        }}
      >
        {children}
      </Text>
    </View>
  );
}

// ---------- Pódio ----------

interface PodiumSlot {
  /** Área a cobrir com a cor do fundo quando não existe atleta pra essa posição (esconde o card inteiro). */
  coverX: number;
  coverW: number;
  campos: { nome: CampoId; pts: CampoId; treinos: CampoId; km: CampoId };
}

const PODIUM: Record<1 | 2 | 3, PodiumSlot> = {
  2: {
    coverX: 14,
    coverW: 180,
    campos: { nome: "podio2Nome", pts: "podio2Pts", treinos: "podio2Treinos", km: "podio2Km" },
  },
  1: {
    coverX: 198,
    coverW: 186,
    campos: { nome: "podio1Nome", pts: "podio1Pts", treinos: "podio1Treinos", km: "podio1Km" },
  },
  3: {
    coverX: 391,
    coverW: 178,
    campos: { nome: "podio3Nome", pts: "podio3Pts", treinos: "podio3Treinos", km: "podio3Km" },
  },
};

function PodiumSlotView({
  posicao,
  atleta,
  layout,
}: {
  posicao: 1 | 2 | 3;
  atleta: ResumoAtletaMensal | undefined;
  layout: LayoutInformativo;
}) {
  const slot = PODIUM[posicao];
  if (!atleta) {
    // cobre a coluna inteira (card + base) com a cor de fundo, já que não há atleta pra essa posição.
    return <View style={abs(200, slot.coverX, slot.coverW, { height: 470, backgroundColor: BG })} />;
  }
  return (
    <>
      <Campo campo={slot.campos.nome} layout={layout}>
        {atleta.nome}
      </Campo>
      <Campo campo={slot.campos.pts} layout={layout}>
        {formatarNumero(atleta.pontosMes)} pts
      </Campo>
      <Campo campo={slot.campos.treinos} layout={layout}>
        {formatarNumero(atleta.treinosMes)} treinos
      </Campo>
      <Campo campo={slot.campos.km} layout={layout}>
        {formatarNumero(atleta.kmMes, 2)} km
      </Campo>
    </>
  );
}

// ---------- Ranking geral (duas colunas de 19 linhas) ----------

interface RankingColSpec {
  /** Área a pintar de volta com a cor do fundo quando a linha não tem atleta (esconde o "20º" já impresso na arte). */
  coverX: number;
  coverW: number;
  /** Só a célula de posição — usada quando é preciso reescrever a colocação por cima da impressa. */
  posCoverX: number;
  posCoverW: number;
  /** Colocação que a arte já traz na 1ª linha desta coluna. */
  posicaoImpressa: number;
  campos: { posicao: CampoId; nome: CampoId; pontos: CampoId; treinos: CampoId; km: CampoId };
}

const RANKING_COLS: [RankingColSpec, RankingColSpec] = [
  {
    coverX: 578,
    coverW: 492,
    posCoverX: 578,
    posCoverW: 74,
    posicaoImpressa: 1,
    campos: {
      posicao: "rankEsqPos",
      nome: "rankEsqNome",
      pontos: "rankEsqPontos",
      treinos: "rankEsqTreinos",
      km: "rankEsqKm",
    },
  },
  {
    coverX: 1094,
    coverW: 548,
    posCoverX: 1094,
    posCoverW: 75,
    posicaoImpressa: 1 + RANKING_ROWS_POR_COLUNA,
    campos: {
      posicao: "rankDirPos",
      nome: "rankDirNome",
      pontos: "rankDirPontos",
      treinos: "rankDirTreinos",
      km: "rankDirKm",
    },
  },
];

function RankingColuna({
  lista,
  spec,
  layout,
  primeiraPosicao,
}: {
  lista: ResumoAtletaMensal[];
  spec: RankingColSpec;
  layout: LayoutInformativo;
  /** Colocação do primeiro item desta coluna. Quando não bate com o número já impresso na arte, redesenhamos a coluna de posição. */
  primeiraPosicao: number;
}) {
  const row1Y = layout.campos.rankRow1.y;
  const rowH = layout.extras.rankingRowHeight;
  const renumerar = primeiraPosicao !== spec.posicaoImpressa;
  return (
    <>
      {Array.from({ length: RANKING_ROWS_POR_COLUNA }, (_, i) => {
        const offsetY = i * rowH;
        const atleta = lista[i];
        if (!atleta) {
          return (
            <View
              key={i}
              style={abs(row1Y + offsetY - rowH / 2, spec.coverX, spec.coverW, {
                height: rowH,
                backgroundColor: BG,
              })}
            />
          );
        }
        return (
          <View key={i}>
            {renumerar && (
              <>
                {/* tampa só a célula de posição (sem encostar nas linhas divisórias) e escreve a colocação certa */}
                <View
                  style={abs(row1Y + offsetY - rowH / 2, spec.posCoverX, spec.posCoverW, {
                    height: rowH,
                    backgroundColor: BG,
                  })}
                />
                <Campo campo={spec.campos.posicao} layout={layout} offsetY={offsetY} cor={COR_POSICAO}>
                  {primeiraPosicao + i}º
                </Campo>
              </>
            )}
            <Campo campo={spec.campos.nome} layout={layout} offsetY={offsetY}>
              {atleta.nome}
            </Campo>
            <Campo campo={spec.campos.pontos} layout={layout} offsetY={offsetY} bold={false}>
              {formatarNumero(atleta.pontosMes)}
            </Campo>
            <Campo campo={spec.campos.treinos} layout={layout} offsetY={offsetY} bold={false}>
              {formatarNumero(atleta.treinosMes)}
            </Campo>
            <Campo campo={spec.campos.km} layout={layout} offsetY={offsetY} bold={false}>
              {formatarNumero(atleta.kmMes, 2)}
            </Campo>
          </View>
        );
      })}
    </>
  );
}

// ---------- Destaques do mês ----------

function DestaqueCard({
  tituloCampo,
  linhaCampo,
  titulo,
  lista,
  formatar,
  layout,
}: {
  tituloCampo: CampoId;
  linhaCampo: CampoId;
  titulo: string;
  lista: ResumoAtletaMensal[];
  formatar: (a: ResumoAtletaMensal) => string;
  layout: LayoutInformativo;
}) {
  const l = layout.campos[linhaCampo];
  const gap = layout.extras.destaqueLinhaGap;
  return (
    <>
      <Campo campo={tituloCampo} layout={layout} uppercase>
        {titulo}
      </Campo>
      {lista.map((a, i) => (
        <View
          key={a.id}
          style={caixa(l.y + i * gap, l.x, l.boxW, l.fontSize * 2.4, {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          })}
        >
          <Text
            style={{
              fontSize: l.fontSize,
              color: WHITE,
              width: l.boxW - 95,
              maxLines: 1,
              textOverflow: "ellipsis",
            }}
          >
            {i + 1}º {a.nome}
          </Text>
          <Text
            style={{
              fontSize: l.fontSize,
              fontFamily: "Helvetica-Bold",
              color: WHITE,
              width: 90,
              textAlign: "right",
            }}
          >
            {formatar(a)}
          </Text>
        </View>
      ))}
    </>
  );
}

// ---------- KPIs ----------

const KPI_LABELS: { rotulo: CampoId; valor: CampoId; texto: string }[] = [
  { rotulo: "kpi1Label", valor: "kpi1", texto: "Pontos totais do mês" },
  { rotulo: "kpi2Label", valor: "kpi2", texto: "Quantidade de treinos" },
  { rotulo: "kpi3Label", valor: "kpi3", texto: "KM acumulados" },
  { rotulo: "kpi4Label", valor: "kpi4", texto: "Atletas no ranking" },
];

// ---------- Página por modalidade ----------

function PaginaModalidade({
  fundo,
  dados,
  mesLabel,
  limite,
  layout,
  ocultarTop3,
}: {
  fundo: string;
  dados: ResumoAtletaMensal[];
  mesLabel: string;
  limite: number;
  layout: LayoutInformativo;
  ocultarTop3: boolean;
}) {
  // Os KPIs e os destaques consideram o time todo; o corte só afeta quantos entram na tabela.
  const lista = dados.slice(0, limite);
  const totalPontos = lista.reduce((s, a) => s + a.pontosMes, 0);
  const totalTreinos = lista.reduce((s, a) => s + a.treinosMes, 0);
  const totalKm = lista.reduce((s, a) => s + a.kmMes, 0);

  const [primeiro, segundo, terceiro] = lista;

  // Por padrão o pódio é destaque, não recorte: o top 3 aparece nele E como 1º/2º/3º
  // da tabela, que é como a numeração já impressa na arte fecha. Com "ocultarTop3"
  // a tabela começa no 4º e a coluna de posição é reescrita por cima da impressa.
  const primeiraPosicao = ocultarTop3 ? 4 : 1;
  const paraTabela = (ocultarTop3 ? lista.slice(3) : lista).slice(0, RANKING_ROWS_POR_COLUNA * 2);
  const colEsquerda = paraTabela.slice(0, RANKING_ROWS_POR_COLUNA);
  const colDireita = paraTabela.slice(RANKING_ROWS_POR_COLUNA, RANKING_ROWS_POR_COLUNA * 2);

  const maiorKm = [...lista].sort((a, b) => b.kmMes - a.kmMes).slice(0, 3);
  const maisTreinos = [...lista].sort((a, b) => b.treinosMes - a.treinosMes).slice(0, 3);
  const maiorPontuacao = lista.slice(0, 3);

  return (
    <Page size={{ width: PAGE_W, height: PAGE_H }} style={styles.page}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é do @react-pdf/renderer. */}
      <Image src={fundo} style={styles.bg} />

      <Campo campo="mesLabel" layout={layout} cor="#cfe3f2" bold={false}>
        {mesLabel}
      </Campo>

      {KPI_LABELS.map((k) => (
        <Campo key={k.rotulo} campo={k.rotulo} layout={layout} cor="#7fa8c9" uppercase>
          {k.texto}
        </Campo>
      ))}
      <Campo campo="kpi1" layout={layout}>{`${formatarNumero(totalPontos)} pts`}</Campo>
      <Campo campo="kpi2" layout={layout}>{formatarNumero(totalTreinos)}</Campo>
      <Campo campo="kpi3" layout={layout}>{`${formatarNumero(totalKm, 2)} km`}</Campo>
      <Campo campo="kpi4" layout={layout}>{formatarNumero(lista.length)}</Campo>

      <PodiumSlotView posicao={2} atleta={segundo} layout={layout} />
      <PodiumSlotView posicao={1} atleta={primeiro} layout={layout} />
      <PodiumSlotView posicao={3} atleta={terceiro} layout={layout} />

      <RankingColuna
        lista={colEsquerda}
        spec={RANKING_COLS[0]}
        layout={layout}
        primeiraPosicao={primeiraPosicao}
      />
      <RankingColuna
        lista={colDireita}
        spec={RANKING_COLS[1]}
        layout={layout}
        primeiraPosicao={primeiraPosicao + RANKING_ROWS_POR_COLUNA}
      />

      <DestaqueCard
        tituloCampo="destaque1Titulo"
        linhaCampo="destaque1Linha1"
        titulo="Maior quilometragem"
        lista={maiorKm}
        formatar={(a) => `${formatarNumero(a.kmMes, 2)} km`}
        layout={layout}
      />
      <DestaqueCard
        tituloCampo="destaque2Titulo"
        linhaCampo="destaque2Linha1"
        titulo="Mais treinos"
        lista={maisTreinos}
        formatar={(a) => `${formatarNumero(a.treinosMes)} treinos`}
        layout={layout}
      />
      <DestaqueCard
        tituloCampo="destaque3Titulo"
        linhaCampo="destaque3Linha1"
        titulo="Maior pontuação"
        lista={maiorPontuacao}
        formatar={(a) => `${formatarNumero(a.pontosMes)} pts`}
        layout={layout}
      />
    </Page>
  );
}

export function InformativoRankingDocument({
  bike,
  corrida,
  mesLabel,
  modalidadeFiltro,
  limite,
  fundoBike,
  fundoCorrida,
  layout,
  ocultarTop3,
}: {
  bike: ResumoAtletaMensal[];
  corrida: ResumoAtletaMensal[];
  mesLabel: string;
  modalidadeFiltro: "todos" | Modalidade;
  limite: number;
  fundoBike: string;
  fundoCorrida: string;
  layout: LayoutInformativo;
  ocultarTop3: boolean;
}) {
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const usarBike = modalidadeFiltro !== "corrida";
  const usarCorrida = modalidadeFiltro !== "bicicleta";
  const mesFormatado = mesLabel.replace(/^./, (c) => c.toUpperCase());

  return (
    <Document title={`Informativo do Ranking - Atletas Energisa - ${mesFormatado} (gerado em ${dataHoje})`}>
      {usarCorrida && (
        <PaginaModalidade
          fundo={fundoCorrida}
          dados={corrida}
          mesLabel={mesFormatado}
          limite={limite}
          layout={layout}
          ocultarTop3={ocultarTop3}
        />
      )}
      {usarBike && (
        <PaginaModalidade
          fundo={fundoBike}
          dados={bike}
          mesLabel={mesFormatado}
          limite={limite}
          layout={layout}
          ocultarTop3={ocultarTop3}
        />
      )}
    </Document>
  );
}
