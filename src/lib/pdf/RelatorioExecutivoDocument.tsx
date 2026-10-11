/* eslint-disable jsx-a11y/alt-text -- Image aqui é do @react-pdf/renderer, não um <img> HTML. */
import { Document, Font, G, Image, Page, Polygon, Rect, Svg, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatBRL, formatKmTotal, formatNumero, formatPontos, plural } from "@/lib/format";
import type { Comparacao, DadosRelatorio, EquipeRelatorio } from "@/lib/relatorioExecutivo";

/**
 * Relatório executivo em A4: página 1 com o resumo do período (números,
 * evolução, Corrida × Bike); página 2 com pessoas e próximos passos.
 * Cores fixas da marca (o PDF não segue o tema do portal).
 */

const NAVY = "#07192d";
const TINTA = "#1a202c";
const CINZA = "#475569";
const CLARO = "#64748b";
const LINHA = "#e2e8f0";
const FUNDO = "#f4f7fa";
const VERDE = "#15803d";
const VERMELHO = "#b42318";
const OURO = "#d19b0b";
const PRATA = "#8a97a8";
const BRONZE = "#c2621c";

let fontesRegistradas = false;
/** Barlow (a fonte das artes do programa), servida pelo próprio portal. */
export function registrarFontesRelatorio(origem: string) {
  if (fontesRegistradas) return;
  const f = (nome: string) => `${origem}/fonts/relatorio/${nome}.woff`;
  Font.register({
    family: "Barlow",
    fonts: [
      { src: f("barlow-latin-400-normal"), fontWeight: 400 },
      { src: f("barlow-latin-500-normal"), fontWeight: 500 },
      { src: f("barlow-latin-600-normal"), fontWeight: 600 },
      { src: f("barlow-latin-700-normal"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Barlow Condensed",
    fonts: [
      { src: f("barlow-condensed-latin-700-normal"), fontWeight: 700 },
      { src: f("barlow-condensed-latin-800-normal"), fontWeight: 800 },
    ],
  });
  // Sem hifenizar palavras no meio (em português fica estranho).
  Font.registerHyphenationCallback((palavra) => [palavra]);
  fontesRegistradas = true;
}

const s = StyleSheet.create({
  pagina: { fontFamily: "Barlow", fontSize: 9.5, color: TINTA, paddingBottom: 48 },
  corpo: { paddingHorizontal: 40 },
  secao: { marginTop: 22 },
  tituloSecao: { fontFamily: "Barlow", fontWeight: 700, fontSize: 12, color: NAVY, marginBottom: 8 },
  rotulo: { fontSize: 8.5, fontWeight: 600, color: CLARO },
  rodape: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: CLARO,
    borderTopWidth: 0.75,
    borderTopColor: LINHA,
    paddingTop: 6,
  },
});

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dataLonga = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
const dataCurta = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1].slice(0, 3)}.`;
const diaMes = (iso: string) => `${Number(iso.slice(8, 10))}/${iso.slice(5, 7)}`;

function intervaloTexto(inicio: string, fim: string) {
  if (inicio.slice(0, 7) === fim.slice(0, 7)) return `${Number(inicio.slice(8, 10))} a ${dataLonga(fim)}`;
  if (inicio.slice(0, 4) === fim.slice(0, 4)) {
    return `${Number(inicio.slice(8, 10))} de ${MESES[Number(inicio.slice(5, 7)) - 1]} a ${dataLonga(fim)}`;
  }
  return `${dataLonga(inicio)} a ${dataLonga(fim)}`;
}

function Rodape({ geradoEm }: { geradoEm: string }) {
  return (
    <View style={s.rodape} fixed>
      <Text>Programa Atletas Energisa · Relatório executivo gerado em {geradoEm}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} de ${totalPages}`} />
    </View>
  );
}

/** Faixa da marca (as mesmas cores da barra das artes). */
function Faixa({ cores }: { cores: string[] }) {
  return (
    <View style={{ flexDirection: "row", height: 4 }}>
      {cores.map((c, i) => (
        <View key={i} style={{ flex: i === 0 ? 3 : 1, backgroundColor: c }} />
      ))}
    </View>
  );
}

