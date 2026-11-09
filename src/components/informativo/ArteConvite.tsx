/* eslint-disable @next/next/no-img-element -- a arte vira PNG no navegador; <img> simples é o que o html-to-image copia de forma fiel. */
"use client";

import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/800-italic.css";
import "@fontsource/barlow-condensed/900-italic.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/kaushan-script/400.css";
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { DIMENSOES_CONVITE, FAIXAS, arquivoDoFundo, trechos, type FaixaConvite, type FundoConvite, type FormatoConvite, type LayoutConvite, type TextosConvite } from "@/lib/convite";

/*
 * Convite de evento em pixels reais (1080 × 1350 ou 1080 × 1920). Cores fixas
 * de propósito: a peça sai igual com o portal no tema claro ou escuro. Os
 * fundos são ilustrações vetoriais próprias (nada de foto de banco de imagem):
 * pista, percurso, largada e pódio, nas cores do programa.
 */

const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const TEXTO = "'Barlow', 'Helvetica Neue', Arial, sans-serif";
const CURSIVA = "'Kaushan Script', 'Brush Script MT', cursive";

const C = {
  marinho: "#06182f",
  marinho2: "#0a2a52",
  royal: "#0b4f9c",
  azul: "#009bc1",
  ceu: "#e9f5fc",
  ceu2: "#d3ebf8",
  lima: "#b9d531",
  laranja: "#f37021",
  verde: "#00b37e",
  ouro: "#f5c542",
  ouro2: "#d9a21b",
  tinta: "#10294a",
  tintaSuave: "#3b5578",
  branco: "#ffffff",
};

export interface PropsConvite {
  layout: LayoutConvite;
  formato: FormatoConvite;
  textos: TextosConvite;
  faixa: FaixaConvite;
  /** QR code (data URL) para confirmar presença; vazio = sem QR. */
  qr: string;
  /** Foto de fundo do layout "Sua foto" (data URL ou endereço). */
  foto: string;
  /** Fundo fotográfico no lugar da ilustração do layout; null = ilustração. */
  fundo?: FundoConvite | null;
}

/** Fundo fotográfico com um véu para o texto continuar legível. */
function FundoImagem({ fundo, veu }: { fundo: FundoConvite; veu: "claro" | "escuro" }) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <img src={arquivoDoFundo(fundo)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: fundo.foco }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            veu === "claro"
              ? "radial-gradient(ellipse 75% 55% at 50% 45%, rgba(247,251,254,0.78) 0%, rgba(247,251,254,0.6) 55%, rgba(247,251,254,0.15) 100%)"
              : "linear-gradient(180deg, rgba(6,24,47,0.35) 0%, rgba(6,24,47,0.55) 28%, rgba(6,24,47,0.62) 70%, rgba(6,24,47,0.4) 100%)",
        }}
      />
    </div>
  );
}

/* ---------- Peças de texto ---------- */

/** Título numa linha só quando dá: a fonte diminui até caber na largura (estimativa da Barlow Condensed itálica). */
function tamanhoTitulo(texto: string, largura: number, maximo: number) {
  return Math.max(70, Math.min(maximo, Math.floor(largura / Math.max(1, texto.length * 0.47))));
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

/** Ícones desenhados à mão (traço grosso, cantos redondos), iguais em todas as artes. */
function Icone({ tipo, cor, tamanho }: { tipo: "data" | "hora" | "local"; cor: string; tamanho: number }) {
  const comum = { fill: "none", stroke: cor, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
      {tipo === "data" ? (
        <>
          <rect x="3" y="4.5" width="18" height="16.5" rx="3" {...comum} />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" {...comum} />
          <path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2" {...comum} strokeWidth={2.6} />
        </>
      ) : tipo === "hora" ? (
        <>
          <circle cx="12" cy="12" r="9" {...comum} />
          <path d="M12 7v5l3.2 2" {...comum} />
        </>
      ) : (
        <>
          <path d="M12 21.5s-7-6.3-7-12a7 7 0 0 1 14 0c0 5.7-7 12-7 12z" {...comum} />
          <circle cx="12" cy="9.5" r="2.6" {...comum} />
        </>
      )}
    </svg>
  );
}

function Selo({ faixa, estilo }: { faixa: FaixaConvite; estilo?: CSSProperties }) {
  if (!faixa) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        right: 60,
        width: 230,
        height: 230,
        borderRadius: "50%",
        background: C.lima,
        color: C.marinho,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        transform: "rotate(-12deg)",
        boxShadow: "0 18px 40px rgba(6,24,47,0.35), inset 0 0 0 8px rgba(255,255,255,0.35)",
        fontFamily: DISPLAY,
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: 54,
        lineHeight: 0.95,
        textTransform: "uppercase",
        padding: 26,
        zIndex: 5,
        ...estilo,
      }}
    >
      {FAIXAS[faixa]}
    </div>
  );
}

