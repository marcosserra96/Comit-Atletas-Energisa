/* eslint-disable @next/next/no-img-element -- a arte vira PNG/PDF no navegador; <img> simples é o que o html-to-image copia de forma fiel. */
"use client";

import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/900-italic.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow/800.css";
import { forwardRef, useId, type CSSProperties, type ReactNode } from "react";
import { FORMAS, LARGURA_BASE, type Caixa, type EstiloTrofeu, type FormatoTrofeu, type TextosParticipacao, type TextosPremiacao } from "@/lib/trofeu";

/*
 * Arte do troféu em unidades de desenho (1000 de largura); a exportação
 * multiplica até chegar a 300 dpi no tamanho pedido. Recortada no contorno
 * de corte. Cores fixas: sai igual no tema claro ou escuro do portal.
 */

const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const TEXTO = "'Barlow', 'Helvetica Neue', Arial, sans-serif";

/** Paleta de cada estilo: fundo, tinta, título, destaque, linhas e rede de pontos. */
const PALETAS: Record<EstiloTrofeu, { fundo: string; tinta: string; titulo: string; apoio: string; linhas: string[]; pontos: string[]; fio: string; escuro: boolean }> = {
  claro: {
    fundo: "#ffffff",
    tinta: "#0c2340",
    titulo: "#1580b0",
    apoio: "#0b4f9c",
    linhas: ["#1580b0", "#9cc31f", "#0b4f9c", "#9cc31f", "#f37021", "#1580b0"],
    pontos: ["#1580b0", "#5fb7d6", "#9cc31f", "#f37021"],
    fio: "rgba(21,128,176,.28)",
    escuro: false,
  },
  marinho: {
    fundo: "#071b36",
    tinta: "#ffffff",
    titulo: "#7fd3f2",
    apoio: "#c9e36a",
    linhas: ["#2f9fd0", "#9cc31f", "#7fd3f2", "#9cc31f", "#f37021", "#2f9fd0"],
    pontos: ["#7fd3f2", "#2f9fd0", "#c9e36a", "#f6a46b"],
    fio: "rgba(127,211,242,.30)",
    escuro: true,
  },
  dourado: {
    fundo: "#fbf7ee",
    tinta: "#0c2340",
    titulo: "#0b4f9c",
    apoio: "#a8771a",
    linhas: ["#c9973a", "#0b4f9c", "#e2bf6a", "#0b4f9c", "#c9973a", "#e2bf6a"],
    pontos: ["#c9973a", "#e2bf6a", "#0b4f9c", "#a8771a"],
    fio: "rgba(168,119,26,.28)",
    escuro: false,
  },
};

/** Ouro, prata e bronze: [claro, médio, escuro]. */
const METAIS: Record<number, [string, string, string]> = {
  1: ["#fff3c4", "#e2ae32", "#9c6c12"],
  2: ["#ffffff", "#b8c3d1", "#6f7d90"],
  3: ["#ffe2c9", "#d0874a", "#8a4c1b"],
};

export interface PessoaDoTrofeu {
  nome: string;
  /** "Corrida", "Bike". */
  modalidade?: string;
  colocacao?: number;
}

export type PropsTrofeu = {
  formato: FormatoTrofeu;
  estilo: EstiloTrofeu;
  /** Ilustração do local (participação), de preferência um PNG em traço com fundo transparente. */
  ilustracao?: string;
  posicaoIlustracao?: "direita" | "atras";
  /** Linha fina no contorno, só para conferir o corte na tela. */
  contornoVisivel?: boolean;
} & ({ tipo: "participacao"; textos: TextosParticipacao } | { tipo: "premiacao"; textos: TextosPremiacao; pessoa: PessoaDoTrofeu; campeao?: boolean });

/** Fonte que encolhe com textos longos, para caber na largura. */
const ajuste = (texto: string, maximo: number, largura: number, fator = 0.5) => Math.max(maximo * 0.42, Math.min(maximo, Math.floor(largura / Math.max(1, texto.length * fator))));

/** Rede de pontos da marca (a "energia conectada"), sempre igual para a mesma área. */
function nosDaRede(caixa: Caixa, cores: string[], semente: number) {
  let s = semente;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: 16 }, (_, i) => ({ x: caixa.x + rand() * caixa.w, y: caixa.y + rand() * caixa.h, r: 4 + rand() * 9, cor: cores[i % 7 === 3 ? 3 : i % 3] }));
}

