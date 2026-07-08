import { Document, Page, View, Text, Image, Svg, Circle, Rect, StyleSheet } from "@react-pdf/renderer";
import type { EventoDoc } from "@/lib/types";
import type { EstatisticasDashboard, LoteResumo } from "@/lib/dashboardStats";
import type { BrandingDoc } from "@/lib/types";
import { formatShortDate } from "@/lib/format";

const NAVY = "#07192d";
const BORDER = "#e2e8f0";
const TEXT = "#1a202c";
const TEXT_LIGHT = "#64748b";
const TEXT_MUTED = "#94a3b8";
const BG = "#f8fafc";

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
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
  },
  headerLogo: { width: 84, height: 28, objectFit: "contain" },
  headerTitleBlock: { flex: 1, marginLeft: 14 },
  headerTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: NAVY },
  headerSub: { fontSize: 8.5, color: TEXT_LIGHT, marginTop: 2 },
  headerBadge: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    backgroundColor: NAVY,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 7,
    marginTop: 2,
  },
  section: { marginBottom: 14 },
  row: { flexDirection: "row" },
  bulletItem: { flexDirection: "row", marginBottom: 5, alignItems: "flex-start" },
  bulletText: { fontSize: 9, color: TEXT, flex: 1, lineHeight: 1.35 },
});

function PageHeader({ titulo, subtitulo, logo }: { titulo: string; subtitulo: string; logo?: string }) {
  return (
    <View style={styles.header} fixed>
      {logo ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- Image aqui é do @react-pdf/renderer, não um <img> HTML.
        <Image src={logo} style={styles.headerLogo} />
      ) : (
        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY }}>Atletas Energisa</Text>
      )}
      <View style={styles.headerTitleBlock}>
        <Text style={styles.headerTitle}>{titulo}</Text>
        <Text style={styles.headerSub}>{subtitulo}</Text>
      </View>
      <Text style={styles.headerBadge}>Energisa · Comitê de Atletas</Text>
    </View>
  );
}

function PageFooter({ pagina, dataHoje }: { pagina: number; dataHoje: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Comitê de Atletas Energisa · Report Oficial {new Date().getFullYear()}</Text>
      <Text>
        Gerado em {dataHoje} · Página {pagina} de 4
      </Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function BulletList({ itens, cor }: { itens: string[]; cor: string }) {
  return (
    <View>
      {itens.map((item, i) => (
        <View key={i} style={styles.bulletItem}>
          <View
            style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: cor, marginRight: 7, marginTop: 3.5 }}
          />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function KpiCard({ label, value, cor }: { label: string; value: string; cor: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 110,
        borderWidth: 1,
        borderColor: BORDER,
        borderLeftWidth: 3,
        borderLeftColor: cor,
        borderRadius: 4,
        padding: 8,
        backgroundColor: BG,
      }}
    >
      <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: TEXT_LIGHT, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: TEXT, marginTop: 3 }}>{value}</Text>
    </View>
  );
}

function EngagementRing({ pct, cor }: { pct: number; cor: string }) {
  const r = 34;
  const cx = 40;
  const cy = 40;
  const circumference = 2 * Math.PI * r;
  const preenchido = (Math.min(100, Math.max(0, pct)) / 100) * circumference;
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80">
      <Circle cx={cx} cy={cy} r={r} stroke={BORDER} strokeWidth={8} fill="none" />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={cor}
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${preenchido} ${circumference}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  );
}

function BarChart({ serie, cor }: { serie: { label: string; count: number }[]; cor: string }) {
  const largura = 470;
  const altura = 90;
  const gap = 8;
  const larguraBarra = (largura - gap * (serie.length - 1)) / serie.length;
  const max = Math.max(1, ...serie.map((s) => s.count));
  return (
    <Svg width={largura} height={altura + 14} viewBox={`0 0 ${largura} ${altura + 14}`}>
      {serie.map((s, i) => {
        const h = Math.max(2, (s.count / max) * altura);
        const x = i * (larguraBarra + gap);
        return (
          <Rect
            key={s.label}
            x={x}
            y={altura - h}
            width={larguraBarra}
            height={h}
            rx={2}
            fill={s.count > 0 ? cor : BORDER}
          />
        );
      })}
    </Svg>
  );
}

