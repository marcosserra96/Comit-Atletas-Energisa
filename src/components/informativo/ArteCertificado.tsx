/* eslint-disable @next/next/no-img-element -- a arte vira PNG/PDF no navegador; <img> simples é o que o html-to-image copia de forma fiel. */
"use client";

import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/900-italic.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/kaushan-script/400.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/400-italic.css";
import "@fontsource/merriweather/700.css";
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { trechos } from "@/lib/convite";
import { TAMANHO_CERTIFICADO, type LayoutCertificado, type TextosCertificado } from "@/lib/certificado";

/*
 * Certificado em pixels reais (A4 deitado, 1754 × 1240). Cores fixas de
 * propósito: sai igual com o portal no tema claro ou escuro.
 */

const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const TEXTO = "'Barlow', 'Helvetica Neue', Arial, sans-serif";
const SERIFA = "'Merriweather', Georgia, serif";
const CURSIVA = "'Kaushan Script', 'Brush Script MT', cursive";

const C = {
  marinho: "#06182f",
  marinho2: "#0a2a52",
  royal: "#0b4f9c",
  tinta: "#10294a",
  tintaSuave: "#4a6283",
  laranja: "#f37021",
  lima: "#b9d531",
  ouro: "#f5c542",
  ouro2: "#c8901a",
  papel: "#f7fafd",
  branco: "#ffffff",
};

export interface PropsCertificado {
  layout: LayoutCertificado;
  /** Textos já preenchidos para a pessoa (sem {campos}). */
  textos: TextosCertificado;
  nome: string;
  colocacao?: number;
  /** Fundo do layout "Sua arte" (data URL). */
  imagem?: string;
}

/** Nome numa linha: a fonte diminui com nomes longos (a Kaushan ocupa ~0,47 da altura por letra). */
function tamanhoDoNome(nome: string, largura: number) {
  return Math.max(56, Math.min(124, Math.floor((largura * 0.95) / Math.max(1, nome.length * 0.47))));
}

function Rico({ texto, cor }: { texto: string; cor: string }) {
  return (
    <>
      {trechos(texto).map((t, i) =>
        t.destaque ? (
          <strong key={i} style={{ color: cor, fontWeight: 700 }}>
            {t.texto}
          </strong>
        ) : (
          <span key={i}>{t.texto}</span>
        ),
      )}
    </>
  );
}