/** Triângulo desenhado (a fonte não tem os caracteres de seta). */
function Seta({ sobe, cor }: { sobe: boolean; cor: string }) {
  return (
    <Svg width={6} height={6} viewBox="0 0 6 6" style={{ marginRight: 3, marginTop: 1 }}>
      <Polygon points={sobe ? "3,0 6,6 0,6" : "0,0 6,0 3,6"} fill={cor} />
    </Svg>
  );
}

function Variacao({ c, sufixo }: { c: Comparacao; sufixo: string }) {
  if (c.variacao === null) return <Text style={{ fontSize: 8, color: CLARO, marginTop: 3 }}>Sem base para comparar</Text>;
  const cor = c.variacao > 0 ? VERDE : c.variacao < 0 ? VERMELHO : CLARO;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
      {c.variacao !== 0 ? <Seta sobe={c.variacao > 0} cor={cor} /> : null}
      <Text style={{ fontSize: 8, color: cor, fontWeight: 700 }}>{c.variacao === 0 ? "Igual" : `${formatNumero(Math.abs(c.variacao), 0)}%`}</Text>
      <Text style={{ fontSize: 8, color: CLARO, marginLeft: 3 }}>{sufixo}</Text>
    </View>
  );
}

function Numero({ rotulo, valor, unidade, children, primeiro }: { rotulo: string; valor: string; unidade?: string; children?: React.ReactNode; primeiro?: boolean }) {
  return (
    <View style={{ flex: 1, paddingLeft: primeiro ? 0 : 14, borderLeftWidth: primeiro ? 0 : 0.75, borderLeftColor: LINHA }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 30, color: NAVY, marginTop: 2, lineHeight: 1 }}>
        {valor}
        {unidade ? <Text style={{ fontSize: 15, fontWeight: 700 }}> {unidade}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function GraficoMensal({ serie, corCorrida, corBike }: { serie: DadosRelatorio["serie"]; corCorrida: string; corBike: string }) {
  const L = 515;
  const A = 110;
  const topo = 14;
  const coluna = L / serie.length;
  const barra = Math.min(46, coluna * 0.5);
  const max = Math.max(1, ...serie.map((m) => m.corrida + m.bike));
  return (
    <View>
      <Svg width={L} height={A + topo} viewBox={`0 0 ${L} ${A + topo}`}>
        <Rect x={0} y={A + topo - 0.75} width={L} height={0.75} fill={LINHA} />
        {serie.map((m, i) => {
          const x = i * coluna + (coluna - barra) / 2;
          const hC = (m.corrida / max) * A;
          const hB = (m.bike / max) * A;
          const base = A + topo - 0.75;
          return (
            <G key={m.rotulo + i}>
              {/* Bike embaixo, Corrida em cima, com 1,5pt de respiro entre as duas. */}
              {hB > 0 ? <Rect x={x} y={base - hB} width={barra} height={hB} fill={corBike} /> : null}
              {hC > 0 ? <Rect x={x} y={base - hB - hC - (hB > 0 ? 1.5 : 0)} width={barra} height={hC} fill={corCorrida} /> : null}
            </G>
          );
        })}
      </Svg>
      {/* Totais em cima de cada barra e meses embaixo (texto fora do SVG para usar a fonte). */}
      <View style={{ position: "absolute", left: 0, top: 0, width: L, height: A + topo }}>
        {serie.map((m, i) => {
          const total = m.corrida + m.bike;
          const h = (total / max) * A + (m.corrida > 0 && m.bike > 0 ? 1.5 : 0);
          return (
            <Text
              key={m.rotulo + i}
              style={{ position: "absolute", left: i * coluna, width: coluna, top: A + topo - h - 13, textAlign: "center", fontSize: 8.5, fontWeight: 700, color: total ? TINTA : CLARO }}
            >
              {formatNumero(total, 0)}
            </Text>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", width: L, marginTop: 4 }}>
        {serie.map((m, i) => (
          <Text key={m.rotulo + i} style={{ width: coluna, textAlign: "center", fontSize: 8.5, color: i === serie.length - 1 ? NAVY : CLARO, fontWeight: i === serie.length - 1 ? 700 : 400 }}>
            {m.rotulo}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
        {[
          ["Corrida", corCorrida],
          ["Bike", corBike],
        ].map(([nome, cor]) => (
          <View key={nome} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, backgroundColor: cor, borderRadius: 2 }} />
            <Text style={{ fontSize: 8.5, color: CINZA }}>{nome}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TabelaEquipes({ equipes, cores }: { equipes: EquipeRelatorio[]; cores: Record<string, string> }) {
  const linhas: { rotulo: string; valor: (e: EquipeRelatorio) => string }[] = [
    { rotulo: "Atletas na equipe", valor: (e) => String(e.atletas) },
    { rotulo: "Treinaram no período", valor: (e) => `${e.treinaram} (${e.pctTreinaram}%)` },
    { rotulo: "Treinos", valor: (e) => formatNumero(e.treinos, 0) },
    { rotulo: "Quilômetros", valor: (e) => formatKmTotal(e.km) },
    { rotulo: "Km por treino", valor: (e) => (e.treinos ? `${formatNumero(e.kmPorTreino, 1)} km` : "—") },
    { rotulo: "Pontos", valor: (e) => formatPontos(e.pontos) },
  ];
  return (
    <View>
      <View style={{ flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: NAVY }}>
        <Text style={{ flex: 1.4 }} />
        {equipes.map((e) => (
          <View key={e.modalidade} style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: cores[e.modalidade] }} />
            <Text style={{ fontWeight: 700, fontSize: 10, color: NAVY }}>{e.nome}</Text>
          </View>
        ))}
      </View>
      {linhas.map((l, i) => (
        <View key={l.rotulo} style={{ flexDirection: "row", paddingVertical: 5.5, borderBottomWidth: i === linhas.length - 1 ? 0 : 0.75, borderBottomColor: LINHA }}>
          <Text style={{ flex: 1.4, color: CINZA }}>{l.rotulo}</Text>
          {equipes.map((e) => (
            <Text key={e.modalidade} style={{ flex: 1, textAlign: "right", fontWeight: 600 }}>
              {l.valor(e)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Podio({ equipe, cor }: { equipe: EquipeRelatorio; cor: string }) {
  const corMedalha = (p: number) => (p === 1 ? OURO : p === 2 ? PRATA : BRONZE);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: cor }} />
        <Text style={{ fontWeight: 700, fontSize: 10, color: NAVY }}>{equipe.nome}</Text>
      </View>
      {equipe.podio.length === 0 ? (
        <Text style={{ color: CLARO }}>Ninguém pontuou no período.</Text>
      ) : (
        equipe.podio.map((a, i) => (
          <View key={a.nome + i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: i === equipe.podio.length - 1 ? 0 : 0.75, borderBottomColor: LINHA }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: corMedalha(a.posicao), alignItems: "center", justifyContent: "center", marginRight: 8 }}>
              <Text style={{ color: "#fff", fontSize: 8, fontWeight: 700 }}>{a.posicao}</Text>
            </View>
            <Text style={{ flex: 1, fontWeight: 600 }}>{a.nome}</Text>
            <Text style={{ color: CLARO, fontSize: 8.5, marginRight: 10 }}>{plural(a.treinos, "treino")}</Text>
            <Text style={{ fontWeight: 700, width: 48, textAlign: "right" }}>{formatPontos(a.pontos)} pts</Text>
          </View>
        ))
      )}
    </View>
  );
}

function Bloco({ titulo, numero, children }: { titulo: string; numero?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }} wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        {numero ? <Text style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 16, color: NAVY }}>{numero}</Text> : null}
        <Text style={{ fontWeight: 700, color: NAVY }}>{titulo}</Text>
      </View>
      {children}
    </View>
  );
}

export function RelatorioExecutivoDocument({
  dados,
  logo,
  cores,
  geradoEm,
}: {
  dados: DadosRelatorio;
  logo: string;
  cores: { primary: string; secondary: string; accent: string };
  geradoEm: string;
}) {
  const { periodo, treinaram, treinos, km, investimento } = dados;
  const corEquipe = { corrida: cores.secondary, bicicleta: cores.primary };
  const comparadoCom = periodo.anterior
    ? periodo.parcial
      ? `vs. ${diaMes(periodo.anterior.inicio)} a ${diaMes(periodo.anterior.fim)}`
      : `vs. ${periodo.anterior.nome.toLowerCase()}`
    : "";
  const LIMITE_PARADOS = 18;
  const parados = dados.semTreinar.slice(0, LIMITE_PARADOS);
  const metadeParados = Math.ceil(parados.length / 2);

  return (
    <Document title={`Relatório executivo · ${periodo.nome} · Atletas Energisa`} author="Programa Atletas Energisa">
      <Page size="A4" style={s.pagina}>
        {/* Capa do período: o que é, de quando até quando. */}
        <View style={{ backgroundColor: NAVY, paddingHorizontal: 40, paddingTop: 30, paddingBottom: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Image src={logo} style={{ height: 30, objectFit: "contain" }} />
            <Text style={{ color: "#9fb3c8", fontSize: 8.5, fontWeight: 600 }}>Relatório executivo</Text>
          </View>
          <Text style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 40, color: "#fff", marginTop: 22, lineHeight: 1 }}>{periodo.nome}</Text>
          <Text style={{ color: "#c7d4e2", fontSize: 10, marginTop: 6 }}>
            {intervaloTexto(periodo.inicio, periodo.fim)}
            {periodo.parcial ? ` · dados até ${dataLonga(periodo.ate)}` : ""}
          </Text>
        </View>
        <Faixa cores={[cores.primary, cores.secondary, cores.accent]} />

        <View style={s.corpo}>
          <Text style={{ fontSize: 13, fontWeight: 500, color: NAVY, marginTop: 22, lineHeight: 1.4 }}>{dados.resumo}</Text>

          <View style={{ flexDirection: "row", marginTop: 20 }}>
            <Numero rotulo="Atletas que treinaram" valor={`${treinaram.pct}%`} primeiro>
              <Text style={{ fontSize: 8, color: CLARO, marginTop: 3 }}>
                {treinaram.valor} de {treinaram.total}
                {treinaram.pctAnterior !== null ? ` · antes ${treinaram.pctAnterior}%` : ""}
              </Text>
            </Numero>
            <Numero rotulo="Treinos" valor={formatNumero(treinos.valor, 0)}>
              <Variacao c={treinos} sufixo={comparadoCom} />
            </Numero>
            <Numero rotulo="Quilômetros" valor={formatNumero(km.valor, 0)} unidade="km">
              <Variacao c={km} sufixo={comparadoCom} />
            </Numero>
            {investimento ? (
              <Numero rotulo={`Investimento em ${investimento.ano}`} valor={formatBRL(investimento.realizado).replace(/,00$/, "")}>
                {investimento.previsto > 0 ? (
                  <View style={{ marginTop: 5 }}>
                    <View style={{ height: 3, backgroundColor: LINHA, borderRadius: 2 }}>
                      <View style={{ height: 3, width: `${Math.min(100, (investimento.realizado / investimento.previsto) * 100)}%`, backgroundColor: cores.primary, borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontSize: 8, color: CLARO, marginTop: 3 }}>
                      {Math.round((investimento.realizado / investimento.previsto) * 100)}% de {formatBRL(investimento.previsto).replace(/,00$/, "")} previstos
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 8, color: CLARO, marginTop: 3 }}>
                    {investimento.realizado === 0 ? "Nenhum gasto lançado no ano" : investimento.treinosNoAno ? `${formatBRL(investimento.porTreino)} por treino` : "Sem treinos no ano"}
                  </Text>
                )}
              </Numero>
            ) : null}
          </View>

          <View style={[s.secao, { marginTop: 28 }]}>
            <Text style={s.tituloSecao}>Treinos por mês</Text>
            <GraficoMensal serie={dados.serie} corCorrida={corEquipe.corrida} corBike={corEquipe.bicicleta} />
          </View>

          <View style={s.secao}>
            <Text style={s.tituloSecao}>Corrida e Bike no período</Text>
            <TabelaEquipes equipes={dados.equipes} cores={corEquipe} />
          </View>
        </View>
        <Rodape geradoEm={geradoEm} />
      </Page>

      <Page size="A4" style={[s.pagina, { paddingTop: 30 }]}>
        <View style={[s.corpo, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottomWidth: 0.75, borderBottomColor: LINHA }]} fixed>
          <Text style={{ fontWeight: 700, color: NAVY }}>Relatório executivo · {periodo.nome}</Text>
          <Text style={{ color: CLARO, fontSize: 8.5 }}>{intervaloTexto(periodo.inicio, periodo.ate)}</Text>
        </View>

        <View style={s.corpo}>
          <View style={[s.secao, { marginTop: 18 }]}>
            <Text style={s.tituloSecao}>Destaques do período</Text>
            <View style={{ flexDirection: "row", gap: 24 }}>
              {dados.equipes.map((e) => (
                <Podio key={e.modalidade} equipe={e} cor={corEquipe[e.modalidade]} />
              ))}
            </View>
            {dados.novos.length > 0 ? (
              <View style={{ marginTop: 14, backgroundColor: FUNDO, borderRadius: 4, padding: 10 }}>
                <Text style={{ fontWeight: 700, color: NAVY }}>
                  {dados.novos.length === 1 ? "1 atleta novo" : `${dados.novos.length} atletas novos`} no período
                </Text>
                <Text style={{ color: CINZA, marginTop: 3, lineHeight: 1.4 }}>
                  {dados.novos.map((n) => `${n.nome} (${n.modalidade === "corrida" ? "Corrida" : "Bike"})`).join(", ")}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={s.secao}>
            <Text style={s.tituloSecao}>Pontos de atenção</Text>
            {dados.semTreinar.length === 0 && dados.eventosSemPontos.length === 0 && dados.fila.corrida + dados.fila.bike === 0 ? (
              <Text style={{ color: CINZA }}>Nada pendente: todos treinaram nos últimos 30 dias e não há eventos sem pontos.</Text>
            ) : null}
            {dados.semTreinar.length > 0 ? (
              <Bloco numero={String(dados.semTreinar.length)} titulo={dados.semTreinar.length === 1 ? "atleta sem treinar há mais de 30 dias" : "atletas sem treinar há mais de 30 dias"}>
                <View style={{ flexDirection: "row", gap: 24 }}>
                  {[parados.slice(0, metadeParados), parados.slice(metadeParados)].map((coluna, ci) => (
                    <View key={ci} style={{ flex: 1 }}>
                      {coluna.map((a) => (
                        <View key={a.nome} style={{ flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 0.75, borderBottomColor: LINHA }}>
                          <Text style={{ flex: 1 }}>{a.nome}</Text>
                          <Text style={{ color: CLARO, fontSize: 8.5 }}>
                            {a.modalidade === "corrida" ? "Corrida" : "Bike"} · {a.ultimo ? `último ${dataCurta(a.ultimo)}` : "nunca treinou"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
                {dados.semTreinar.length > LIMITE_PARADOS ? (
                  <Text style={{ color: CLARO, fontSize: 8.5, marginTop: 4 }}>E mais {dados.semTreinar.length - LIMITE_PARADOS}. A lista completa está em Atletas, no portal.</Text>
                ) : null}
              </Bloco>
            ) : null}
            {dados.eventosSemPontos.length > 0 ? (
              <Bloco numero={String(dados.eventosSemPontos.length)} titulo={dados.eventosSemPontos.length === 1 ? "evento sem pontos lançados" : "eventos sem pontos lançados"}>
                <Text style={{ color: CINZA }}>{dados.eventosSemPontos.map((e) => `${e.titulo} (${dataCurta(e.data)})`).join(", ")}</Text>
              </Bloco>
            ) : null}
            {dados.fila.corrida + dados.fila.bike > 0 ? (
              <Bloco numero={String(dados.fila.corrida + dados.fila.bike)} titulo="na fila de espera">
                <Text style={{ color: CINZA }}>
                  {[dados.fila.corrida ? `${dados.fila.corrida} para a Corrida` : "", dados.fila.bike ? `${dados.fila.bike} para a Bike` : ""].filter(Boolean).join(" e ")}.
                </Text>
              </Bloco>
            ) : null}
          </View>

          <View style={s.secao} wrap={false}>
            <Text style={s.tituloSecao}>Próximos eventos</Text>
            {dados.proximosEventos.length === 0 ? (
              <Text style={{ color: CINZA }}>Nenhum evento agendado.</Text>
            ) : (
              dados.proximosEventos.map((e, i) => (
                <View key={e.titulo + e.data} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: i === dados.proximosEventos.length - 1 ? 0 : 0.75, borderBottomColor: LINHA }}>
                  <Text style={{ width: 62, fontWeight: 700, color: NAVY }}>{dataCurta(e.data)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 600 }}>{e.titulo}</Text>
                    <Text style={{ color: CLARO, fontSize: 8.5 }}>{e.local}</Text>
                  </View>
                  <Text style={{ color: CLARO, fontSize: 8.5 }}>{e.confirmados ? plural(e.confirmados, "confirmado") : "sem confirmações"}</Text>
                </View>
              ))
            )}
          </View>
        </View>
        <Rodape geradoEm={geradoEm} />
      </Page>
    </Document>
  );
}
