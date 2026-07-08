import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { AlertaCriterio, BrandingDoc, Modalidade } from "@/lib/types";
import { atletaEstaEmAlerta, type ResumoAtletaMensal } from "@/lib/rankingMensal";

const NAVY = "#07192d";
const BORDER = "#e2e8f0";
const TEXT = "#1a202c";
const TEXT_LIGHT = "#64748b";
const TEXT_MUTED = "#94a3b8";
const BG = "#f8fafc";
const GREEN = "#00b37e";
const ORANGE = "#f37021";

const ALERTA_LABEL: Record<AlertaCriterio, (valor: number) => string> = {
  sem_treino_mes: () => "sem treino no mês",
  sem_treino_30d: (v) => `sem treino há mais de ${v} dias`,
  ate_x_treinos: (v) => `até ${v} treino(s) no mês`,
  ate_x_pontos: (v) => `até ${v} ponto(s) no mês`,
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: TEXT,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
  },
  headerLogo: { width: 84, height: 28, objectFit: "contain" },
  headerTitleBlock: { flex: 1, marginLeft: 14 },
  headerTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: NAVY },
  headerSub: { fontSize: 8.5, color: TEXT_LIGHT, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: TEXT_MUTED,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  legendRow: { flexDirection: "row", gap: 14, marginBottom: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 7.5, color: TEXT_LIGHT },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 8,
    backgroundColor: BG,
  },
  kpiLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: TEXT_LIGHT, textTransform: "uppercase" },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: TEXT, marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 8,
  },
});

function PageHeader({ modalidadeLabel, mesLabel, diasUteis, logo }: {
  modalidadeLabel: string;
  mesLabel: string;
  diasUteis: number;
  logo?: string;
}) {
  return (
    <View style={styles.header} fixed>
      {logo ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é do @react-pdf/renderer, não um <img> HTML.
        <Image src={logo} style={styles.headerLogo} />
      ) : (
        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY }}>Atletas Energisa</Text>
      )}
      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerTitle}>Ranking de Pontos do Time de Atletas Energisa</Text>
        <Text style={styles.headerSub}>
          {modalidadeLabel} · {mesLabel} · {diasUteis} dias úteis
        </Text>
      </View>
    </View>
  );
}

function PageFooter({ dataHoje }: { dataHoje: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Informativo gerado pelo Portal Atletas Energisa</Text>
      <Text>{dataHoje}</Text>
    </View>
  );
}

