/* eslint-disable @next/next/no-img-element -- a arte vira PNG no navegador; <img> simples é o que o html-to-image copia de forma fiel. */
"use client";

import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { formatDistancia, formatPontos, plural } from "@/lib/format";
import {
  DIMENSOES,
  rotuloPeriodo,
  type DadosInformativo,
  type DegrauPodio,
  type FormatoInformativo,
  type LinhaRanking,
  type PaginaInformativo,
} from "@/lib/informativo";

/*
 * Arte do informativo, em pixels reais (1920×1080 ou 1080×1920). As cores são
 * fixas de propósito: a peça sai igual com o portal no tema claro ou escuro.
 */

const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const TEXTO = "'Barlow', 'Helvetica Neue', Arial, sans-serif";

const COR = {
  fundo: "#061426",
  fundo2: "#0a2140",
  branco: "#ffffff",
  suave: "rgba(255,255,255,0.64)",
  fraco: "rgba(255,255,255,0.38)",
  linha: "rgba(255,255,255,0.10)",
  zebra: "rgba(255,255,255,0.035)",
  ouro: "#f5c542",
  prata: "#cdd6e0",
  bronze: "#d8924f",
};

/** Largura ÷ altura do logo branco (739 × 338). */
const PROPORCAO_LOGO = 739 / 338;

const MEDALHA: Record<number, string> = { 1: COR.ouro, 2: COR.prata, 3: COR.bronze };

export interface MarcaInformativo {
  primaria: string;
  secundaria: string;
  destaque: string;
  logo: string;
}

interface PropsArte {
  dados: DadosInformativo;
  pagina: PaginaInformativo;
  formato: FormatoInformativo;
  marca: MarcaInformativo;
}

function corDaModalidade(dados: DadosInformativo, marca: MarcaInformativo) {
  return dados.modalidade === "corrida" ? marca.secundaria : marca.primaria;
}

/* ---------- Motivos de fundo ---------- */

/** Raias de pista de atletismo, cortadas pela borda. */
function Pista({ cor, estilo }: { cor: string; estilo: CSSProperties }) {
  const raias = Array.from({ length: 8 }, (_, i) => i);
  return (
    <svg viewBox="0 0 1400 900" style={{ position: "absolute", ...estilo }} aria-hidden="true">
      {raias.map((i) => {
        const inset = i * 46;
        return (
          <rect
            key={i}
            x={inset}
            y={inset}
            width={1400 - inset * 2}
            height={900 - inset * 2}
            rx={450 - inset}
            fill="none"
            stroke={cor}
            strokeWidth={i === 0 ? 5 : 2}
            strokeOpacity={i === 0 ? 0.22 : 0.12}
          />
        );
      })}
      {/* Linha de chegada */}
      <line x1="700" y1="0" x2="700" y2="368" stroke={cor} strokeOpacity="0.18" strokeWidth="3" strokeDasharray="10 12" />
    </svg>
  );
}

/** Aro de roda com raios e cubo. */
function Roda({ cor, estilo }: { cor: string; estilo: CSSProperties }) {
  const raios = Array.from({ length: 32 }, (_, i) => (i * Math.PI * 2) / 32);
  return (
    <svg viewBox="-500 -500 1000 1000" style={{ position: "absolute", ...estilo }} aria-hidden="true">
      <circle r="480" fill="none" stroke={cor} strokeOpacity="0.2" strokeWidth="26" />
      <circle r="440" fill="none" stroke={cor} strokeOpacity="0.12" strokeWidth="4" />
      {raios.map((a, i) => (
        <line
          key={i}
          x1={Math.cos(a) * 60}
          y1={Math.sin(a) * 60}
          x2={Math.cos(a + (i % 2 ? 0.18 : -0.18)) * 436}
          y2={Math.sin(a + (i % 2 ? 0.18 : -0.18)) * 436}
          stroke={cor}
          strokeOpacity="0.14"
          strokeWidth="2.5"
        />
      ))}
      <circle r="62" fill="none" stroke={cor} strokeOpacity="0.22" strokeWidth="10" />
      <circle r="22" fill={cor} fillOpacity="0.2" />
    </svg>
  );
}