/** Selo dourado: a colocação ou, sem ela, uma estrela. */
function Selo({ colocacao, escuro }: { colocacao?: number; escuro: boolean }) {
  const metal = colocacao === 2 ? ["#eef2f7", "#9aa9bc", "#6f7f94"] : colocacao === 3 ? ["#f6c9a3", "#c56a2b", "#8f4a1c"] : ["#fff1b8", C.ouro, C.ouro2];
  return (
    <div style={{ position: "relative", width: 210, height: 250, display: "flex", justifyContent: "center" }}>
      {/* Fitas */}
      <svg width="150" height="120" viewBox="0 0 150 120" style={{ position: "absolute", top: 130 }} aria-hidden="true">
        <path d="M30 0 L62 0 L52 112 L36 96 L18 108 Z" fill={escuro ? C.laranja : C.royal} />
        <path d="M88 0 L120 0 L132 108 L114 96 L98 112 Z" fill={escuro ? C.laranja : C.royal} opacity="0.85" />
      </svg>
      <div
        style={{
          position: "relative",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: `repeating-conic-gradient(from 0deg, ${metal[1]} 0deg 6deg, ${metal[2]} 6deg 12deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 14px 30px rgba(6,24,47,.28)",
        }}
      >
        <div
          style={{
            width: 168,
            height: 168,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, ${metal[0]}, ${metal[1]} 55%, ${metal[2]})`,
            border: "4px solid rgba(255,255,255,.65)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: C.branco,
            textShadow: "0 2px 4px rgba(0,0,0,.3)",
          }}
        >
          {colocacao ? (
            <>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 86, lineHeight: 0.9 }}>{colocacao}º</span>
              <span style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 22, letterSpacing: 2 }}>lugar</span>
            </>
          ) : (
            <svg width="86" height="86" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.87l-5.5 2.9 1.05-6.13L3.1 9.3l6.15-.9z" fill="#fff" stroke="rgba(0,0,0,.12)" strokeWidth="0.6" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function Assinatura({ nome, cargo, cor, corSuave }: { nome: string; cargo: string; cor: string; corSuave: string }) {
  return (
    <div style={{ width: 440, textAlign: "center" }}>
      <div style={{ height: 2, background: corSuave, opacity: 0.6, marginBottom: 14 }} />
      <div style={{ fontFamily: TEXTO, fontWeight: 700, fontSize: 28, color: cor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</div>
      {cargo ? <div style={{ marginTop: 4, fontFamily: TEXTO, fontWeight: 500, fontSize: 22, color: corSuave }}>{cargo}</div> : null}
    </div>
  );
}

/** Curvas da marca (laranja e lima) num canto. */
function Curvas({ canto, estilo }: { canto: "superior" | "inferior"; estilo?: CSSProperties }) {
  const giro = canto === "superior" ? "none" : "rotate(180deg)";
  return (
    <svg
      width="620"
      height="420"
      viewBox="0 0 620 420"
      aria-hidden="true"
      style={{ position: "absolute", ...(canto === "superior" ? { left: 0, top: 0 } : { right: 0, bottom: 0 }), transform: giro, ...estilo }}
    >
      <path d="M0 330 C 120 210, 300 90, 620 0 L 520 0 C 300 60, 120 170, 0 270 Z" fill={C.laranja} opacity="0.95" />
      <path d="M0 400 C 160 260, 360 130, 620 60 L 620 78 C 380 150, 180 280, 0 420 Z" fill={C.lima} />
      <path d="M0 210 C 90 130, 220 50, 380 0 L 330 0 C 190 40, 80 110, 0 170 Z" fill={C.royal} opacity="0.18" />
    </svg>
  );
}

function Corpo({
  textos,
  nome,
  colocacao,
  escuro,
  logo,
  largura = 1300,
}: {
  textos: TextosCertificado;
  nome: string;
  colocacao?: number;
  escuro: boolean;
  logo: ReactNode;
  largura?: number;
}) {
  const tinta = escuro ? C.branco : C.tinta;
  const suave = escuro ? "rgba(255,255,255,.72)" : C.tintaSuave;
  const destaque = escuro ? C.ouro : C.royal;
  const temSegunda = !!textos.assinatura2.trim();
  return (
    <div style={{ position: "relative", width: largura, height: "100%", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      {logo}
      <div style={{ marginTop: 26, fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: 150, lineHeight: 0.9, color: escuro ? C.ouro : C.marinho, letterSpacing: 1 }}>{textos.titulo}</div>
      {textos.subtitulo ? <div style={{ marginTop: 10, fontFamily: TEXTO, fontWeight: 700, fontSize: 38, letterSpacing: 5, color: C.laranja }}>{textos.subtitulo}</div> : null}
      {textos.abertura ? <div style={{ marginTop: 44, fontFamily: SERIFA, fontStyle: "italic", fontSize: 32, color: suave }}>{textos.abertura}</div> : null}
      <div style={{ marginTop: 10, fontFamily: CURSIVA, fontSize: tamanhoDoNome(nome, largura), lineHeight: 1.25, color: escuro ? C.branco : C.royal, maxWidth: largura, whiteSpace: "nowrap" }}>{nome}</div>
      <div style={{ width: 860, height: 3, borderRadius: 2, background: `linear-gradient(90deg, transparent, ${C.ouro2} 18%, ${C.ouro} 50%, ${C.ouro2} 82%, transparent)` }} />
      <div style={{ marginTop: 34, maxWidth: largura - 80, fontFamily: SERIFA, fontSize: 31, lineHeight: 1.6, color: tinta, textWrap: "balance" } as CSSProperties}>
        <Rico texto={textos.texto} cor={destaque} />
      </div>
      {temSegunda && textos.data ? <div style={{ marginTop: 22, fontFamily: TEXTO, fontWeight: 600, fontSize: 26, color: suave }}>{textos.data}</div> : null}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Assinatura nome={textos.assinatura1} cargo={textos.cargo1} cor={tinta} corSuave={suave} />
        <div style={{ marginBottom: -20 }}>
          <Selo colocacao={colocacao} escuro={escuro} />
        </div>
        {temSegunda ? (
          <Assinatura nome={textos.assinatura2} cargo={textos.cargo2} cor={tinta} corSuave={suave} />
        ) : (
          <Assinatura nome={textos.data} cargo="" cor={tinta} corSuave={suave} />
        )}
      </div>
    </div>
  );
}

export const ArteCertificado = forwardRef<HTMLDivElement, PropsCertificado>(function ArteCertificado({ layout, textos, nome, colocacao, imagem }, ref) {
  const { largura: W, altura: H } = TAMANHO_CERTIFICADO;
  const base: CSSProperties = { position: "relative", width: W, height: H, overflow: "hidden", fontFamily: TEXTO };
  // "logo-atletas-claro" é a versão para fundo claro (Energisa em azul); a da reunião tem o Energisa branco.
  const logoClaro = <img src="/convites/logo-atletas-claro.png" alt="" style={{ height: 116, width: "auto" }} />;
  const logoEscuro = <img src="/reuniao/logo-atletas.webp" alt="" style={{ height: 120, width: "auto" }} />;

  if (layout === "podio") {
    return (
      <div ref={ref} style={{ ...base, background: `radial-gradient(ellipse 70% 55% at 50% 0%, rgba(245,197,66,.22), transparent 70%), linear-gradient(165deg, ${C.marinho2} 0%, ${C.marinho} 75%)` }}>
        <div style={{ position: "absolute", inset: 40, border: `3px solid ${C.ouro}`, borderRadius: 10 }} />
        <div style={{ position: "absolute", inset: 56, border: "1px solid rgba(245,197,66,.45)", borderRadius: 6 }} />
        <Curvas canto="superior" estilo={{ opacity: 0.85 }} />
        <div style={{ position: "absolute", inset: "110px 150px 100px" }}>
          <Corpo textos={textos} nome={nome} colocacao={colocacao} escuro logo={logoEscuro} />
        </div>
      </div>
    );
  }

  if (layout === "marca") {
    // Os atletas da arte ficam à esquerda; o texto, num painel à direita.
    return (
      <div ref={ref} style={{ ...base, background: C.papel }}>
        <img src="/reuniao/fundo-claro.webp" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "20% 50%" }} />
        <div style={{ position: "absolute", top: 70, bottom: 70, right: 70, left: 470, borderRadius: 36, background: "rgba(255,255,255,.92)", boxShadow: "0 30px 60px rgba(6,24,47,.16)" }} />
        <div style={{ position: "absolute", top: 120, bottom: 110, right: 110, left: 510 }}>
          <Corpo textos={textos} nome={nome} colocacao={colocacao} escuro={false} logo={logoClaro} largura={1134} />
        </div>
      </div>
    );
  }

  if (layout === "imagem") {
    return (
      <div ref={ref} style={{ ...base, background: C.marinho }}>
        {imagem ? <img src={imagem} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        <div style={{ position: "absolute", inset: "70px 120px", borderRadius: 36, background: "rgba(255,255,255,.9)", boxShadow: "0 30px 60px rgba(6,24,47,.22)" }} />
        <div style={{ position: "absolute", inset: "115px 170px 110px" }}>
          <Corpo textos={textos} nome={nome} colocacao={colocacao} escuro={false} logo={logoClaro} largura={1414} />
        </div>
      </div>
    );
  }

  // Clássico: papel claro, moldura dupla e as curvas da marca nos cantos.
  return (
    <div ref={ref} style={{ ...base, background: `radial-gradient(ellipse 80% 70% at 50% 45%, ${C.branco}, ${C.papel} 70%, #e9f1f9)` }}>
      <Curvas canto="superior" />
      <Curvas canto="inferior" />
      <div style={{ position: "absolute", inset: 44, border: `3px solid ${C.marinho}`, borderRadius: 8 }} />
      <div style={{ position: "absolute", inset: 58, border: `1.5px solid ${C.ouro2}`, borderRadius: 4 }} />
      <div style={{ position: "absolute", inset: "110px 150px 100px" }}>
        <Corpo textos={textos} nome={nome} colocacao={colocacao} escuro={false} logo={logoClaro} />
      </div>
    </div>
  );
});