function BlocoQr({ qr, claro, legenda = "Confirme sua presença" }: { qr: string; claro: boolean; legenda?: string }) {
  if (!qr) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ background: C.branco, borderRadius: 18, padding: 10, boxShadow: claro ? "0 8px 24px rgba(16,41,74,0.15)" : "none" }}>
        <img src={qr} alt="" width={132} height={132} style={{ display: "block", width: 132, height: 132 }} />
      </div>
      <div style={{ fontFamily: TEXTO, fontSize: 22, lineHeight: 1.25, color: claro ? C.tintaSuave : "rgba(255,255,255,0.8)", maxWidth: 170 }}>
        <span style={{ fontWeight: 700, color: claro ? C.tinta : C.branco }}>{legenda}</span>
        <br />
        aponte a câmera
      </div>
    </div>
  );
}

/** Traço de pincel laranja sob a assinatura. */
function Pincelada({ largura, cor }: { largura: number; cor: string }) {
  return (
    <svg width={largura} height={26} viewBox="0 0 600 26" preserveAspectRatio="none" aria-hidden="true" style={{ display: "block" }}>
      <path d="M6 17 C 120 6, 300 4, 594 12 C 420 13, 220 16, 40 23 Z" fill={cor} />
    </svg>
  );
}

/* ---------- Fundos (ilustrações próprias) ---------- */

/** Pontilhado em degradê, como uma retícula de impressão. */
function Reticula({ cor, x, y, colunas, linhas, passo, estilo }: { cor: string; x: number; y: number; colunas: number; linhas: number; passo: number; estilo?: CSSProperties }) {
  const pontos: ReactNode[] = [];
  for (let i = 0; i < colunas; i++) {
    for (let j = 0; j < linhas; j++) {
      const r = Math.max(0, passo * 0.32 * (1 - (i / colunas) * 0.55 - (j / linhas) * 0.75));
      if (r > 0.6) pontos.push(<circle key={`${i}-${j}`} cx={x + i * passo} cy={y + j * passo} r={r} fill={cor} />);
    }
  }
  return <g style={estilo}>{pontos}</g>;
}

function FundoCelebracao({ altura, soOnda = false }: { altura: number; soOnda?: boolean }) {
  const W = 1080;
  const H = altura;
  // No feed a onda é mais baixa: sobra altura para o conteúdo.
  const k = H > 1500 ? 1 : 0.72;
  const b = (n: number) => H - n * k;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <defs>
        <linearGradient id="cel-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7fbfe" />
          <stop offset="0.55" stopColor={C.ceu} />
          <stop offset="1" stopColor={C.ceu2} />
        </linearGradient>
        <linearGradient id="cel-onda" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.royal} />
          <stop offset="1" stopColor={C.azul} />
        </linearGradient>
        <radialGradient id="cel-luz" cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {soOnda ? null : (
        <>
      <rect width={W} height={H} fill="url(#cel-ceu)" />
      {/* Raias de pista, bem suaves, atrás do conteúdo */}
      {Array.from({ length: 7 }, (_, i) => (
        <ellipse key={i} cx={W / 2} cy={H * 0.52} rx={620 + i * 46} ry={H * 0.36 + i * 46} fill="none" stroke={C.azul} strokeOpacity={0.07} strokeWidth={i === 0 ? 4 : 2} />
      ))}
      <ellipse cx={W / 2} cy={H * 0.42} rx={560} ry={H * 0.34} fill="url(#cel-luz)" />
      {/* Arcos do canto superior esquerdo */}
      <path d={`M -40 ${H * 0.36} C 60 ${H * 0.16}, 220 40, 470 -40`} fill="none" stroke={C.lima} strokeWidth="26" strokeLinecap="round" />
      <path d={`M -40 ${H * 0.43} C 90 ${H * 0.2}, 260 70, 560 -40`} fill="none" stroke={C.laranja} strokeWidth="10" strokeLinecap="round" />
      <path d={`M -40 ${H * 0.5} C 120 ${H * 0.24}, 300 96, 640 -40`} fill="none" stroke={C.azul} strokeOpacity="0.5" strokeWidth="3" />
      {/* Retícula no canto superior direito */}
      <Reticula cor={C.azul} x={760} y={40} colunas={12} linhas={9} passo={26} estilo={{ opacity: 0.35 }} />
        </>
      )}
      {/* Ondas da base */}
      <path d={`M 0 ${b(210)} C 260 ${b(300)}, 640 ${b(120)}, ${W} ${b(250)} L ${W} ${H} L 0 ${H} Z`} fill="url(#cel-onda)" />
      <path d={`M 0 ${b(236)} C 280 ${b(330)}, 650 ${b(150)}, ${W} ${b(282)}`} fill="none" stroke={C.lima} strokeWidth="12" />
      <path d={`M 0 ${b(258)} C 300 ${b(352)}, 660 ${b(172)}, ${W} ${b(306)}`} fill="none" stroke={C.laranja} strokeWidth="6" />
      <path d={`M 0 ${b(150)} C 300 ${b(220)}, 700 ${b(60)}, ${W} ${b(170)}`} fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" />
    </svg>
  );
}