function RedeDePontos({ caixa, cores, fio, semente = 7 }: { caixa: Caixa; cores: string[]; fio: string; semente?: number }) {
  const nos = nosDaRede(caixa, cores, semente);
  const ligacoes: [number, number][] = [];
  nos.forEach((a, i) => {
    nos
      .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter((x) => x.j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, 2)
      .forEach(({ j }) => ligacoes.push([Math.min(i, j), Math.max(i, j)]));
  });
  const unicas = [...new Set(ligacoes.map((l) => l.join("-")))].map((k) => k.split("-").map(Number));
  return (
    <g aria-hidden="true">
      {unicas.map(([i, j]) => (
        <line key={`${i}-${j}`} x1={nos[i].x} y1={nos[i].y} x2={nos[j].x} y2={nos[j].y} stroke={fio} strokeWidth={2.2} />
      ))}
      {nos.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.cor} />
      ))}
    </g>
  );
}

/** Linhas finas de velocidade saindo do canto de baixo, como na peça do Corrida & Pedal. */
function LinhasDeVelocidade({ largura, altura, cores }: { largura: number; altura: number; cores: string[] }) {
  const L = largura;
  const base = altura * 0.985;
  const espessuras = [7, 18, 5, 11, 6, 4];
  return (
    <g aria-hidden="true" fill="none" strokeLinecap="round">
      {espessuras.map((e, i) => {
        const d = i * 15;
        return (
          <path
            key={i}
            d={`M${L * 0.12 + d * 2} ${base + 14} C ${L * 0.48} ${base - 50 - d}, ${L * 0.78} ${base - 120 - d}, ${L + 30} ${base - 230 - d * 1.6}`}
            stroke={cores[i % cores.length]}
            strokeWidth={e}
            strokeDasharray={i === 4 ? "2 16" : undefined}
            opacity={i === 1 ? 0.9 : 1}
          />
        );
      })}
    </g>
  );
}

/** A colocação numa medalha de verdade: anel de metal e o número no meio. */
function Medalha({ colocacao, diametro, escuro }: { colocacao: number; diametro: number; escuro: boolean }) {
  const [claro, medio, escuroMetal] = METAIS[colocacao] ?? METAIS[1];
  return (
    <div
      style={{
        width: diametro,
        height: diametro,
        borderRadius: "50%",
        padding: diametro * 0.07,
        background: `conic-gradient(from 210deg, ${claro}, ${medio} 25%, ${escuroMetal} 50%, ${medio} 75%, ${claro})`,
        boxShadow: escuro ? "0 0 0 3px rgba(255,255,255,.12)" : "0 10px 24px rgba(12,35,64,.18)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: escuro ? "#0c2747" : "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: `${Math.max(2, diametro * 0.015)}px solid ${medio}`,
        }}
      >
        <span style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: diametro * 0.46, lineHeight: 0.9, color: escuro ? claro : escuroMetal }}>{colocacao}º</span>
        <span style={{ fontFamily: TEXTO, fontWeight: 800, fontSize: diametro * 0.085, letterSpacing: diametro * 0.02, color: escuro ? "rgba(255,255,255,.7)" : medio, marginTop: diametro * 0.02 }}>LUGAR</span>
      </div>
    </div>
  );
}

function Logo({ escuro, altura }: { escuro: boolean; altura: number }) {
  return <img src={escuro ? "/reuniao/logo-atletas.webp" : "/convites/logo-atletas-claro.png"} alt="" style={{ height: altura, width: "auto", display: "block" }} />;
}

function Energisa({ escuro, largura }: { escuro: boolean; largura: number }) {
  return <img src={escuro ? "/reuniao/logo-energisa.webp" : "/trofeus/logo-energisa-azul.png"} alt="" style={{ width: largura, height: "auto", display: "block" }} />;
}

/** Linha de apoio com o filete verde-limão embaixo (o "1º ENCONTRO" da peça). */
function Sobretitulo({ texto, cor, tamanho }: { texto: string; cor: string; tamanho: number }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
      <span style={{ fontFamily: TEXTO, fontWeight: 600, fontSize: tamanho, letterSpacing: tamanho * 0.12, color: cor, textTransform: "uppercase", lineHeight: 1 }}>{texto}</span>
      <span style={{ height: 4, borderRadius: 2, background: "#9cc31f" }} />
    </div>
  );
}