function Tabela({
  colunas,
  linhas,
}: {
  colunas: { chave: string; label: string; largura?: number; alinhar?: "left" | "right" | "center" }[];
  linhas: Record<string, string>[];
}) {
  return (
    <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", backgroundColor: NAVY }}>
        {colunas.map((c) => (
          <Text
            key={c.chave}
            style={{
              flex: c.largura ?? 1,
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
      {linhas.map((linha, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            backgroundColor: i % 2 === 0 ? "#fff" : BG,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: BORDER,
          }}
        >
          {colunas.map((c) => (
            <Text
              key={c.chave}
              style={{
                flex: c.largura ?? 1,
                fontSize: 8,
                color: TEXT,
                padding: 6,
                textAlign: c.alinhar ?? "left",
              }}
            >
              {linha[c.chave] ?? "—"}
            </Text>
          ))}
        </View>
      ))}
      {linhas.length === 0 && (
        <Text style={{ fontSize: 8, color: TEXT_MUTED, padding: 10, textAlign: "center" }}>Sem dados no período.</Text>
      )}
    </View>
  );
}

function Podio({ titulo, atletas, cor }: { titulo: string; atletas: { nome: string; pontuacaoTotal: number }[]; cor: string }) {
  const medalhas = ["#eab308", "#94a3b8", "#f37021"];
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXT_LIGHT, marginBottom: 5 }}>{titulo}</Text>
      {atletas.length === 0 ? (
        <Text style={{ fontSize: 8, color: TEXT_MUTED }}>Sem dados ainda.</Text>
      ) : (
        atletas.map((a, i) => (
          <View
            key={a.nome + i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: BORDER,
              borderRadius: 4,
              padding: 5,
              marginBottom: 4,
              backgroundColor: BG,
            }}
          >
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: medalhas[i],
                alignItems: "center",
                justifyContent: "center",
                marginRight: 6,
              }}
            >
              <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#fff" }}>{i + 1}</Text>
            </View>
            <Text style={{ fontSize: 8.5, flex: 1, color: TEXT }}>{a.nome}</Text>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: cor }}>{a.pontuacaoTotal} pts</Text>
          </View>
        ))
      )}
    </View>
  );
}

function ModalidadeResumo({
  titulo,
  cor,
  stats,
}: {
  titulo: string;
  cor: string;
  stats: EstatisticasDashboard["bike"];
}) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: BORDER, borderTopWidth: 3, borderTopColor: cor, borderRadius: 4, padding: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: TEXT }}>{titulo}</Text>
        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: cor }}>{stats.engajamento}%</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <MiniStat label="Atletas" value={String(stats.total)} />
        <MiniStat label="Participações" value={String(stats.participacoes)} />
        <MiniStat label="Pontos" value={String(stats.pontos)} />
        <MiniStat label="KM total" value={`${stats.km.toFixed(1)} km`} />
      </View>
      <Text style={{ fontSize: 7.5, color: TEXT_LIGHT, marginTop: 6 }}>
        Top atleta: <Text style={{ fontFamily: "Helvetica-Bold", color: TEXT }}>{stats.top?.nome ?? "—"}</Text>
      </Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: "47%", borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 5 }}>
      <Text style={{ fontSize: 6, color: TEXT_LIGHT, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: TEXT }}>{value}</Text>
    </View>
  );
}