function Fundo({ dados, marca, formato }: { dados: DadosInformativo; marca: MarcaInformativo; formato: FormatoInformativo }) {
  const cor = corDaModalidade(dados, marca);
  const paisagem = formato === "paisagem";
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at ${paisagem ? "88% 12%" : "85% 8%"}, ${cor}40 0%, transparent 55%), linear-gradient(160deg, ${COR.fundo2} 0%, ${COR.fundo} 60%)`,
        }}
      />
      {dados.modalidade === "corrida" ? (
        <Pista
          cor={cor}
          estilo={paisagem ? { width: 1500, left: -560, bottom: -520 } : { width: 1500, right: -700, top: -360 }}
        />
      ) : (
        <Roda cor={cor} estilo={paisagem ? { width: 1000, left: -420, bottom: -470 } : { width: 1000, right: -480, top: -420 }} />
      )}
      {/* Faixa da marca */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 10,
          background: `linear-gradient(90deg, ${marca.primaria}, ${marca.secundaria} 55%, ${marca.destaque})`,
        }}
      />
    </>
  );
}

/* ---------- Peças ---------- */

function Sobrancelha({ children, cor }: { children: ReactNode; cor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ width: 36, height: 4, borderRadius: 2, background: cor }} />
      <span
        style={{
          fontFamily: TEXTO,
          fontWeight: 700,
          fontSize: 20,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: COR.suave,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function Titulo({ dados, marca, tamanho }: { dados: DadosInformativo; marca: MarcaInformativo; tamanho: number }) {
  return (
    <div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: tamanho,
          lineHeight: 0.84,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          color: COR.branco,
        }}
      >
        {dados.modalidade === "corrida" ? "Corrida" : "Bike"}
      </div>
      <div
        style={{
          marginTop: tamanho * 0.12,
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: tamanho * 0.36,
          lineHeight: 1,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          color: corDaModalidade(dados, marca),
        }}
      >
        {rotuloPeriodo(dados.periodo)}
      </div>
    </div>
  );
}

function Indicadores({ dados, tamanho }: { dados: DadosInformativo; tamanho: number }) {
  const itens = [
    { valor: String(dados.totais.atletas), rotulo: "Atletas" },
    { valor: String(dados.totais.treinos), rotulo: "Treinos" },
    { valor: formatDistancia(dados.totais.km), rotulo: "Km" },
    { valor: dados.totais.aderencia == null ? "—" : `${dados.totais.aderencia}%`, rotulo: "Aderência média" },
  ];
  return (
    <div style={{ display: "flex" }}>
      {itens.map((item, i) => (
        <div
          key={item.rotulo}
          style={{
            flex: "1 1 auto",
            paddingLeft: i === 0 ? 0 : Math.round(tamanho * 0.5),
            paddingRight: i === itens.length - 1 ? 0 : Math.round(tamanho * 0.5),
            borderLeft: i === 0 ? "none" : `1px solid ${COR.linha}`,
          }}
        >
          <div
            style={{
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: tamanho,
              lineHeight: 1,
              color: COR.branco,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {item.valor}
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: TEXTO,
              fontWeight: 600,
              fontSize: Math.round(tamanho * 0.3),
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: COR.fraco,
              whiteSpace: "nowrap",
            }}
          >
            {item.rotulo}
          </div>
        </div>
      ))}
    </div>
  );
}

function detalheAtleta(a: LinhaRanking) {
  return [plural(a.treinos, "treino"), `${formatDistancia(a.km)} km`, a.aderencia == null ? null : `${a.aderencia}%`]
    .filter(Boolean)
    .join(" · ");
}

/** Degraus na ordem visual 2º · 1º · 3º; alturas pela posição. */
function Podio({
  degraus,
  cor,
  escala,
}: {
  degraus: DegrauPodio[];
  cor: string;
  escala: number;
}) {
  if (degraus.length === 0) return null;
  const ordem = degraus.length === 1 ? [degraus[0]] : degraus.length === 2 ? [degraus[1], degraus[0]] : [degraus[1], degraus[0], degraus[2]];
  const altura: Record<number, number> = { 1: 190, 2: 136, 3: 100 };
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 18 * escala }}>
      {ordem.map((degrau) => {
        const medalha = MEDALHA[degrau.posicao] ?? COR.prata;
        const primeiro = degrau.posicao === 1;
        const empate = degrau.atletas.length > 1;
        const nomeTam = (empate ? 26 : primeiro ? 38 : 32) * escala;
        return (
          <div key={degrau.posicao} style={{ width: 240 * escala, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: (primeiro ? 84 : 70) * escala,
                height: (primeiro ? 84 : 70) * escala,
                borderRadius: "50%",
                border: `${4 * escala}px solid ${medalha}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: (primeiro ? 44 : 36) * escala,
                color: medalha,
                background: `${medalha}1f`,
              }}
            >
              {degrau.posicao}º
            </div>
            {empate ? (
              <div
                style={{
                  marginTop: 10 * escala,
                  padding: `${3 * escala}px ${12 * escala}px`,
                  borderRadius: 999,
                  background: `${medalha}26`,
                  color: medalha,
                  fontFamily: TEXTO,
                  fontWeight: 700,
                  fontSize: 15 * escala,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}
              >
                Empate
              </div>
            ) : null}
            <div style={{ marginTop: 12 * escala, textAlign: "center", width: "100%" }}>
              {degrau.atletas.map((a) => (
                <div
                  key={a.id}
                  style={{
                    fontFamily: DISPLAY,
                    fontWeight: 700,
                    fontSize: nomeTam,
                    lineHeight: 1.02,
                    textTransform: "uppercase",
                    color: COR.branco,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: empate ? 1 : 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {a.nome}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 * escala, display: "flex", alignItems: "baseline", gap: 6 * escala }}>
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 800,
                  fontSize: (primeiro ? 64 : 52) * escala,
                  lineHeight: 1,
                  color: primeiro ? COR.ouro : COR.branco,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatPontos(degrau.atletas[0].pontos)}
              </span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22 * escala, color: COR.suave }}>PTS</span>
            </div>
            {!empate ? (
              <div
                style={{
                  marginTop: 6 * escala,
                  fontFamily: TEXTO,
                  fontWeight: 500,
                  fontSize: 17 * escala,
                  color: COR.suave,
                  whiteSpace: "nowrap",
                }}
              >
                {detalheAtleta(degrau.atletas[0])}
              </div>
            ) : null}
            <div
              style={{
                marginTop: 16 * escala,
                width: "100%",
                height: (altura[degrau.posicao] ?? 90) * escala,
                borderTop: `${5 * escala}px solid ${medalha}`,
                borderRadius: `${10 * escala}px ${10 * escala}px 0 0`,
                background: `linear-gradient(180deg, ${medalha}38 0%, ${cor}10 100%)`,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                paddingTop: 10 * escala,
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: 96 * escala,
                lineHeight: 1,
                color: `${medalha}33`,
              }}
            >
              {degrau.posicao}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Tabela de classificação. `densa` reduz a coluna de aderência (páginas de continuação). */
function Tabela({
  linhas,
  cor,
  alturaLinha,
  fonte,
  densa = false,
}: {
  linhas: LinhaRanking[];
  cor: string;
  alturaLinha: number;
  fonte: number;
  densa?: boolean;
}) {
  const col = {
    pos: fonte * 2.6,
    treinos: fonte * 3.6,
    km: fonte * 4.4,
    pontos: fonte * 4.2,
    aderencia: densa ? fonte * 5.4 : fonte * 7,
  };
  const cabecalho: CSSProperties = {
    fontFamily: TEXTO,
    fontWeight: 700,
    fontSize: fonte * 0.62,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: COR.fraco,
  };
  const numero: CSSProperties = {
    fontFamily: TEXTO,
    fontWeight: 600,
    fontSize: fonte,
    color: COR.suave,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: alturaLinha * 0.8,
          borderBottom: `1px solid ${COR.linha}`,
          paddingRight: 12,
        }}
      >
        <span style={{ ...cabecalho, width: col.pos }}>Pos</span>
        <span style={{ ...cabecalho, flex: 1 }}>Atleta</span>
        <span style={{ ...cabecalho, width: col.treinos, textAlign: "right" }}>Treinos</span>
        <span style={{ ...cabecalho, width: col.km, textAlign: "right" }}>Km</span>
        <span style={{ ...cabecalho, width: col.pontos, textAlign: "right" }}>Pontos</span>
        <span style={{ ...cabecalho, width: col.aderencia, textAlign: "right" }}>Aderência</span>
      </div>
      {linhas.map((l, i) => (
        <div
          key={l.id}
          style={{
            display: "flex",
            alignItems: "center",
            height: alturaLinha,
            paddingRight: 12,
            background: i % 2 === 0 ? COR.zebra : "transparent",
            borderRadius: 6,
          }}
        >
          <span
            style={{
              width: col.pos,
              paddingLeft: 10,
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: fonte * 1.2,
              color: COR.branco,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {l.posicao}º
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: TEXTO,
              fontWeight: 600,
              fontSize: fonte,
              color: COR.branco,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              paddingRight: 12,
            }}
          >
            {l.nome}
          </span>
          <span style={{ ...numero, width: col.treinos }}>{l.treinos}</span>
          <span style={{ ...numero, width: col.km }}>{formatDistancia(l.km)}</span>
          <span
            style={{
              ...numero,
              width: col.pontos,
              fontFamily: DISPLAY,
              fontWeight: 800,
              fontSize: fonte * 1.25,
              color: l.pontos > 0 ? cor : COR.fraco,
            }}
          >
            {formatPontos(l.pontos)}
          </span>
          <span
            style={{
              width: col.aderencia,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {!densa && l.aderencia != null ? (
              <span
                style={{ width: fonte * 3.4, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}
              >
                <span style={{ display: "block", width: `${l.aderencia}%`, height: "100%", background: cor, borderRadius: 4 }} />
              </span>
            ) : null}
            <span style={{ ...numero, width: "auto", minWidth: fonte * 2.4 }}>
              {l.aderencia == null ? "—" : `${l.aderencia}%`}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Destaques do período: ocupam o espaço livre da última página. */
function Destaques({ dados, cor, fonte, colunas }: { dados: DadosInformativo; cor: string; fonte: number; colunas: number }) {
  const pontuaram = dados.ranking.filter((l) => l.treinos > 0);
  if (pontuaram.length === 0) return null;
  const maisKm = [...pontuaram].sort((a, b) => b.km - a.km)[0];
  const maisTreinos = [...pontuaram].sort((a, b) => b.treinos - a.treinos)[0];
  const cheios = dados.ranking.filter((l) => l.aderencia === 100).length;
  const itens = [
    { rotulo: "Mais quilômetros", valor: `${formatDistancia(maisKm.km)} km`, nome: maisKm.nome },
    { rotulo: "Mais treinos", valor: plural(maisTreinos.treinos, "treino"), nome: maisTreinos.nome },
    cheios > 0
      ? { rotulo: "Aderência de 100%", valor: plural(cheios, "atleta"), nome: "presentes em todos os treinos" }
      : { rotulo: "Treinos no período", valor: String(dados.totais.treinos), nome: `${formatDistancia(dados.totais.km)} km somados` },
  ];
  return (
    <div>
      <Sobrancelha cor={cor}>Destaques do período</Sobrancelha>
      <div style={{ marginTop: fonte, display: "grid", gridTemplateColumns: `repeat(${colunas}, 1fr)`, gap: 20 }}>
        {itens.map((item) => (
          <div
            key={item.rotulo}
            style={{
              padding: `${fonte * 1.1}px ${fonte * 1.2}px`,
              borderRadius: 16,
              background: "rgba(255,255,255,0.05)",
              borderLeft: `6px solid ${cor}`,
            }}
          >
            <div style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: fonte * 0.7, letterSpacing: "0.14em", textTransform: "uppercase", color: COR.fraco }}>
              {item.rotulo}
            </div>
            <div style={{ marginTop: 8, fontFamily: DISPLAY, fontWeight: 800, fontSize: fonte * 2.2, lineHeight: 1, color: COR.branco, whiteSpace: "nowrap" }}>
              {item.valor}
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: TEXTO,
                fontWeight: 600,
                fontSize: fonte,
                color: COR.suave,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.nome}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Rodape({ pagina, fonte }: { pagina: PaginaInformativo; fonte: number }) {
  return (
    <div
      style={{
        marginTop: 24,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        fontFamily: TEXTO,
        fontWeight: 500,
        fontSize: fonte,
        lineHeight: 1.35,
        color: COR.fraco,
      }}
    >
      <span>
        Posição definida só pelos pontos; empates dividem a colocação.
        <br />
        Aderência: treinos feitos ÷ treinos previstos na agenda, sem contar faltas justificadas.
      </span>
      <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, letterSpacing: "0.18em", color: COR.suave }}>
          MOVIMENTO QUE CONECTA
        </span>
        {pagina.total > 1 ? (
          <>
            <br />
            {pagina.numero}/{pagina.total}
          </>
        ) : null}
      </span>
    </div>
  );
}

function Logo({ marca, altura }: { marca: MarcaInformativo; altura: number }) {
  // Tamanho explícito: com largura "auto" a exportação calcula a proporção errada e estica o logo.
  return (
    <img
      src={marca.logo}
      alt="Atletas Energisa"
      width={Math.round(altura * PROPORCAO_LOGO)}
      height={altura}
      style={{ height: altura, width: Math.round(altura * PROPORCAO_LOGO), objectFit: "contain" }}
    />
  );
}

function SemPontuacao({ fonte }: { fonte: number }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: fonte,
        textTransform: "uppercase",
        color: COR.fraco,
      }}
    >
      Sem pontuação no período
    </div>
  );
}

/* ---------- Layouts ---------- */

function PaisagemCapa({ dados, pagina, marca }: Omit<PropsArte, "formato">) {
  const cor = corDaModalidade(dados, marca);
  const semPontos = dados.totais.pontos === 0;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "72px 80px 56px", display: "flex", gap: 80 }}>
      <div style={{ width: 760, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo marca={marca} altura={58} />
        </div>
        <div style={{ marginTop: 40 }}>
          <Sobrancelha cor={cor}>Ranking de pontos</Sobrancelha>
        </div>
        <div style={{ marginTop: 16 }}>
          <Titulo dados={dados} marca={marca} tamanho={124} />
        </div>
        <div style={{ marginTop: 36 }}>
          <Indicadores dados={dados} tamanho={44} />
        </div>
        <div style={{ marginTop: "auto" }}>
          {semPontos ? null : <Podio degraus={pagina.podio ?? []} cor={cor} escala={0.84} />}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <Sobrancelha cor={cor}>Classificação</Sobrancelha>
        </div>
        <div style={{ marginTop: 40, flex: 1, minHeight: 0, overflow: "hidden" }}>
          {semPontos ? (
            <SemPontuacao fonte={56} />
          ) : pagina.linhas.length > 0 ? (
            <Tabela linhas={pagina.linhas} cor={cor} alturaLinha={52} fonte={24} />
          ) : null}
          {!semPontos && pagina.total === 1 && pagina.linhas.length <= 10 ? (
            <div style={{ marginTop: 32 }}>
              <Destaques dados={dados} cor={cor} fonte={17} colunas={3} />
            </div>
          ) : null}
        </div>
        <Rodape pagina={pagina} fonte={17} />
      </div>
    </div>
  );
}

function PaisagemContinuacao({ dados, pagina, marca }: Omit<PropsArte, "formato">) {
  const cor = corDaModalidade(dados, marca);
  const metade = Math.ceil(pagina.linhas.length / 2);
  return (
    <div style={{ position: "absolute", inset: 0, padding: "64px 80px 56px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 72, lineHeight: 1, textTransform: "uppercase", color: COR.branco }}>
            {dados.modalidade === "corrida" ? "Corrida" : "Bike"}
          </span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 40, textTransform: "uppercase", color: cor }}>
            {rotuloPeriodo(dados.periodo)}
          </span>
        </div>
        <Logo marca={marca} altura={50} />
      </div>
      <div style={{ marginTop: 16 }}>
        <Sobrancelha cor={cor}>Classificação · continuação</Sobrancelha>
      </div>
      <div style={{ marginTop: 32, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 56 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Tabela linhas={pagina.linhas.slice(0, metade)} cor={cor} alturaLinha={46} fonte={21} densa />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {pagina.linhas.length > metade ? (
            <Tabela linhas={pagina.linhas.slice(metade)} cor={cor} alturaLinha={46} fonte={21} densa />
          ) : null}
        </div>
      </div>
      {pagina.numero === pagina.total && metade <= 8 ? (
        <div style={{ marginTop: 48 }}>
          <Destaques dados={dados} cor={cor} fonte={19} colunas={3} />
        </div>
      ) : null}
      </div>
      <Rodape pagina={pagina} fonte={17} />
    </div>
  );
}

function VerticalCapa({ dados, pagina, marca }: Omit<PropsArte, "formato">) {
  const cor = corDaModalidade(dados, marca);
  const semPontos = dados.totais.pontos === 0;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "80px 72px 60px", display: "flex", flexDirection: "column" }}>
      <Logo marca={marca} altura={64} />
      <div style={{ marginTop: 56 }}>
        <Sobrancelha cor={cor}>Ranking de pontos</Sobrancelha>
      </div>
      <div style={{ marginTop: 20 }}>
        <Titulo dados={dados} marca={marca} tamanho={176} />
      </div>
      <div style={{ marginTop: 48 }}>
        <Indicadores dados={dados} tamanho={56} />
      </div>
      {semPontos ? (
        <SemPontuacao fonte={64} />
      ) : (
        <>
          <div style={{ marginTop: 56 }}>
            <Podio degraus={pagina.podio ?? []} cor={cor} escala={1.12} />
          </div>
          <div style={{ marginTop: 36, flex: 1, minHeight: 0, overflow: "hidden" }}>
            {pagina.linhas.length > 0 ? (
              <Tabela linhas={pagina.linhas} cor={cor} alturaLinha={50} fonte={25} />
            ) : null}
          </div>
        </>
      )}
      <Rodape pagina={pagina} fonte={18} />
    </div>
  );
}

function VerticalContinuacao({ dados, pagina, marca }: Omit<PropsArte, "formato">) {
  const cor = corDaModalidade(dados, marca);
  return (
    <div style={{ position: "absolute", inset: 0, padding: "80px 72px 60px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo marca={marca} altura={56} />
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 36, textTransform: "uppercase", color: cor }}>
          {rotuloPeriodo(dados.periodo)}
        </span>
      </div>
      <div style={{ marginTop: 48, fontFamily: DISPLAY, fontWeight: 800, fontSize: 110, lineHeight: 0.9, textTransform: "uppercase", color: COR.branco }}>
        {dados.modalidade === "corrida" ? "Corrida" : "Bike"}
      </div>
      <div style={{ marginTop: 20 }}>
        <Sobrancelha cor={cor}>Classificação · continuação</Sobrancelha>
      </div>
      <div style={{ marginTop: 36, flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Tabela linhas={pagina.linhas} cor={cor} alturaLinha={50} fonte={24} />
        {pagina.numero === pagina.total && pagina.linhas.length <= 20 ? (
          <div style={{ marginTop: 64 }}>
            <Destaques dados={dados} cor={cor} fonte={20} colunas={3} />
          </div>
        ) : null}
      </div>
      <Rodape pagina={pagina} fonte={18} />
    </div>
  );
}

export const ArteInformativo = forwardRef<HTMLDivElement, PropsArte>(function ArteInformativo(
  { dados, pagina, formato, marca },
  ref,
) {
  const { largura, altura } = DIMENSOES[formato];
  const capa = pagina.numero === 1;
  const props = { dados, pagina, marca };
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: largura,
        height: altura,
        overflow: "hidden",
        background: COR.fundo,
        color: COR.branco,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <Fundo dados={dados} marca={marca} formato={formato} />
      {formato === "paisagem" ? (
        capa ? <PaisagemCapa {...props} /> : <PaisagemContinuacao {...props} />
      ) : capa ? (
        <VerticalCapa {...props} />
      ) : (
        <VerticalContinuacao {...props} />
      )}
    </div>
  );
});
