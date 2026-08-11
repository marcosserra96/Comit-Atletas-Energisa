import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Modalidade } from "@/lib/types";
import type { ResumoAtletaMensal } from "@/lib/rankingMensal";
import {
  CAMPOS_INFO,
  type CampoId,
  RANKING_ROWS_POR_COLUNA,
  type LayoutInformativo,
} from "@/lib/informativoLayout";

const PAGE_W = 1672;
const PAGE_H = 941;
const BG = "#010a17";
const WHITE = "#ffffff";
const GOLD = "#eab308";
const SILVER = "#c4ccd6";
const BRONZE = "#f37021";

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
  return (
    <View style={caixa(l.y + offsetY, l.x, info.boxW, l.fontSize * 2)}>
      <Text
        style={{
          fontSize: l.fontSize,
          fontFamily: bold ? "Helvetica-Bold" : "Helvetica",
          color: cor,
          textAlign: info.align,
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
  colX: number;
  colW: number;
  nomeTop: number;
  nomeH: number;
  campos: [CampoId, CampoId, CampoId]; // pts, treinos, km
  cor: string;
}

// colX/colW/nomeTop/nomeH são estruturais (posição fixa dos cards no fundo);
// pontos/treinos/km vêm do layout configurável.
const PODIUM: Record<1 | 2 | 3, PodiumSlot> = {
  2: { colX: 18, colW: 172, nomeTop: 392, nomeH: 42, campos: ["podio2Pts", "podio2Treinos", "podio2Km"], cor: SILVER },
  1: { colX: 202, colW: 178, nomeTop: 380, nomeH: 40, campos: ["podio1Pts", "podio1Treinos", "podio1Km"], cor: GOLD },
  3: { colX: 395, colW: 170, nomeTop: 410, nomeH: 42, campos: ["podio3Pts", "podio3Treinos", "podio3Km"], cor: BRONZE },
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
    return <View style={abs(200, slot.colX - 4, slot.colW + 8, { height: 470, backgroundColor: BG })} />;
  }
  const dividerY = slot.nomeTop + slot.nomeH;
  const dividerW = 56;
  const [ptsCampo, treinosCampo, kmCampo] = slot.campos;
  return (
    <>
      <Text
        style={abs(slot.nomeTop, slot.colX, slot.colW, {
          height: slot.nomeH,
          fontSize: 12.5,
          fontFamily: "Helvetica-Bold",
          color: WHITE,
          textAlign: "center",
        })}
      >
        {atleta.nome}
      </Text>
      <View
        style={abs(dividerY, slot.colX + (slot.colW - dividerW) / 2, dividerW, {
          height: 1.6,
          backgroundColor: slot.cor,
        })}
      />
      <Campo campo={ptsCampo} layout={layout}>
        {formatarNumero(atleta.pontosMes)} pts
      </Campo>
      <Campo campo={treinosCampo} layout={layout}>
        {formatarNumero(atleta.treinosMes)} treinos
      </Campo>
      <Campo campo={kmCampo} layout={layout}>
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
  campos: { nome: CampoId; pontos: CampoId; treinos: CampoId; km: CampoId };
}

const RANKING_COLS: [RankingColSpec, RankingColSpec] = [
  {
    coverX: 578,
    coverW: 492,
    campos: { nome: "rankEsqNome", pontos: "rankEsqPontos", treinos: "rankEsqTreinos", km: "rankEsqKm" },
  },
  {
    coverX: 1094,
    coverW: 548,
    campos: { nome: "rankDirNome", pontos: "rankDirPontos", treinos: "rankDirTreinos", km: "rankDirKm" },
  },
];

function RankingColuna({
  lista,
  spec,
  layout,
}: {
  lista: ResumoAtletaMensal[];
  spec: RankingColSpec;
  layout: LayoutInformativo;
}) {
  const row1Y = layout.campos.rankRow1.y;
  const rowH = layout.extras.rankingRowHeight;
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
  const info = CAMPOS_INFO[linhaCampo];
  const gap = layout.extras.destaqueLinhaGap;
  return (
    <>
      <Campo campo={tituloCampo} layout={layout} uppercase>
        {titulo}
      </Campo>
      {lista.map((a, i) => (
        <View
          key={a.id}
          style={caixa(l.y + i * gap, l.x, info.boxW, l.fontSize * 2, {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          })}
        >
          <Text style={{ fontSize: l.fontSize, color: WHITE, width: info.boxW - 95 }}>
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

// Os rótulos ("PONTOS TOTAIS DO MÊS") são estruturais — ficam na posição fixa da caixa no fundo.
const KPI_LABELS: { x: number; w: number; campo: CampoId; texto: string }[] = [
  { x: 745, w: 210, campo: "kpi1", texto: "Pontos totais do mês" },
  { x: 975, w: 208, campo: "kpi2", texto: "Quantidade de treinos" },
  { x: 1197, w: 208, campo: "kpi3", texto: "KM acumulados" },
  { x: 1422, w: 238, campo: "kpi4", texto: "Atletas no ranking" },
];

// ---------- Página por modalidade ----------

function PaginaModalidade({
  fundo,
  dados,
  mesLabel,
  limite,
  layout,
}: {
  fundo: string;
  dados: ResumoAtletaMensal[];
  mesLabel: string;
  limite: number;
  layout: LayoutInformativo;
}) {
  const maxNaPagina = 3 + RANKING_ROWS_POR_COLUNA * 2;
  const lista = dados.slice(0, Math.min(limite, maxNaPagina));
  const totalPontos = lista.reduce((s, a) => s + a.pontosMes, 0);
  const totalTreinos = lista.reduce((s, a) => s + a.treinosMes, 0);
  const totalKm = lista.reduce((s, a) => s + a.kmMes, 0);

  const [primeiro, segundo, terceiro] = lista;
  const resto = lista.slice(3);
  const colEsquerda = resto.slice(0, RANKING_ROWS_POR_COLUNA);
  const colDireita = resto.slice(RANKING_ROWS_POR_COLUNA, RANKING_ROWS_POR_COLUNA * 2);

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
        <Text
          key={k.campo}
          style={abs(94, k.x, k.w, {
            fontSize: 8,
            fontFamily: "Helvetica-Bold",
            color: "#7fa8c9",
            textTransform: "uppercase",
          })}
        >
          {k.texto}
        </Text>
      ))}
      <Campo campo="kpi1" layout={layout}>{`${formatarNumero(totalPontos)} pts`}</Campo>
      <Campo campo="kpi2" layout={layout}>{formatarNumero(totalTreinos)}</Campo>
      <Campo campo="kpi3" layout={layout}>{`${formatarNumero(totalKm, 2)} km`}</Campo>
      <Campo campo="kpi4" layout={layout}>{formatarNumero(lista.length)}</Campo>

      <PodiumSlotView posicao={2} atleta={segundo} layout={layout} />
      <PodiumSlotView posicao={1} atleta={primeiro} layout={layout} />
      <PodiumSlotView posicao={3} atleta={terceiro} layout={layout} />

      <RankingColuna lista={colEsquerda} spec={RANKING_COLS[0]} layout={layout} />
      <RankingColuna lista={colDireita} spec={RANKING_COLS[1]} layout={layout} />

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
}: {
  bike: ResumoAtletaMensal[];
  corrida: ResumoAtletaMensal[];
  mesLabel: string;
  modalidadeFiltro: "todos" | Modalidade;
  limite: number;
  fundoBike: string;
  fundoCorrida: string;
  layout: LayoutInformativo;
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
        />
      )}
      {usarBike && (
        <PaginaModalidade fundo={fundoBike} dados={bike} mesLabel={mesFormatado} limite={limite} layout={layout} />
      )}
    </Document>
  );
}