function Legenda({ corPrimaria }: { corPrimaria: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
        <Text style={styles.legendText}>Top 3 do ranking</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: ORANGE }]} />
        <Text style={styles.legendText}>Atletas em alerta</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: corPrimaria }]} />
        <Text style={styles.legendText}>Demais atletas</Text>
      </View>
    </View>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function formatarNumero(valor: number, casas = 0) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function TabelaRanking({
  titulo,
  lista,
  opcoes,
}: {
  titulo: string;
  lista: ResumoAtletaMensal[];
  opcoes: { limite: number; mostrarTop3: boolean; mostrarAlertas: boolean; mostrarDemais: boolean; alertaCriterio: AlertaCriterio; alertaValor: number };
}) {
  const filtrada = lista
    .filter((a, idx) => {
      const ehTop3 = idx < 3;
      const ehAlerta = atletaEstaEmAlerta(a, opcoes.alertaCriterio, opcoes.alertaValor);
      if (ehTop3) return opcoes.mostrarTop3;
      if (ehAlerta) return opcoes.mostrarAlertas;
      return opcoes.mostrarDemais;
    })
    .slice(0, opcoes.limite);

  const colunas = [
    { chave: "pos", label: "#", largura: 0.4, alinhar: "center" as const },
    { chave: "nome", label: titulo, largura: 2.6 },
    { chave: "pontos", label: "Pontos", largura: 0.8, alinhar: "right" as const },
    { chave: "treinos", label: "Treinos", largura: 0.8, alinhar: "right" as const },
    { chave: "km", label: "KM", largura: 0.8, alinhar: "right" as const },
  ];

  return (
    <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
      <View style={{ flexDirection: "row", backgroundColor: NAVY }}>
        {colunas.map((c) => (
          <Text
            key={c.chave}
            style={{
              flex: c.largura,
              fontSize: 7,
              fontFamily: "Helvetica-Bold",
              color: "#fff",
              textTransform: "uppercase",
              padding: 6,
              textAlign: c.alinhar ?? "left",
            }}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {filtrada.length === 0 && (
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 8.5, color: TEXT_LIGHT, textAlign: "center" }}>
            Nenhum atleta encontrado para os filtros escolhidos.
          </Text>
        </View>
      )}
      {filtrada.map((a) => {
        const posicaoReal = lista.findIndex((item) => item.id === a.id) + 1;
        const emAlerta = atletaEstaEmAlerta(a, opcoes.alertaCriterio, opcoes.alertaValor);
        const cor = posicaoReal <= 3 ? GREEN : emAlerta ? ORANGE : undefined;
        return (
          <View
            key={a.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderTopWidth: 1,
              borderTopColor: BORDER,
              backgroundColor: cor ? `${cor}14` : "#fff",
              borderLeftWidth: cor ? 2.5 : 0,
              borderLeftColor: cor,
            }}
          >
            <Text style={{ flex: colunas[0].largura, fontSize: 8.5, padding: 6, textAlign: "center", fontFamily: "Helvetica-Bold" }}>
              {posicaoReal}
            </Text>
            <Text style={{ flex: colunas[1].largura, fontSize: 8.5, padding: 6 }}>{a.nome}</Text>
            <Text style={{ flex: colunas[2].largura, fontSize: 8.5, padding: 6, textAlign: "right" }}>
              {formatarNumero(a.pontosMes)}
            </Text>
            <Text style={{ flex: colunas[3].largura, fontSize: 8.5, padding: 6, textAlign: "right" }}>
              {formatarNumero(a.treinosMes)}
            </Text>
            <Text style={{ flex: colunas[4].largura, fontSize: 8.5, padding: 6, textAlign: "right" }}>
              {formatarNumero(a.kmMes, 1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ConteudoPagina({
  titulo,
  grupos,
  opcoes,
  branding,
}: {
  titulo: string;
  grupos: { titulo: string; dados: ResumoAtletaMensal[] }[];
  opcoes: {
    limite: number;
    mostrarKpis: boolean;
    mostrarLegenda: boolean;
    mostrarTop3: boolean;
    mostrarAlertas: boolean;
    mostrarDemais: boolean;
    alertaCriterio: AlertaCriterio;
    alertaValor: number;
  };
  branding: BrandingDoc;
}) {
  const todos = grupos.flatMap((g) => g.dados);
  const totalPontos = todos.reduce((s, a) => s + a.pontosMes, 0);
  const totalKm = todos.reduce((s, a) => s + a.kmMes, 0);
  const totalTreinos = todos.reduce((s, a) => s + a.treinosMes, 0);
  const totalAlertas = todos.filter((a) => atletaEstaEmAlerta(a, opcoes.alertaCriterio, opcoes.alertaValor)).length;

  return (
    <>
      {opcoes.mostrarLegenda && <Legenda corPrimaria={branding.primary} />}

      {opcoes.mostrarKpis && (
        <View style={styles.kpiRow}>
          <KpiCard label="Pontos totais" value={`${formatarNumero(totalPontos)} pts`} />
          <KpiCard label="KM acumulados" value={`${formatarNumero(totalKm, 1)} km`} />
          <KpiCard label="Treinos" value={formatarNumero(totalTreinos)} />
          <KpiCard label="Atletas no ranking" value={formatarNumero(todos.length)} />
          <KpiCard label="Em alerta" value={formatarNumero(totalAlertas)} />
        </View>
      )}

      <Text style={styles.sectionTitle}>{titulo}</Text>
      {grupos.map((g) => (
        <TabelaRanking key={g.titulo} titulo={g.titulo} lista={g.dados} opcoes={opcoes} />
      ))}
    </>
  );
}

export function InformativoRankingDocument({
  bike,
  corrida,
  mesLabel,
  diasUteis,
  modalidadeFiltro,
  paginasSeparadas,
  opcoes,
  branding,
  logo,
}: {
  bike: ResumoAtletaMensal[];
  corrida: ResumoAtletaMensal[];
  mesLabel: string;
  diasUteis: number;
  modalidadeFiltro: "todos" | Modalidade;
  paginasSeparadas: boolean;
  opcoes: {
    limite: number;
    mostrarKpis: boolean;
    mostrarLegenda: boolean;
    mostrarTop3: boolean;
    mostrarAlertas: boolean;
    mostrarDemais: boolean;
    alertaCriterio: AlertaCriterio;
    alertaValor: number;
  };
  branding: BrandingDoc;
  logo?: string;
}) {
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const alertaLabel = ALERTA_LABEL[opcoes.alertaCriterio](opcoes.alertaValor);

  const usarBike = modalidadeFiltro !== "corrida";
  const usarCorrida = modalidadeFiltro !== "bicicleta";
  const modalidadeLabel = usarBike && usarCorrida ? "Bike e Corrida" : usarBike ? "Bike" : "Corrida";

  const paginas: { titulo: string; label: string; grupos: { titulo: string; dados: ResumoAtletaMensal[] }[] }[] = [];
  if (paginasSeparadas && usarBike && usarCorrida) {
    paginas.push({ titulo: "RANKING DO MÊS - BIKE", label: "Bike", grupos: [{ titulo: "Bike", dados: bike }] });
    paginas.push({ titulo: "RANKING DO MÊS - CORRIDA", label: "Corrida", grupos: [{ titulo: "Corrida", dados: corrida }] });
  } else {
    const grupos = [];
    if (usarBike) grupos.push({ titulo: "Bike", dados: bike });
    if (usarCorrida) grupos.push({ titulo: "Corrida", dados: corrida });
    paginas.push({
      titulo: usarBike && usarCorrida ? "RANKING DO MÊS" : `RANKING DO MÊS - ${modalidadeLabel.toUpperCase()}`,
      label: modalidadeLabel,
      grupos,
    });
  }

  return (
    <Document title={`Informativo do Ranking - Atletas Energisa - ${dataHoje}`}>
      {paginas.map((pagina) => (
        <Page key={pagina.titulo} size="A4" style={styles.page}>
          <PageHeader modalidadeLabel={pagina.label} mesLabel={mesLabel} diasUteis={diasUteis} logo={logo} />
          <ConteudoPagina titulo={pagina.titulo} grupos={pagina.grupos} opcoes={opcoes} branding={branding} />
          <Text style={{ fontSize: 7, color: TEXT_MUTED, marginTop: 2 }}>
            Alerta por: {alertaLabel}.
          </Text>
          <PageFooter dataHoje={dataHoje} />
        </Page>
      ))}
    </Document>
  );
}