export function ReportExecutivoDocument({
  stats,
  eventos,
  ultimosLancamentos,
  branding,
  logo,
  formatBRL,
}: {
  stats: EstatisticasDashboard;
  eventos: EventoDoc[];
  ultimosLancamentos: LoteResumo[];
  branding: BrandingDoc;
  logo?: string;
  formatBRL: (v: number) => string;
}) {
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const engCor = stats.engajamento30d >= 70 ? branding.secondary : stats.engajamento30d >= 40 ? branding.accent : branding.danger;
  const engLabel = stats.engajamento30d >= 70 ? "Saudável" : stats.engajamento30d >= 40 ? "Atenção" : "Crítico";

  const alertas = [
    { texto: "Eventos sem lançamento", valor: stats.eventosPendentesLancamento },
    { texto: "Fila aguardando decisão", valor: stats.filaAguardando },
    { texto: "Critérios sem uso", valor: stats.regrasSemUso },
    { texto: "Atletas ativos sem histórico", valor: stats.atletasSemAtividade },
  ].filter((a) => a.valor > 0);

  const proximosEventos = eventos
    .filter((e) => e.data >= new Date().toISOString().slice(0, 10))
    .slice(0, 5);

  return (
    <Document title={`Report Executivo - Atletas Energisa - ${dataHoje}`}>
      {/* Página 1 — Visão Executiva */}
      <Page size="A4" style={styles.page}>
        <PageHeader titulo="Visão Executiva" subtitulo="Resumo completo do programa de atletas" logo={logo} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 16 }}>
          <View style={{ alignItems: "center", justifyContent: "center", width: 80, height: 80 }}>
            <EngagementRing pct={stats.engajamento30d} cor={engCor} />
            <View style={{ position: "absolute", alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: engCor }}>{stats.engajamento30d}%</Text>
              <Text style={{ fontSize: 6, color: TEXT_LIGHT }}>{engLabel}</Text>
            </View>
          </View>
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <KpiCard label="Atletas ativos" value={String(stats.ativosCount)} cor={branding.primary} />
            <KpiCard label="Participações" value={String(stats.participacoesTotal)} cor={branding.accent} />
            <KpiCard label="KM percorridos" value={`${stats.kmTotal.toFixed(1)} km`} cor={branding.secondary} />
            <KpiCard label="Custo realizado" value={formatBRL(stats.investimentoTotal)} cor="#8b5cf6" />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <KpiCard label="Custo / atleta" value={formatBRL(stats.custoPorAtleta)} cor={branding.primary} />
          <KpiCard label="Custo / participação" value={formatBRL(stats.custoParticipacao)} cor={branding.primary} />
          <KpiCard label="Custo / km" value={formatBRL(stats.custoKm)} cor={branding.primary} />
          <KpiCard label="Engajamento 30d" value={`${stats.engajamento30d}%`} cor={engCor} />
        </View>

        <View style={styles.section}>
          <SectionTitle>Leitura executiva</SectionTitle>
          <BulletList itens={stats.analisesExecutivas} cor={branding.primary} />
        </View>

        <View style={styles.section}>
          <SectionTitle>Ações prioritárias</SectionTitle>
          {alertas.length === 0 ? (
            <Text style={{ fontSize: 9, color: TEXT_LIGHT }}>Nenhuma ação crítica pendente no momento.</Text>
          ) : (
            <Tabela
              colunas={[
                { chave: "texto", label: "Item", largura: 4 },
                { chave: "valor", label: "Quantidade", largura: 1, alinhar: "right" },
              ]}
              linhas={alertas.map((a) => ({ texto: a.texto, valor: String(a.valor) }))}
            />
          )}
        </View>

        <PageFooter pagina={1} dataHoje={dataHoje} />
      </Page>

      {/* Página 2 — Evolução Mensal */}
      <Page size="A4" style={styles.page}>
        <PageHeader
          titulo="Evolução Mensal"
          subtitulo={`Participações registradas — ${new Date().getFullYear()}`}
          logo={logo}
        />

        <View style={styles.section}>
          <SectionTitle>Gráfico de evolução (últimos 6 meses)</SectionTitle>
          <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 12, alignItems: "center" }}>
            <BarChart serie={stats.seriesMensal} cor={branding.primary} />
            <View style={{ flexDirection: "row", width: 470, justifyContent: "space-between", marginTop: 4 }}>
              {stats.seriesMensal.map((s) => (
                <Text key={s.label} style={{ fontSize: 7, color: TEXT_LIGHT, textTransform: "uppercase" }}>
                  {s.label}
                </Text>
              ))}
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <KpiCard
            label="Melhor mês"
            value={stats.seriesMensal.reduce((m, s) => (s.count > m.count ? s : m), stats.seriesMensal[0]).label}
            cor={branding.secondary}
          />
          <KpiCard label="Modalidade c/ mais KM" value={stats.modalidadeMaisKm} cor={branding.accent} />
          <KpiCard label="Fila de espera" value={String(stats.filaAguardando)} cor={branding.primary} />
        </View>

        <View style={styles.section}>
          <SectionTitle>Últimos lançamentos</SectionTitle>
          <Tabela
            colunas={[
              { chave: "data", label: "Data", largura: 1 },
              { chave: "descricao", label: "Descrição", largura: 2.5 },
              { chave: "atletas", label: "Atletas", largura: 1, alinhar: "right" },
              { chave: "pontos", label: "Pontos", largura: 1, alinhar: "right" },
              { chave: "km", label: "KM", largura: 1, alinhar: "right" },
            ]}
            linhas={ultimosLancamentos.map((l) => ({
              data: formatShortDate(l.data),
              descricao: l.descricao,
              atletas: String(l.atletasCount),
              pontos: String(l.pontos),
              km: l.km > 0 ? l.km.toFixed(1) : "—",
            }))}
          />
        </View>

        <PageFooter pagina={2} dataHoje={dataHoje} />
      </Page>

      {/* Página 3 — Modalidades */}
      <Page size="A4" style={styles.page}>
        <PageHeader titulo="Modalidades" subtitulo="Comparativo Bicicleta × Corrida" logo={logo} />

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          <ModalidadeResumo titulo="Bicicleta" cor={branding.primary} stats={stats.bike} />
          <ModalidadeResumo titulo="Corrida" cor={branding.secondary} stats={stats.corrida} />
        </View>

        <View style={styles.section}>
          <SectionTitle>Análise comparativa</SectionTitle>
          <Tabela
            colunas={[
              { chave: "item", label: "Indicador", largura: 2 },
              { chave: "bike", label: "Bicicleta", largura: 1, alinhar: "right" },
              { chave: "corrida", label: "Corrida", largura: 1, alinhar: "right" },
            ]}
            linhas={[
              { item: "Atletas", bike: String(stats.bike.total), corrida: String(stats.corrida.total) },
              { item: "Engajamento", bike: `${stats.bike.engajamento}%`, corrida: `${stats.corrida.engajamento}%` },
              { item: "KM total", bike: `${stats.bike.km.toFixed(1)} km`, corrida: `${stats.corrida.km.toFixed(1)} km` },
              { item: "Pontos", bike: String(stats.bike.pontos), corrida: String(stats.corrida.pontos) },
            ]}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flex: 1 }}>
            <SectionTitle>Pódio Bicicleta</SectionTitle>
            <Podio titulo="Top 3" atletas={stats.podioBike} cor={branding.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <SectionTitle>Pódio Corrida</SectionTitle>
            <Podio titulo="Top 3" atletas={stats.podioCorrida} cor={branding.secondary} />
          </View>
        </View>

        <PageFooter pagina={3} dataHoje={dataHoje} />
      </Page>

      {/* Página 4 — Gestão & Agenda */}
      <Page size="A4" style={styles.page}>
        <PageHeader titulo="Gestão & Agenda" subtitulo="Radar de inatividade e próximos eventos" logo={logo} />

        <View style={styles.section}>
          <SectionTitle>Radar de inatividade (30d+)</SectionTitle>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Tabela
                colunas={[{ chave: "nome", label: "Bicicleta" }]}
                linhas={stats.bike.inativosList.slice(0, 8).map((a) => ({ nome: a.nome }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Tabela
                colunas={[{ chave: "nome", label: "Corrida" }]}
                linhas={stats.corrida.inativosList.slice(0, 8).map((a) => ({ nome: a.nome }))}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle>Próximos eventos</SectionTitle>
          <Tabela
            colunas={[
              { chave: "titulo", label: "Evento", largura: 2 },
              { chave: "local", label: "Local", largura: 2 },
              { chave: "data", label: "Data", largura: 1, alinhar: "right" },
            ]}
            linhas={proximosEventos.map((e) => ({
              titulo: e.titulo,
              local: e.local,
              data: formatShortDate(e.data),
            }))}
          />
        </View>

        <PageFooter pagina={4} dataHoje={dataHoje} />
      </Page>
    </Document>
  );
}