function FundoLargada({ altura }: { altura: number }) {
  const W = 1080;
  const H = altura;
  const rastros = [
    { y: 0.18, cor: C.lima, op: 0.55, w: 5, len: 520 },
    { y: 0.22, cor: C.azul, op: 0.5, w: 3, len: 760 },
    { y: 0.27, cor: C.laranja, op: 0.6, w: 4, len: 420 },
    { y: 0.62, cor: C.azul, op: 0.35, w: 2, len: 900 },
    { y: 0.66, cor: C.lima, op: 0.45, w: 3, len: 600 },
    { y: 0.7, cor: C.laranja, op: 0.4, w: 2, len: 380 },
  ];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <defs>
        <linearGradient id="lar-fundo" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={C.marinho2} />
          <stop offset="1" stopColor={C.marinho} />
        </linearGradient>
        <radialGradient id="lar-brilho" cx="0.85" cy="0.12" r="0.7">
          <stop offset="0" stopColor={C.azul} stopOpacity="0.55" />
          <stop offset="1" stopColor={C.azul} stopOpacity="0" />
        </radialGradient>
        {rastros.map((r, i) => (
          <linearGradient key={i} id={`lar-r${i}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={r.cor} stopOpacity="0" />
            <stop offset="1" stopColor={r.cor} stopOpacity={r.op} />
          </linearGradient>
        ))}
      </defs>
      <rect width={W} height={H} fill="url(#lar-fundo)" />
      <rect width={W} height={H} fill="url(#lar-brilho)" />
      {/* Raias em perspectiva, saindo do canto */}
      <g transform={`translate(${W} ${H}) rotate(-24)`} opacity="0.16">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={-1700} y1={-i * 120} x2={200} y2={-i * 120} stroke="#ffffff" strokeWidth={i === 0 ? 6 : 2} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <text key={i} x={-560} y={-i * 120 - 30} fill="#ffffff" fontFamily={DISPLAY} fontWeight={800} fontStyle="italic" fontSize="86" opacity="0.7">
            {i + 1}
          </text>
        ))}
      </g>
      {/* Rastros de velocidade */}
      <g transform="rotate(-8 540 0)">
        {rastros.map((r, i) => (
          <rect key={i} x={W - r.len + 120} y={H * r.y} width={r.len} height={r.w} rx={r.w / 2} fill={`url(#lar-r${i})`} />
        ))}
      </g>
      {/* Faixa quadriculada de largada */}
      <g transform={`translate(0 ${H - 118}) skewY(-4)`}>
        {Array.from({ length: 2 }, (_, l) =>
          Array.from({ length: 28 }, (_, c) => (
            <rect key={`${l}-${c}`} x={c * 40} y={l * 40} width={40} height={40} fill={(c + l) % 2 ? "#ffffff" : "transparent"} fillOpacity={0.9} />
          )),
        )}
        <rect x={0} y={-12} width={W + 40} height={8} fill={C.lima} />
      </g>
    </svg>
  );
}

/** Curva de nível irregular, mas determinística. */
function curvaDeNivel(cx: number, cy: number, r: number, fase: number) {
  const pontos: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rr = r * (1 + 0.09 * Math.sin(a * 3 + fase) + 0.05 * Math.cos(a * 5 + fase * 1.7));
    pontos.push(`${(cx + Math.cos(a) * rr * 1.25).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M ${pontos.join(" L ")} Z`;
}

function FundoPercurso({ altura }: { altura: number }) {
  const W = 1080;
  const H = altura;
  const rota = `M -40 ${H * 0.86} C 180 ${H * 0.8}, 160 ${H * 0.62}, 360 ${H * 0.6} S 640 ${H * 0.74}, 820 ${H * 0.62} S 1000 ${H * 0.3}, 1120 ${H * 0.26}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <defs>
        <linearGradient id="per-fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.azul} />
          <stop offset="0.55" stopColor={C.royal} />
          <stop offset="1" stopColor={C.marinho2} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#per-fundo)" />
      {/* Mapa topográfico */}
      <g fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={`a${i}`} d={curvaDeNivel(860, H * 0.2, 60 + i * 52, i * 0.7)} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <path key={`b${i}`} d={curvaDeNivel(120, H * 0.82, 50 + i * 56, i * 0.9 + 2)} />
        ))}
      </g>
      {/* Percurso tracejado com marcos de km */}
      <path d={rota} fill="none" stroke={C.marinho} strokeOpacity="0.35" strokeWidth="18" strokeLinecap="round" />
      <path d={rota} fill="none" stroke={C.laranja} strokeWidth="7" strokeDasharray="22 16" strokeLinecap="round" />
      {[
        [360, 0.6, "5"],
        [820, 0.62, "10"],
      ].map(([x, y, km]) => (
        <g key={String(km)} transform={`translate(${x} ${H * Number(y)})`}>
          <circle r="26" fill={C.branco} />
          <circle r="26" fill="none" stroke={C.laranja} strokeWidth="5" />
          <text textAnchor="middle" y="9" fontFamily={DISPLAY} fontWeight={800} fontSize="26" fill={C.tinta}>
            {km}
          </text>
        </g>
      ))}
      {/* Bandeira de chegada */}
      <g transform={`translate(1000 ${H * 0.29})`}>
        <line x1="0" y1="0" x2="0" y2="-92" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
        {Array.from({ length: 3 }, (_, l) =>
          Array.from({ length: 4 }, (_, c) => <rect key={`${l}-${c}`} x={c * 16} y={-92 + l * 16} width="16" height="16" fill={(c + l) % 2 ? C.marinho : "#ffffff"} />),
        )}
      </g>
    </svg>
  );
}

function confete(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function FundoPodio({ altura }: { altura: number }) {
  const W = 1080;
  const H = altura;
  const r = confete(42);
  const pecas = Array.from({ length: 70 }, () => ({
    x: r() * W,
    y: r() * H * 0.42,
    w: 8 + r() * 14,
    h: 14 + r() * 18,
    giro: r() * 360,
    cor: [C.ouro, C.ouro, "#fff3c4", C.lima, C.laranja][Math.floor(r() * 5)],
    op: 0.35 + r() * 0.55,
  }));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <defs>
        <radialGradient id="pod-fundo" cx="0.5" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#123a73" />
          <stop offset="0.6" stopColor={C.marinho2} />
          <stop offset="1" stopColor={C.marinho} />
        </radialGradient>
        <linearGradient id="pod-feixe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pod-ouro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor={C.ouro2} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#pod-fundo)" />
      {/* Feixes de luz */}
      <polygon points={`60,0 230,0 ${W * 0.56},${H * 0.75} ${W * 0.3},${H * 0.75}`} fill="url(#pod-feixe)" opacity="0.7" />
      <polygon points={`${W - 230},0 ${W - 60},0 ${W * 0.7},${H * 0.75} ${W * 0.44},${H * 0.75}`} fill="url(#pod-feixe)" opacity="0.7" />
      {/* Louros */}
      <g transform={`translate(${W / 2} ${H * 0.5})`} opacity="0.13" fill="url(#pod-ouro)">
        {[-1, 1].map((lado) =>
          Array.from({ length: 13 }, (_, i) => {
            const a = (Math.PI * (0.62 + i * 0.058)) * lado;
            const raio = 430;
            const x = Math.sin(a) * raio;
            const y = Math.cos(a) * raio;
            return <ellipse key={`${lado}-${i}`} cx={x} cy={y} rx="22" ry="58" transform={`rotate(${(-a * 180) / Math.PI + 30 * lado} ${x} ${y})`} />;
          }),
        )}
      </g>
      {/* Confete */}
      {pecas.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx="2" fill={p.cor} opacity={p.op} transform={`rotate(${p.giro} ${p.x} ${p.y})`} />
      ))}
      {/* Degraus do pódio na base */}
      <g transform={`translate(${W / 2} ${H})`} fill="#ffffff" fillOpacity="0.06">
        <rect x={-150} y={-150} width={300} height={150} />
        <rect x={-450} y={-100} width={300} height={100} />
        <rect x={150} y={-70} width={300} height={70} />
      </g>
      <rect x={0} y={H - 10} width={W} height={10} fill="url(#pod-ouro)" />
    </svg>
  );
}

function FundoFoto({ foto, altura }: { foto: string; altura: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${C.royal}, ${C.marinho})` }}>
      {foto ? <img src={foto} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      {/* Tinta da marca sobre a foto e escurecimento para o texto */}
      <div style={{ position: "absolute", inset: 0, background: C.royal, mixBlendMode: "multiply", opacity: 0.35 }} />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(6,24,47,0.55) 0%, rgba(6,24,47,0) 26%, rgba(6,24,47,0.15) 42%, rgba(6,24,47,0.92) ${altura > 1500 ? 66 : 70}%, ${C.marinho} 100%)` }} />
      <svg width={1080} height={altura} viewBox={`0 0 1080 ${altura}`} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <path d={`M -20 ${altura * 0.2} C 300 ${altura * 0.12}, 700 ${altura * 0.26}, 1100 ${altura * 0.08}`} fill="none" stroke={C.lima} strokeWidth="10" />
        <path d={`M -20 ${altura * 0.22} C 300 ${altura * 0.15}, 700 ${altura * 0.29}, 1100 ${altura * 0.11}`} fill="none" stroke={C.laranja} strokeWidth="5" />
      </svg>
    </div>
  );
}

/* ---------- Layouts ---------- */

const raiz = (altura: number, fundo: string): CSSProperties => ({
  position: "relative",
  width: 1080,
  height: altura,
  overflow: "hidden",
  background: fundo,
  fontFamily: TEXTO,
  boxSizing: "border-box",
});

const coluna = (estilo: CSSProperties): CSSProperties => ({ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", ...estilo });

function Celebracao({ textos: t, faixa, qr, altura, fundo }: PropsConvite & { altura: number }) {
  const story = altura > 1500;
  // Sobre foto, um halo branco garante a leitura sem apagar a imagem.
  const halo = fundo ? "0 0 14px rgba(255,255,255,0.95), 0 0 4px rgba(255,255,255,0.9)" : undefined;
  const [primeira, ...resto] = t.chamada.trim().split(/\s+/);
  const info = [
    { tipo: "data" as const, valor: t.data, sub: t.diaSemana, cor: C.royal },
    { tipo: "hora" as const, valor: t.hora, sub: "", cor: C.laranja },
    { tipo: "local" as const, valor: t.local, sub: "", cor: C.azul },
  ].filter((i) => i.valor);
  return (
    <div style={raiz(altura, C.ceu)}>
      {fundo ? <FundoImagem fundo={fundo} veu="claro" /> : null}
      <FundoCelebracao altura={altura} soOnda={!!fundo} />
      <Selo faixa={faixa} estilo={{ top: story ? 90 : 60, right: 50 }} />
      <div data-conteudo style={coluna({ alignItems: "center", textAlign: "center", padding: story ? "110px 80px 300px" : "52px 70px 196px", justifyContent: "space-between" })}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: story ? 34 : 16 }}>
          <img src="/convites/logo-atletas-claro.png" alt="" style={{ width: story ? 440 : 330, height: "auto", display: "block" }} />
          {t.chamada ? (
            <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "0.22em", textTransform: "uppercase", color: C.tinta }}>
              <span style={{ width: 70, height: 3, background: C.azul, opacity: 0.6 }} />
              <span>
                <span style={{ color: C.azul }}>{primeira}</span> {resto.join(" ")}
              </span>
              <span style={{ width: 70, height: 3, background: C.azul, opacity: 0.6 }} />
            </div>
          ) : null}
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: tamanhoTitulo(t.titulo, 900, story ? 168 : 146), lineHeight: 0.9, textTransform: "uppercase", color: C.royal, letterSpacing: "-0.01em", textShadow: "0 6px 0 rgba(0,155,193,0.18)" }}>
            {t.titulo}
          </h1>
          {t.selo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: 40, color: C.azul, letterSpacing: "-0.12em" }}>{"///"}</span>
              <span style={{ border: `4px solid ${C.laranja}`, borderRadius: 14, padding: "10px 30px", background: C.branco, fontFamily: DISPLAY, fontWeight: 800, fontSize: 42, textTransform: "uppercase", color: C.tinta, lineHeight: 1.1 }}>
                {t.selo}
              </span>
            </div>
          ) : null}
        </div>

        {t.texto ? <p style={{ margin: 0, fontSize: story ? 40 : 32, lineHeight: 1.38, color: fundo ? C.tinta : C.tintaSuave, textShadow: halo, maxWidth: 880, fontWeight: 500 }}><Rico texto={t.texto} cor={C.royal} /></p> : null}

        {info.length ? (
          <div style={{ display: "flex", gap: 24, justifyContent: "center", width: "100%" }}>
            {info.map((i) => (
              <div key={i.tipo} style={{ flex: i.tipo === "local" ? 1.25 : 1, maxWidth: 330, background: "rgba(255,255,255,0.92)", border: `2px solid ${C.ceu2}`, borderRadius: 28, padding: story ? "34px 18px" : "20px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: story ? 10 : 6, boxShadow: "0 14px 34px rgba(11,79,156,0.12)" }}>
                <Icone tipo={i.tipo} cor={i.cor} tamanho={story ? 64 : 48} />
                <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: i.tipo === "local" ? (i.valor.length > 22 ? 34 : 42) : story ? 70 : 62, lineHeight: 1, color: C.tinta }}>{i.valor}</span>
                {i.sub ? <span style={{ fontSize: 24, color: C.tintaSuave, fontWeight: 600 }}>{i.sub}</span> : null}
              </div>
            ))}
          </div>
        ) : null}

        {t.texto2 ? <p style={{ margin: 0, fontSize: story ? 36 : 29, lineHeight: 1.38, color: fundo ? C.tinta : C.tintaSuave, textShadow: halo, maxWidth: 820, fontWeight: 500 }}><Rico texto={t.texto2} cor={C.royal} /></p> : null}

        {t.assinatura ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontFamily: CURSIVA, fontSize: story ? 70 : 54, color: C.tinta, lineHeight: 1.2, textShadow: halo }}>{t.assinatura}</span>
            <Pincelada largura={Math.min(760, t.assinatura.length * 22)} cor={C.laranja} />
          </div>
        ) : null}
      </div>
      {/* Rodapé sobre a onda */}
      <div style={{ position: "absolute", zIndex: 3, left: 70, right: 70, bottom: story ? 70 : 34, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 30 }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.9)", maxWidth: 420, lineHeight: 1.3 }}>{t.rodape}</span>
        <BlocoQr qr={qr} claro={false} />
      </div>
    </div>
  );
}

function Largada({ textos: t, faixa, qr, altura, fundo }: PropsConvite & { altura: number }) {
  const story = altura > 1500;
  const linhaQuando = [t.diaSemana, t.hora].filter(Boolean).join(", às ");
  return (
    <div style={raiz(altura, C.marinho)}>
      {fundo ? <FundoImagem fundo={fundo} veu="escuro" /> : <FundoLargada altura={altura} />}
      <Selo faixa={faixa} estilo={{ top: story ? 120 : 70, right: 60 }} />
      <div data-conteudo style={coluna({ padding: story ? "120px 84px 220px" : "60px 80px 170px", justifyContent: "space-between" })}>
        <div style={{ display: "flex", flexDirection: "column", gap: story ? 40 : 20 }}>
          <img src="/logos/logo-comite-branca-trim.png" alt="" style={{ width: story ? 260 : 190, height: "auto", display: "block" }} />
          {t.chamada ? <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "0.2em", textTransform: "uppercase", color: C.lima }}>{t.chamada}</span> : null}
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: (t.selo || t.titulo).length > 26 ? (story ? 104 : 92) : story ? 128 : 112, lineHeight: 0.92, textTransform: "uppercase", color: C.branco, maxWidth: faixa ? 700 : 900 }}>
            {t.selo || t.titulo}
          </h1>
          {t.selo && t.titulo ? <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginTop: -8 }}>{t.titulo}</span> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {t.data ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
              <span style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: story ? 300 : 250, lineHeight: 0.78, color: C.lima, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>{t.data}</span>
              {linhaQuando ? <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 50 : 44, lineHeight: 1, color: C.branco, textTransform: "uppercase", paddingBottom: 6, maxWidth: 330 }}>{linhaQuando}</span> : null}
            </div>
          ) : null}
          {t.local ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 38, fontWeight: 700, color: C.branco }}>
              <Icone tipo="local" cor={C.laranja} tamanho={46} />
              {t.local}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 900 }}>
          {t.texto ? <p style={{ margin: 0, fontSize: story ? 34 : 31, lineHeight: 1.38, color: "rgba(255,255,255,0.82)", fontWeight: 500 }}><Rico texto={t.texto} cor={C.lima} /></p> : null}
          {story && t.texto2 ? <p style={{ margin: 0, fontSize: 30, lineHeight: 1.4, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}><Rico texto={t.texto2} cor={C.branco} /></p> : null}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 30, marginTop: 10 }}>
            {t.assinatura ? <span style={{ fontFamily: CURSIVA, fontSize: story ? 58 : 50, color: C.laranja, lineHeight: 1.2 }}>{t.assinatura}</span> : <span />}
            <BlocoQr qr={qr} claro={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Alfinete({ estilo }: { estilo: CSSProperties }) {
  return (
    <svg width="74" height="30" viewBox="0 0 74 30" style={{ position: "absolute", ...estilo }} aria-hidden="true">
      <defs>
        <linearGradient id="alf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f5f8" />
          <stop offset="1" stopColor="#8d99a8" />
        </linearGradient>
      </defs>
      <path d="M8 15 H62 A8 8 0 0 0 62 7 H18" fill="none" stroke="url(#alf)" strokeWidth="4" strokeLinecap="round" />
      <path d="M8 15 H64 A8 8 0 0 0 64 23 H20" fill="none" stroke="url(#alf)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="9" cy="15" r="7" fill="url(#alf)" />
    </svg>
  );
}

function NumeroDePeito({ textos: t, faixa, qr, altura, fundo }: PropsConvite & { altura: number }) {
  const story = altura > 1500;
  return (
    <div style={raiz(altura, C.royal)}>
      {fundo ? <FundoImagem fundo={fundo} veu="escuro" /> : <FundoPercurso altura={altura} />}
      <Selo faixa={faixa} estilo={{ top: story ? 110 : 56, right: 50 }} />
      <div data-conteudo style={coluna({ alignItems: "center", textAlign: "center", padding: story ? "120px 80px 120px" : "64px 80px 70px", justifyContent: "space-between" })}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {t.chamada ? <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "0.2em", textTransform: "uppercase", color: C.lima }}>{t.chamada}</span> : null}
          <span style={{ fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: 80, lineHeight: 0.95, textTransform: "uppercase", color: C.branco }}>{t.titulo}</span>
        </div>

        {/* O número de peito */}
        <div style={{ position: "relative", transform: "rotate(-3deg)", width: 820, background: C.branco, borderRadius: 30, boxShadow: "0 30px 60px rgba(6,24,47,0.45)", overflow: "visible" }}>
          <Alfinete estilo={{ top: -8, left: 26, transform: "rotate(-8deg)" }} />
          <Alfinete estilo={{ top: -8, right: 26, transform: "scaleX(-1) rotate(-8deg)" }} />
          <div style={{ borderRadius: "30px 30px 0 0", background: `linear-gradient(90deg, ${C.royal}, ${C.azul} 60%, ${C.verde})`, padding: "30px 40px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <img src="/logos/logo-comite-branca-trim.png" alt="" style={{ height: 64, width: "auto", display: "block" }} />
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 32, letterSpacing: "0.12em", textTransform: "uppercase", color: C.branco }}>{t.diaSemana || "Atleta"}</span>
          </div>
          <div style={{ padding: story ? "30px 40px 18px" : "18px 40px 8px", fontFamily: DISPLAY, fontWeight: 900, fontSize: story ? 290 : 250, lineHeight: 0.95, color: C.tinta, letterSpacing: "-0.02em" }}>{t.data || "DD/MM"}</div>
          {t.hora ? <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, color: C.laranja, textTransform: "uppercase", paddingBottom: 18 }}>{t.hora}</div> : null}
          <div style={{ borderTop: `4px dashed ${C.ceu2}`, margin: "0 30px", padding: "22px 10px 30px", fontFamily: DISPLAY, fontWeight: 800, fontSize: t.selo.length > 30 ? 40 : 50, lineHeight: 1.05, textTransform: "uppercase", color: C.royal }}>{t.selo}</div>
          <Alfinete estilo={{ bottom: -8, left: 26, transform: "rotate(8deg)" }} />
          <Alfinete estilo={{ bottom: -8, right: 26, transform: "scaleX(-1) rotate(8deg)" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: story ? 26 : 18 }}>
          {t.local ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 38, fontWeight: 700, color: C.branco }}>
              <Icone tipo="local" cor={C.lima} tamanho={44} />
              {t.local}
            </div>
          ) : null}
          {t.texto ? <p style={{ margin: 0, fontSize: 32, lineHeight: 1.4, color: "rgba(255,255,255,0.85)", maxWidth: 860, fontWeight: 500 }}><Rico texto={t.texto} cor={C.lima} /></p> : null}
          {story && t.texto2 ? <p style={{ margin: 0, fontSize: 30, lineHeight: 1.4, color: "rgba(255,255,255,0.72)", maxWidth: 820, fontWeight: 500 }}><Rico texto={t.texto2} cor={C.branco} /></p> : null}
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            {t.assinatura ? <span style={{ fontFamily: CURSIVA, fontSize: 54, color: C.branco, lineHeight: 1.2 }}>{t.assinatura}</span> : null}
            <BlocoQr qr={qr} claro={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Podio({ textos: t, faixa, qr, altura, fundo }: PropsConvite & { altura: number }) {
  const story = altura > 1500;
  const info = [
    { tipo: "data" as const, valor: t.data, sub: t.diaSemana },
    { tipo: "hora" as const, valor: t.hora, sub: "" },
    { tipo: "local" as const, valor: t.local, sub: "" },
  ].filter((i) => i.valor);
  return (
    <div style={raiz(altura, C.marinho)}>
      {fundo ? <FundoImagem fundo={fundo} veu="escuro" /> : <FundoPodio altura={altura} />}
      <Selo faixa={faixa} estilo={{ top: story ? 110 : 60, right: 50, background: C.ouro }} />
      <div data-conteudo style={coluna({ alignItems: "center", textAlign: "center", padding: story ? "130px 80px 160px" : "70px 80px 100px", justifyContent: "space-between" })}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <img src="/logos/logo-comite-branca-trim.png" alt="" style={{ width: story ? 260 : 220, height: "auto", display: "block" }} />
          {t.chamada ? <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ouro }}>{t.chamada}</span> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: story ? 170 : 150, lineHeight: 0.88, textTransform: "uppercase", color: C.branco, textShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>{t.titulo}</h1>
          {t.selo ? (
            <div style={{ position: "relative", padding: "18px 70px", background: `linear-gradient(180deg, #ffe08a, ${C.ouro} 50%, ${C.ouro2})`, clipPath: "polygon(0 0, 100% 0, 96% 50%, 100% 100%, 0 100%, 4% 50%)", fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, textTransform: "uppercase", color: C.marinho, lineHeight: 1.1 }}>
              {t.selo}
            </div>
          ) : null}
        </div>
        {t.texto ? <p style={{ margin: 0, fontSize: story ? 38 : 34, lineHeight: 1.42, color: "rgba(255,255,255,0.85)", maxWidth: 860, fontWeight: 500 }}><Rico texto={t.texto} cor={C.ouro} /></p> : null}
        {info.length ? (
          <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", border: `2px solid rgba(245,197,66,0.45)`, borderRadius: 26, background: "rgba(6,24,47,0.45)" }}>
            {info.map((i, n) => (
              <div key={i.tipo} style={{ display: "flex", alignItems: "center", gap: 14, padding: "24px 30px", borderLeft: n ? "2px solid rgba(245,197,66,0.3)" : "none" }}>
                <Icone tipo={i.tipo} cor={C.ouro} tamanho={44} />
                <span style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                  <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: i.valor.length > 20 ? 34 : 42, color: C.branco, textTransform: i.tipo === "local" ? "none" : "uppercase", lineHeight: 1.05, maxWidth: 360 }}>{i.valor}</span>
                  {i.sub ? <span style={{ fontSize: 22, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{i.sub}</span> : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {t.texto2 ? <p style={{ margin: 0, fontSize: 30, lineHeight: 1.4, color: "rgba(255,255,255,0.7)", maxWidth: 820, fontWeight: 500 }}><Rico texto={t.texto2} cor={C.branco} /></p> : null}
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {t.assinatura ? <span style={{ fontFamily: CURSIVA, fontSize: 60, color: C.ouro, lineHeight: 1.2 }}>{t.assinatura}</span> : null}
          <BlocoQr qr={qr} claro={false} />
        </div>
      </div>
    </div>
  );
}

function SuaFoto({ textos: t, faixa, qr, foto, altura }: PropsConvite & { altura: number }) {
  const story = altura > 1500;
  const chips = [
    { tipo: "data" as const, valor: [t.data, t.diaSemana].filter(Boolean).join(", ") },
    { tipo: "hora" as const, valor: t.hora },
    { tipo: "local" as const, valor: t.local },
  ].filter((i) => i.valor);
  return (
    <div style={raiz(altura, C.marinho)}>
      <FundoFoto foto={foto} altura={altura} />
      <Selo faixa={faixa} estilo={{ top: story ? 110 : 60, right: 50 }} />
      <div data-conteudo style={coluna({ padding: story ? "100px 80px 120px" : "60px 80px 70px", justifyContent: "space-between" })}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src="/logos/logo-comite-branca-trim.png" alt="" style={{ width: 200, height: "auto", display: "block" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: story ? 30 : 22 }}>
          {t.chamada ? <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: "0.2em", textTransform: "uppercase", color: C.lima }}>{t.chamada}</span> : null}
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 900, fontSize: (t.selo || t.titulo).length > 26 ? 106 : 132, lineHeight: 0.9, textTransform: "uppercase", color: C.branco }}>{t.selo || t.titulo}</h1>
          {chips.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {chips.map((c) => (
                <span key={c.tipo} style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.14)", border: "2px solid rgba(255,255,255,0.28)", borderRadius: 999, padding: "12px 26px 12px 18px", fontFamily: DISPLAY, fontWeight: 800, fontSize: 40, color: C.branco, textTransform: c.tipo === "local" ? "none" : "uppercase" }}>
                  <Icone tipo={c.tipo} cor={c.tipo === "data" ? C.lima : c.tipo === "hora" ? C.laranja : C.azul} tamanho={38} />
                  {c.valor}
                </span>
              ))}
            </div>
          ) : null}
          {t.texto ? <p style={{ margin: 0, fontSize: 34, lineHeight: 1.4, color: "rgba(255,255,255,0.88)", fontWeight: 500, maxWidth: 900 }}><Rico texto={t.texto} cor={C.lima} /></p> : null}
          {story && t.texto2 ? <p style={{ margin: 0, fontSize: 30, lineHeight: 1.4, color: "rgba(255,255,255,0.72)", fontWeight: 500, maxWidth: 880 }}><Rico texto={t.texto2} cor={C.branco} /></p> : null}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 30 }}>
            {t.assinatura ? <span style={{ fontFamily: CURSIVA, fontSize: 58, color: C.laranja, lineHeight: 1.2 }}>{t.assinatura}</span> : <span />}
            <BlocoQr qr={qr} claro={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

const LAYOUTS = { celebracao: Celebracao, largada: Largada, peito: NumeroDePeito, podio: Podio, foto: SuaFoto } as const;

export const ArteConvite = forwardRef<HTMLDivElement, PropsConvite>(function ArteConvite(props, ref) {
  const { altura } = DIMENSOES_CONVITE[props.formato];
  const Layout = LAYOUTS[props.layout];
  return (
    <div ref={ref} style={{ width: 1080, height: altura }}>
      <Layout {...props} altura={altura} />
    </div>
  );
});
