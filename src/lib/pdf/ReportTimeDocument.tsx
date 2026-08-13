import { Document, Page, View, Text, Image, Svg, Circle, Rect, StyleSheet } from "@react-pdf/renderer";
import type { Modalidade, BrandingDoc, AlertaCriterio } from "@/lib/types";
import { atletaEstaEmAlerta, type ResumoAtletaMensal } from "@/lib/rankingMensal";

/* ═══════════════════════════════════════════════════════════
   Report por Time — Estilo Painel Esportivo (fundo escuro)
   Gera uma página por modalidade no estilo da imagem de referência.
   ═══════════════════════════════════════════════════════════ */

const NAVY = "#07192d";
const NAVY_LIGHT = "#0e2a47";
const PANEL_BG = "#0a1929";
const CARD_BG = "#112240";
const BORDER = "#1e3a5f";
const TEXT_W = "#e8eaf0";
const TEXT_DIM = "#8899b0";
const GOLD = "#eab308";
const GOLD_BG = "#3d3000";
const SILVER = "#94a3b8";
const SILVER_BG = "#2a3040";
const BRONZE = "#f37021";
const BRONZE_BG = "#3d2010";
const GREEN = "#00b37e";
const BLUE = "#009bc1";
const ORANGE = "#f37021";

const s = StyleSheet.create({
  page: {
    backgroundColor: PANEL_BG,
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 24,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: TEXT_W,
  },
  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: BORDER,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerLogo: { width: 70, height: 24, objectFit: "contain" },
  headerTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: TEXT_W },
  headerSub: { fontSize: 7.5, color: TEXT_DIM, marginTop: 1 },
  headerModality: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  /* ── KPI Strip ── */
  kpiRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 5,
    padding: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  kpiLabel: { fontSize: 5.5, fontFamily: "Helvetica-Bold", color: TEXT_DIM, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  kpiUnit: { fontSize: 7, color: TEXT_DIM, marginTop: 1 },
  /* ── Sections ── */
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: TEXT_DIM,
    marginBottom: 6,
    marginTop: 8,
  },
  /* ── Podium ── */
  podiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  podiumItem: {
    alignItems: "center",
    borderRadius: 5,
    padding: 6,
    paddingTop: 10,
    borderWidth: 1,
  },
  podiumPosition: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  podiumName: { fontSize: 7, fontFamily: "Helvetica-Bold", color: TEXT_W, textAlign: "center", maxWidth: 90 },
  podiumStats: { flexDirection: "row", gap: 6, marginTop: 3 },
  podiumStat: { fontSize: 6, color: TEXT_DIM, textAlign: "center" },
  podiumStatValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXT_W },
  /* ── Ranking Table ── */
  tableHeader: {
    flexDirection: "row",
    backgroundColor: NAVY_LIGHT,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  tableCell: { padding: 4, fontSize: 7 },
  /* ── Footer ── */
  footer: {
    position: "absolute",
    bottom: 10,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6,
    color: TEXT_DIM,
  },
  /* ── Destaques ── */
  destaquesRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  destaqueCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 5,
    padding: 7,
    borderWidth: 1,
    borderColor: BORDER,
  },
  destaqueTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 },
  destaqueItem: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2.5 },
  destaquePos: { fontSize: 6, fontFamily: "Helvetica-Bold", width: 14 },
  destaqueName: { fontSize: 6.5, flex: 1, color: TEXT_W },
  destaqueValue: { fontSize: 6.5, fontFamily: "Helvetica-Bold", textAlign: "right" },
});

