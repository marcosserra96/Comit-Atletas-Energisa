import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Modalidade } from "@/lib/types";
import type { ResumoAtletaMensal } from "@/lib/rankingMensal";
import type { CampoId, CampoLayout } from "@/lib/informativoLayout";

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

/** Centraliza o texto verticalmente num ponto Y medido (ex: o centro real de um ícone), via flexbox — não depende de tentar adivinhar métricas de fonte. */
function centeredAt(centerY: number, left: number, width: number, height = 32, extra: object = {}) {
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

// ---------- Pódio ----------

interface PodiumSlot {
  colX: number;
  colW: number;
  nomeTop: number;
  nomeH: number;
  campos: [CampoId, CampoId, CampoId]; // pts, treinos, km
  cor: string;
}

// colX/colW/nomeTop/nomeH são estruturais (posição fixa dos cards no fundo); a posição
// de pontos/treinos/km vem do layout configurável (ver src/lib/informativoLayout.ts).
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
  layout: Record<CampoId, CampoLayout>;
}) {
  const slot = PODIUM[posicao];
  if (!atleta) {
    // cobre a coluna inteira (card + base) com a cor de fundo, já que não há atleta pra essa posição.
    return <View style={abs(200, slot.colX - 4, slot.colW + 8, { height: 470, backgroundColor: BG })} />;
  }
  const dividerY = slot.nomeTop + slot.nomeH;
  const dividerW = 56;
  const [ptsCampo, treinosCampo, kmCampo] = slot.campos;
  const ptsL = layout[ptsCampo];
  const treinosL = layout[treinosCampo];
  const kmL = layout[kmCampo];
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
      <View style={centeredAt(ptsL.y, ptsL.x, 90)}>
        <Text style={{ fontSize: ptsL.fontSize, fontFamily: "Helvetica-Bold", color: WHITE }}>
          {formatarNumero(atleta.pontosMes)} pts
        </Text>
      </View>
      <View style={centeredAt(treinosL.y, treinosL.x, 90)}>
        <Text style={{ fontSize: treinosL.fontSize, fontFamily: "Helvetica-Bold", color: WHITE }}>
          {formatarNumero(atleta.treinosMes)} treinos
        </Text>
      </View>
      <View style={centeredAt(kmL.y, kmL.x, 90)}>
        <Text style={{ fontSize: kmL.fontSize, fontFamily: "Helvetica-Bold", color: WHITE }}>
          {formatarNumero(atleta.kmMes, 2)} km
        </Text>
      </View>
    </>
  );
}

// ---------- Ranking geral (duas colunas) ----------

const RANKING_ROW1_Y = 251;
const RANKING_ROW_H = 23.15;
const RANKING_ROWS_POR_COLUNA = 19;

interface RankingColSpec {
  posX: number;
  nomeX: number;
  nomeW: number;
  pontosX: number;
  treinosX: number;
  kmX: number;
  colX: number;
  colW: number;
}

const RANKING_COLS: [RankingColSpec, RankingColSpec] = [
  { colX: 578, colW: 497, posX: 578, nomeX: 672, nomeW: 188, pontosX: 862, treinosX: 927, kmX: 1006 },
  { colX: 1097, colW: 563, posX: 1097, nomeX: 1198, nomeW: 190, pontosX: 1390, treinosX: 1455, kmX: 1540 },
];

function RankingColuna({ lista, offset, spec }: { lista: ResumoAtletaMensal[]; offset: number; spec: RankingColSpec }) {
  return (
    <>
      {Array.from({ length: RANKING_ROWS_POR_COLUNA }, (_, i) => {
        const y = RANKING_ROW1_Y + i * RANKING_ROW_H;
        const atleta = lista[i];
        if (!atleta) {
          return <View key={i} style={abs(y - 2, spec.colX, spec.colW, { height: RANKING_ROW_H, backgroundColor: BG })} />;
        }
        return (
          <View key={i}>
            <Text style={abs(y, spec.nomeX, spec.nomeW, { fontSize: 9, fontFamily: "Helvetica-Bold", color: WHITE })}>
              {atleta.nome}
            </Text>
            <Text style={abs(y, spec.pontosX, 55, { fontSize: 9, color: WHITE, textAlign: "center" })}>
              {formatarNumero(atleta.pontosMes)}
            </Text>
            <Text style={abs(y, spec.treinosX, 65, { fontSize: 9, color: WHITE, textAlign: "center" })}>
              {formatarNumero(atleta.treinosMes)}
            </Text>
            <Text style={abs(y, spec.kmX, 70, { fontSize: 9, color: WHITE, textAlign: "center" })}>
              {formatarNumero(atleta.kmMes, 2)}
            </Text>
          </View>
        );
      })}
      {/* posição "offset+i+1" já vem impressa no fundo — cobre as sobrando quando a lista é menor que 19 */}
    </>
  );
}

// ---------- Destaques do mês ----------

interface DestaqueSpec {
  x: number;
  w: number;
  tituloY: number;
  linha1Y: number;
  linhaGap: number;
}

const DESTAQUES: [DestaqueSpec, DestaqueSpec, DestaqueSpec] = [
  { x: 155, w: 350, tituloY: 745, linha1Y: 781, linhaGap: 30 },
  { x: 682, w: 372, tituloY: 745, linha1Y: 781, linhaGap: 30 },
  { x: 1207, w: 435, tituloY: 745, linha1Y: 781, linhaGap: 30 },
];