function NaCaixa({ caixa, children, alinhar = "center", estilo }: { caixa: Caixa; children: ReactNode; alinhar?: "center" | "flex-start"; estilo?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        left: caixa.x,
        top: caixa.y,
        width: caixa.w,
        height: caixa.h,
        display: "flex",
        flexDirection: "column",
        alignItems: alinhar,
        justifyContent: "center",
        textAlign: alinhar === "center" ? "center" : "left",
        ...estilo,
      }}
    >
      {children}
    </div>
  );
}

export const ArteTrofeu = forwardRef<HTMLDivElement, PropsTrofeu>(function ArteTrofeu(props, ref) {
  const { formato, estilo, ilustracao, posicaoIlustracao = "direita", contornoVisivel = false } = props;
  const forma = FORMAS[formato];
  const W = LARGURA_BASE;
  const H = forma.altura;
  const idClip = useId().replace(/:/g, "");
  const p = PALETAS[estilo];
  const taca = formato === "taca";
  const ilustracaoDireita = !!ilustracao && posicaoIlustracao === "direita" && (formato === "facetado" || formato === "placa");
  // O conteúdo não desce até as linhas de velocidade (elas ocupam o pé da peça).
  const limite = taca ? forma.conteudo.y + forma.conteudo.h : Math.min(forma.conteudo.y + forma.conteudo.h, H * 0.82);
  const caixaBase: Caixa = { ...forma.conteudo, h: limite - forma.conteudo.y };
  // Com a ilustração à direita, o texto fica na metade esquerda (afastado da quina do facetado).
  const caixa: Caixa = ilustracaoDireita ? { x: caixaBase.x + (formato === "facetado" ? 30 : 0), y: caixaBase.y + 40, w: caixaBase.w * 0.48, h: caixaBase.h - 40 } : caixaBase;
  const alinhar = ilustracaoDireita ? "flex-start" : "center";
  // Rede de pontos: no canto de cima à direita (ou atrás da ilustração).
  const areaRede: Caixa = ilustracaoDireita ? { x: W * 0.55, y: forma.conteudo.y - 30, w: W * 0.4, h: 260 } : formato === "medalha"
        ? { x: W * 0.66, y: 140, w: W * 0.24, h: 100 }
        : { x: W * 0.66, y: Math.max(30, forma.conteudo.y - 50), w: W * 0.27, h: 180 };

  let conteudo: ReactNode;
  if (props.tipo === "participacao") {
    const t = props.textos;
    conteudo = (
      <NaCaixa caixa={caixa} alinhar={alinhar} estilo={{ gap: ilustracaoDireita ? 20 : formato === "placa" ? 36 : 26 }}>
        {t.sobretitulo ? <Sobretitulo texto={t.sobretitulo} cor={p.apoio} tamanho={ajuste(t.sobretitulo, 40, caixa.w, 0.62)} /> : null}
        <div style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: ajuste(t.titulo, ilustracaoDireita ? 124 : 168, caixa.w * 1.75, 0.5), lineHeight: 0.88, color: p.titulo, textWrap: "balance", letterSpacing: "-0.01em" } as CSSProperties}>{t.titulo}</div>
        <Logo escuro={p.escuro} altura={taca ? 80 : ilustracaoDireita ? 100 : 128} />
        <div style={{ width: ilustracaoDireita ? "100%" : "64%", height: 3, background: p.fio }} />
        {t.local ? (
          <div style={{ fontFamily: TEXTO, fontWeight: 800, fontSize: ajuste(t.local, 42, caixa.w * 1.5, 0.6), lineHeight: 1.12, color: p.tinta, textTransform: "uppercase", textWrap: "balance" } as CSSProperties}>{t.local}</div>
        ) : null}
        {t.data ? <div style={{ fontFamily: TEXTO, fontWeight: 600, fontSize: 38, color: p.titulo, marginTop: -10 }}>{t.data}</div> : null}
        <div style={{ marginTop: 6 }}>
          <Energisa escuro={p.escuro} largura={taca ? 170 : 230} />
        </div>
      </NaCaixa>
    );
  } else {
    const t = props.textos;
    const pessoa = props.pessoa;
    const campeao = pessoa.colocacao === 1 && props.campeao;
    const premio = (tam: number, largura: number) => (
      <div style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: ajuste(t.premio, tam, largura * 1.75, 0.5), lineHeight: 0.88, color: p.titulo, textWrap: "balance", letterSpacing: "-0.01em" } as CSSProperties}>{t.premio}</div>
    );
    const modalidade = pessoa.modalidade ? (
      <span style={{ padding: "7px 24px", borderRadius: 999, border: `3px solid ${estilo === "dourado" ? "#c9973a" : "#9cc31f"}`, fontFamily: TEXTO, fontWeight: 800, fontSize: 30, letterSpacing: 4, color: p.tinta, textTransform: "uppercase" }}>{pessoa.modalidade}</span>
    ) : null;
    const nome = (largura: number, maximo = 60) => (
      <div style={{ fontFamily: TEXTO, fontWeight: 800, fontSize: ajuste(pessoa.nome, maximo, largura * 1.6, 0.56), lineHeight: 1.06, color: p.tinta, textWrap: "balance" } as CSSProperties}>{pessoa.nome}</div>
    );
    conteudo = taca && forma.base ? (
      <>
        <NaCaixa caixa={caixa} estilo={{ gap: 14 }}>
          <Logo escuro={p.escuro} altura={66} />
          {t.periodo ? <Sobretitulo texto={t.periodo} cor={p.apoio} tamanho={28} /> : null}
          {premio(112, caixa.w)}
          {pessoa.colocacao ? <Medalha colocacao={pessoa.colocacao} diametro={156} escuro={p.escuro} /> : null}
        </NaCaixa>
        <NaCaixa caixa={forma.base} estilo={{ gap: 12 }}>
          {campeao ? <span style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: 48, lineHeight: 1, color: METAIS[1][2] }}>Campeão</span> : modalidade}
          {nome(forma.base.w, 64)}
          {campeao ? modalidade : <Energisa escuro={p.escuro} largura={170} />}
        </NaCaixa>
      </>
    ) : (
      <NaCaixa caixa={caixa} estilo={{ gap: formato === "placa" ? 40 : 24 }}>
        <Logo escuro={p.escuro} altura={formato === "medalha" ? 92 : 116} />
        {t.periodo ? <Sobretitulo texto={t.periodo} cor={p.apoio} tamanho={34} /> : null}
        {premio(formato === "medalha" ? 132 : 158, caixa.w)}
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          {pessoa.colocacao ? <Medalha colocacao={pessoa.colocacao} diametro={formato === "medalha" ? 180 : 220} escuro={p.escuro} /> : null}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, maxWidth: caixa.w * 0.56, textAlign: "left" }}>
            {campeao ? <span style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: 58, lineHeight: 1, color: METAIS[1][2] }}>Campeão</span> : null}
            {nome(caixa.w * 0.56, 68)}
            {modalidade}
          </div>
        </div>
        <Energisa escuro={p.escuro} largura={240} />
      </NaCaixa>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", width: W, height: H }}>
      <div style={{ position: "absolute", inset: 0, clipPath: `path('${forma.contorno}')`, overflow: "hidden", fontFamily: TEXTO, background: p.fundo }}>
        {p.escuro ? <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 50% at 70% 10%, rgba(47,159,208,.25), transparent 70%)" }} /> : null}
        {ilustracao ? (
          ilustracaoDireita ? (
            <img src={ilustracao} alt="" style={{ position: "absolute", right: 26, top: forma.conteudo.y + 40, width: W * 0.5, height: caixaBase.h - 20, objectFit: "contain", objectPosition: "100% 100%" }} />
          ) : (
            <img src={ilustracao} alt="" style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover", opacity: p.escuro ? 0.18 : 0.12 }} />
          )
        ) : null}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
          <defs>
            <clipPath id={`c${idClip}`}>
              <path d={forma.contorno} />
            </clipPath>
            {/* Filete fino 26 unidades para dentro do contorno: acompanha qualquer forma. */}
            <mask id={`m${idClip}`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <path d={forma.contorno} fill="none" stroke="#fff" strokeWidth={56} />
              <path d={forma.contorno} fill="none" stroke="#000" strokeWidth={50} />
            </mask>
          </defs>
          <g clipPath={`url(#c${idClip})`}>
            {taca ? null : <RedeDePontos caixa={areaRede} cores={p.pontos} fio={p.fio} semente={formato.length * 31 + 7} />}
            {taca ? null : <LinhasDeVelocidade largura={W} altura={H} cores={p.linhas} />}
            {estilo !== "claro" ? <rect x={0} y={0} width={W} height={H} fill={estilo === "marinho" ? "#c9a64a" : "#c9973a"} mask={`url(#m${idClip})`} /> : null}
          </g>
        </svg>
        {conteudo}
      </div>
      {contornoVisivel ? (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden="true">
          <path d={forma.contorno} fill="none" stroke="#e5007e" strokeWidth={3} strokeDasharray="14 10" />
        </svg>
      ) : null}
    </div>
  );
});