function fmt(v: number, decimals = 0) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function TeamPage({
  lista,
  modalidade,
  mesLabel,
  diasUteis,
  branding,
  logo,
  alertaCriterio,
  alertaValor,
}: {
  lista: ResumoAtletaMensal[];
  modalidade: Modalidade;
  mesLabel: string;
  diasUteis: number;
  branding: BrandingDoc;
  logo?: string;
  alertaCriterio: AlertaCriterio;
  alertaValor: number;
}) {
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const cor = modalidade === "corrida" ? GREEN : BLUE;
  const modalidadeLabel = modalidade === "corrida" ? "Corrida" : "Bicicleta";
  const modalidadeIcon = modalidade === "corrida" ? "🏃" : "🚴";

  const totalPontos = lista.reduce((s, a) => s + a.pontosMes, 0);
  const totalTreinos = lista.reduce((s, a) => s + a.treinosMes, 0);
  const totalKm = lista.reduce((s, a) => s + a.kmMes, 0);
  const totalAtletas = lista.length;

  const top3 = lista.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  // Destaques: maior KM, mais treinos, maior pontuação
  const porKm = [...lista].sort((a, b) => b.kmMes - a.kmMes).slice(0, 3);
  const porTreinos = [...lista].sort((a, b) => b.treinosMes - a.treinosMes).slice(0, 3);
  const porPontos = lista.slice(0, 3); // já ordenado por pontos

  // Tabela: split em 2 colunas para caber mais atletas
  const metade = Math.ceil(lista.length / 2);
  const colEsquerda = lista.slice(0, metade);
  const colDireita = lista.slice(metade);

  const medalColors = [
    { bg: GOLD_BG, border: GOLD, text: GOLD },
    { bg: SILVER_BG, border: SILVER, text: SILVER },
    { bg: BRONZE_BG, border: BRONZE, text: BRONZE },
  ];

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image, not HTML img
            <Image src={logo} style={s.headerLogo} />
          ) : (
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>ATLETAS ENERGISA</Text>
          )}
          <View>
            <Text style={s.headerTitle}>RANKING DE PONTOS DO TIME DE ATLETAS ENERGISA</Text>
            <Text style={s.headerSub}>
              Time de {modalidadeLabel} | {mesLabel}
            </Text>
          </View>
        </View>
        <Text style={[s.headerModality, { color: cor }]}>
          {modalidadeLabel.toUpperCase()} {modalidadeIcon}
        </Text>
      </View>

      {/* KPI Strip */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Pontos Totais do Mês</Text>
          <Text style={[s.kpiValue, { color: cor }]}>{fmt(totalPontos)}</Text>
          <Text style={s.kpiUnit}>pts</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Quantidade de Treinos</Text>
          <Text style={[s.kpiValue, { color: cor }]}>{fmt(totalTreinos)}</Text>
          <Text style={s.kpiUnit}>treinos</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>KM Acumulados</Text>
          <Text style={[s.kpiValue, { color: cor }]}>{fmt(totalKm, 2)}</Text>
          <Text style={s.kpiUnit}>km</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Atletas no Ranking</Text>
          <Text style={[s.kpiValue, { color: cor }]}>{fmt(totalAtletas)}</Text>
          <Text style={s.kpiUnit}>atletas</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {/* Left Side: Podium + Destaques */}
        <View style={{ width: 240 }}>
          <Text style={s.sectionTitle}>Pódio do Mês</Text>
          <View style={s.podiumRow}>
            {podiumOrder.map((a, visualIdx) => {
              const realIdx = top3.indexOf(a);
              const medal = medalColors[realIdx];
              const heights = [70, 85, 60]; // 2nd, 1st, 3rd visual heights
              return (
                <View
                  key={a.id}
                  style={[
                    s.podiumItem,
                    {
                      width: 72,
                      minHeight: heights[visualIdx],
                      backgroundColor: medal.bg,
                      borderColor: medal.border,
                    },
                  ]}
                >
                  <View style={[s.podiumPosition, { backgroundColor: medal.border }]}>
                    <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY }}>{realIdx + 1}</Text>
                  </View>
                  <Text style={s.podiumName}>{a.nome}</Text>
                  <View style={s.podiumStats}>
                    <View style={{ alignItems: "center" }}>
                      <Text style={s.podiumStatValue}>{a.pontosMes}</Text>
                      <Text style={s.podiumStat}>pts</Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                      <Text style={s.podiumStatValue}>{a.treinosMes}</Text>
                      <Text style={s.podiumStat}>treinos</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 5.5, color: TEXT_DIM, marginTop: 2 }}>
                    {fmt(a.kmMes, 2)} km
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Destaques do Mês */}
          <Text style={s.sectionTitle}>Destaques do Mês</Text>
          <View style={s.destaquesRow}>
            <View style={s.destaqueCard}>
              <Text style={[s.destaqueTitle, { color: cor }]}>Maior Quilometragem</Text>
              {porKm.map((a, i) => (
                <View key={a.id} style={s.destaqueItem}>
                  <Text style={[s.destaquePos, { color: medalColors[i]?.text ?? TEXT_DIM }]}>{i + 1}º</Text>
                  <Text style={s.destaqueName}>{a.nome}</Text>
                  <Text style={s.destaqueValue}>{fmt(a.kmMes, 2)} km</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[s.destaquesRow, { marginTop: 4 }]}>
            <View style={s.destaqueCard}>
              <Text style={[s.destaqueTitle, { color: cor }]}>Mais Treinos</Text>
              {porTreinos.map((a, i) => (
                <View key={a.id} style={s.destaqueItem}>
                  <Text style={[s.destaquePos, { color: medalColors[i]?.text ?? TEXT_DIM }]}>{i + 1}º</Text>
                  <Text style={s.destaqueName}>{a.nome}</Text>
                  <Text style={s.destaqueValue}>{a.treinosMes} treinos</Text>
                </View>
              ))}
            </View>
            <View style={s.destaqueCard}>
              <Text style={[s.destaqueTitle, { color: cor }]}>Maior Pontuação</Text>
              {porPontos.map((a, i) => (
                <View key={a.id} style={s.destaqueItem}>
                  <Text style={[s.destaquePos, { color: medalColors[i]?.text ?? TEXT_DIM }]}>{i + 1}º</Text>
                  <Text style={s.destaqueName}>{a.nome}</Text>
                  <Text style={s.destaqueValue}>{a.pontosMes} pts</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Right Side: Full Ranking Table (2-column layout) */}
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>Ranking Geral</Text>
          <View style={{ flexDirection: "row", gap: 3 }}>
            {/* Left table column */}
            <View style={{ flex: 1 }}>
              <View style={s.tableHeader}>
                <Text style={[s.tableCell, { width: 26, textAlign: "center", fontSize: 6, fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>POS</Text>
                <Text style={[s.tableCell, { flex: 1, fontSize: 6, fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>ATLETA</Text>
                <Text style={[s.tableCell, { width: 36, textAlign: "right", fontSize: 6, fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>PTS</Text>
                <Text style={[s.tableCell, { width: 36, textAlign: "right", fontSize: 6, fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>TREINOS</Text>
                <Text style={[s.tableCell, { width: 42, textAlign: "right", fontSize: 6, fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>KM</Text>
              </View>
              {colEsquerda.map((a, i) => {
                const pos = i + 1;
                const isTop3 = pos <= 3;
                const emAlerta = atletaEstaEmAlerta(a, alertaCriterio, alertaValor);
                const rowBg = isTop3 ? `${medalColors[pos - 1].bg}` : emAlerta ? "#3d1515" : i % 2 === 0 ? CARD_BG : PANEL_BG;
                const leftBorder = isTop3 ? medalColors[pos - 1].border : emAlerta ? ORANGE : "transparent";
                return (
                  <View key={a.id} style={[s.tableRow, { backgroundColor: rowBg, borderLeftWidth: 2, borderLeftColor: leftBorder }]}>
                    <Text style={[s.tableCell, { width: 26, textAlign: "center", fontFamily: "Helvetica-Bold", color: isTop3 ? medalColors[pos - 1].text : TEXT_W }]}>
                      {pos}º
                    </Text>
                    <Text style={[s.tableCell, { flex: 1, color: TEXT_W }]}>{a.nome}</Text>
                    <Text style={[s.tableCell, { width: 36, textAlign: "right", fontFamily: "Helvetica-Bold", color: TEXT_W }]}>{a.pontosMes}</Text>
                    <Text style={[s.tableCell, { width: 36, textAlign: "right", color: TEXT_DIM }]}>{a.treinosMes}</Text>
                    <Text style={[s.tableCell, { width: 42, textAlign: "right", color: TEXT_DIM }]}>{fmt(a.kmMes, 2)}</Text>
                  </View>
                );
              })}
            </View>
            {/* Right table column */}
            {colDireita.length > 0 && (
              <View style={{ flex: 1 }}>
                <View style={s.tableHeader}>
                  <Text style={[s.tableCell, { width: 26, textAlign: "center", fontSize: 6, fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>POS</Text>
                  <Text style={[s.tableCell, { flex: 1, fontSize: 6, fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>ATLETA</Text>
                  <Text style={[s.tableCell, { width: 36, textAlign: "right", fontSize: 6, fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>PTS</Text>
                  <Text style={[s.tableCell, { width: 36, textAlign: "right", fontSize: 6, fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>TREINOS</Text>
                  <Text style={[s.tableCell, { width: 42, textAlign: "right", fontSize: 6, fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>KM</Text>
                </View>
                {colDireita.map((a, i) => {
                  const pos = metade + i + 1;
                  const emAlerta = atletaEstaEmAlerta(a, alertaCriterio, alertaValor);
                  const rowBg = emAlerta ? "#3d1515" : i % 2 === 0 ? CARD_BG : PANEL_BG;
                  const leftBorder = emAlerta ? ORANGE : "transparent";
                  return (
                    <View key={a.id} style={[s.tableRow, { backgroundColor: rowBg, borderLeftWidth: 2, borderLeftColor: leftBorder }]}>
                      <Text style={[s.tableCell, { width: 26, textAlign: "center", fontFamily: "Helvetica-Bold", color: TEXT_DIM }]}>
                        {pos}º
                      </Text>
                      <Text style={[s.tableCell, { flex: 1, color: TEXT_W }]}>{a.nome}</Text>
                      <Text style={[s.tableCell, { width: 36, textAlign: "right", fontFamily: "Helvetica-Bold", color: TEXT_W }]}>{a.pontosMes}</Text>
                      <Text style={[s.tableCell, { width: 36, textAlign: "right", color: TEXT_DIM }]}>{a.treinosMes}</Text>
                      <Text style={[s.tableCell, { width: 42, textAlign: "right", color: TEXT_DIM }]}>{fmt(a.kmMes, 2)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer} fixed>
        <Text>Comitê de Atletas Energisa · Report por Time</Text>
        <Text>Gerado em {dataHoje}</Text>
      </View>
    </Page>
  );
}

export function ReportTimeDocument({
  bike,
  corrida,
  mesLabel,
  diasUteis,
  branding,
  logo,
  alertaCriterio,
  alertaValor,
}: {
  bike: ResumoAtletaMensal[];
  corrida: ResumoAtletaMensal[];
  mesLabel: string;
  diasUteis: number;
  branding: BrandingDoc;
  logo?: string;
  alertaCriterio: AlertaCriterio;
  alertaValor: number;
}) {
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  return (
    <Document title={`Report por Time - Atletas Energisa - ${dataHoje}`}>
      {corrida.length > 0 && (
        <TeamPage
          lista={corrida}
          modalidade="corrida"
          mesLabel={mesLabel}
          diasUteis={diasUteis}
          branding={branding}
          logo={logo}
          alertaCriterio={alertaCriterio}
          alertaValor={alertaValor}
        />
      )}
      {bike.length > 0 && (
        <TeamPage
          lista={bike}
          modalidade="bicicleta"
          mesLabel={mesLabel}
          diasUteis={diasUteis}
          branding={branding}
          logo={logo}
          alertaCriterio={alertaCriterio}
          alertaValor={alertaValor}
        />
      )}
    </Document>
  );
}