function DestaqueCard({
  spec,
  titulo,
  lista,
  formatar,
}: {
  spec: DestaqueSpec;
  titulo: string;
  lista: ResumoAtletaMensal[];
  formatar: (a: ResumoAtletaMensal) => string;
}) {
  return (
    <>
      <Text style={abs(spec.tituloY, spec.x, spec.w, { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: WHITE, textTransform: "uppercase" })}>
        {titulo}
      </Text>
      {lista.map((a, i) => (
        <View key={a.id} style={abs(spec.linha1Y + i * spec.linhaGap, spec.x, spec.w, { flexDirection: "row", justifyContent: "space-between" })}>
          <Text style={{ fontSize: 10, color: WHITE, width: spec.w - 90 }}>
            {i + 1}º {a.nome}
          </Text>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: WHITE, width: 80, textAlign: "right" }}>
            {formatar(a)}
          </Text>
        </View>
      ))}
    </>
  );
}

// ---------- KPIs ----------

interface KpiSpec {
  labelX: number;
  labelW: number;
  campo: CampoId;
  valueW: number;
}

// labelX/labelW são estruturais (posição fixa das caixas no fundo); a posição do valor vem do layout configurável.
const KPIS: [KpiSpec, KpiSpec, KpiSpec, KpiSpec] = [
  { labelX: 745, labelW: 210, campo: "kpi1", valueW: 138 },
  { labelX: 975, labelW: 208, campo: "kpi2", valueW: 138 },
  { labelX: 1197, labelW: 208, campo: "kpi3", valueW: 138 },
  { labelX: 1422, labelW: 238, campo: "kpi4", valueW: 158 },
];

function KpiOverlay({
  spec,
  label,
  value,
  layout,
}: {
  spec: KpiSpec;
  label: string;
  value: string;
  layout: Record<CampoId, CampoLayout>;
}) {
  const l = layout[spec.campo];
  return (
    <>
      <Text style={abs(94, spec.labelX, spec.labelW, { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#7fa8c9", textTransform: "uppercase" })}>
        {label}
      </Text>
      <View style={centeredAt(l.y, l.x, spec.valueW, 30)}>
        <Text style={{ fontSize: l.fontSize, fontFamily: "Helvetica-Bold", color: WHITE }}>{value}</Text>
      </View>
    </>
  );
}

// ---------- Página por modalidade ----------

function PaginaModalidade({
  fundo,
  modalidade,
  dados,
  mesLabel,
  limite,
  layout,
}: {
  fundo: string;
  modalidade: Modalidade;
  dados: ResumoAtletaMensal[];
  mesLabel: string;
  limite: number;
  layout: Record<CampoId, CampoLayout>;
}) {
  const lista = dados.slice(0, Math.max(limite, 41));
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

      <View style={centeredAt(layout.mesLabel.y, layout.mesLabel.x, 260, 20)}>
        <Text style={{ fontSize: layout.mesLabel.fontSize, color: "#cfe3f2" }}>{mesLabel}</Text>
      </View>

      <KpiOverlay spec={KPIS[0]} label="Pontos totais do mês" value={`${formatarNumero(totalPontos)} pts`} layout={layout} />
      <KpiOverlay spec={KPIS[1]} label="Quantidade de treinos" value={formatarNumero(totalTreinos)} layout={layout} />
      <KpiOverlay spec={KPIS[2]} label="KM acumulados" value={`${formatarNumero(totalKm, 2)} km`} layout={layout} />
      <KpiOverlay spec={KPIS[3]} label="Atletas no ranking" value={formatarNumero(lista.length)} layout={layout} />

      <PodiumSlotView posicao={2} atleta={segundo} layout={layout} />
      <PodiumSlotView posicao={1} atleta={primeiro} layout={layout} />
      <PodiumSlotView posicao={3} atleta={terceiro} layout={layout} />

      <RankingColuna lista={colEsquerda} offset={3} spec={RANKING_COLS[0]} />
      <RankingColuna lista={colDireita} offset={3 + RANKING_ROWS_POR_COLUNA} spec={RANKING_COLS[1]} />

      <DestaqueCard
        spec={DESTAQUES[0]}
        titulo="Maior quilometragem"
        lista={maiorKm}
        formatar={(a) => `${formatarNumero(a.kmMes, 2)} km`}
      />
      <DestaqueCard
        spec={DESTAQUES[1]}
        titulo="Mais treinos"
        lista={maisTreinos}
        formatar={(a) => `${formatarNumero(a.treinosMes)} treinos`}
      />
      <DestaqueCard
        spec={DESTAQUES[2]}
        titulo="Maior pontuação"
        lista={maiorPontuacao}
        formatar={(a) => `${formatarNumero(a.pontosMes)} pts`}
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
  layout: Record<CampoId, CampoLayout>;
}) {
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const usarBike = modalidadeFiltro !== "corrida";
  const usarCorrida = modalidadeFiltro !== "bicicleta";
  const mesFormatado = mesLabel.replace(/^./, (c) => c.toUpperCase());

  return (
    <Document title={`Informativo do Ranking - Atletas Energisa - ${dataHoje}`}>
      {usarCorrida && (
        <PaginaModalidade
          fundo={fundoCorrida}
          modalidade="corrida"
          dados={corrida}
          mesLabel={mesFormatado}
          limite={limite}
          layout={layout}
        />
      )}
      {usarBike && (
        <PaginaModalidade
          fundo={fundoBike}
          modalidade="bicicleta"
          dados={bike}
          mesLabel={mesFormatado}
          limite={limite}
          layout={layout}
        />
      )}
    </Document>
  );
}
