"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { iniciais } from "@/lib/fotoRegras";
import { definirFotos, useFotosRetrospectiva, type FotoRetrospectiva } from "@/lib/retrospectivaFotos";

/*
 * Dois slides de pessoas e momentos, no tamanho nativo (1920 × 1080):
 * - Fala: foto, nome, cargo e uma frase, para quem vai falar.
 * - Retrospectiva: fotos de uma pasta do computador, uma a uma, com efeitos.
 */

const L = 1920;
const A = 1080;
const COR = { navy: "#0b2c5f", navyEscuro: "#071d40", laranja: "#f37021", lima: "#b9d531", azul: "#1462c4", cinza: "#5b6b80" };
const F = "'Barlow', 'Helvetica Neue', Arial, sans-serif";

function Logo({ claro }: { claro?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={claro ? "/logos/logo-comite-branca-trim.png" : "/reuniao/logo-atletas.webp"}
      alt=""
      style={{ position: "absolute", right: 48, bottom: 36, width: claro ? 170 : 190, opacity: claro ? 0.85 : 1, filter: claro ? "none" : "drop-shadow(0 2px 6px rgba(0,0,0,.15))" }}
    />
  );
}

/* ---------- Fala ---------- */

export function SlideFala({ nome, cargo, frase, foto, familia }: { nome: string; cargo: string; frase: string; foto?: string; familia?: string }) {
  const comFrase = frase.trim().length > 0;
  const tamanhoFrase = frase.length > 220 ? 44 : frase.length > 140 ? 52 : frase.length > 70 ? 62 : 74;
  return (
    <div
      style={{
        position: "relative",
        width: L,
        height: A,
        overflow: "hidden",
        fontFamily: familia ?? F,
        backgroundColor: "#eaf2fb",
        backgroundImage: "url(/reuniao/fundo-claro.webp)",
        backgroundSize: "cover",
      }}
    >
      {/* Arcos atrás da foto: as curvas do programa. */}
      <svg width={L} height={A} viewBox={`0 0 ${L} ${A}`} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <circle cx={560} cy={540} r={372} fill="none" stroke={COR.lima} strokeWidth={14} strokeDasharray="700 1700" strokeLinecap="round" transform="rotate(-120 560 540)" />
        <circle cx={560} cy={540} r={400} fill="none" stroke={COR.laranja} strokeWidth={6} strokeDasharray="420 2100" strokeLinecap="round" transform="rotate(20 560 540)" />
        <circle cx={560} cy={540} r={430} fill="none" stroke={COR.azul} strokeOpacity={0.25} strokeWidth={3} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 560 - 320,
          top: 540 - 320,
          width: 640,
          height: 640,
          borderRadius: "50%",
          overflow: "hidden",
          background: foto ? "#fff" : `linear-gradient(160deg, ${COR.azul}, ${COR.navy})`,
          boxShadow: `0 0 0 16px #fff, 0 30px 70px rgba(7,29,64,.35)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 220,
          fontWeight: 900,
        }}
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          iniciais(nome || "?")
        )}
      </div>

      <div style={{ position: "absolute", left: 1060, right: 110, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: comFrase ? 40 : 18 }}>
        {comFrase ? (
          <>
            <div style={{ position: "relative" }}>
              <span aria-hidden="true" style={{ position: "absolute", left: -24, top: -130, fontSize: 260, lineHeight: 1, fontWeight: 900, color: COR.laranja, fontFamily: "Georgia, serif" }}>
                “
              </span>
              <p style={{ margin: 0, fontSize: tamanhoFrase, lineHeight: 1.22, fontWeight: 700, color: COR.navy, textWrap: "balance" } as CSSProperties}>{frase.trim()}</p>
            </div>
            <div style={{ width: 120, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${COR.laranja}, ${COR.lima})` }} />
            <div>
              <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.02, color: COR.navy, textTransform: "uppercase", letterSpacing: "0.01em" }}>{nome}</div>
              {cargo ? <div style={{ marginTop: 10, fontSize: 36, fontWeight: 800, color: COR.laranja }}>{cargo}</div> : null}
            </div>
          </>
        ) : (
          <>
            {cargo ? <div style={{ fontSize: 46, fontWeight: 800, color: COR.laranja }}>{cargo}</div> : null}
            <div style={{ fontSize: nome.length > 22 ? 104 : 130, fontWeight: 900, lineHeight: 0.95, color: COR.navy, textTransform: "uppercase", textWrap: "balance" } as CSSProperties}>{nome}</div>
            <div style={{ width: 160, height: 10, borderRadius: 5, marginTop: 14, background: `linear-gradient(90deg, ${COR.laranja}, ${COR.lima})` }} />
          </>
        )}
      </div>
      <Logo />
    </div>
  );
}

/* ---------- Retrospectiva ---------- */

const ESTILO_ANIMACOES = `
@keyframes retro-kb-a { from { transform: scale(1.02) translate(0, 0); } to { transform: scale(1.14) translate(-2.5%, -1.5%); } }
@keyframes retro-kb-b { from { transform: scale(1.14) translate(2%, 1.5%); } to { transform: scale(1.03) translate(0, 0); } }
@keyframes retro-kb-c { from { transform: scale(1.1) translate(3%, 0); } to { transform: scale(1.1) translate(-3%, 0); } }
@keyframes retro-entra { from { opacity: 0; } to { opacity: 1; } }
@keyframes retro-polaroid { from { opacity: 0; transform: translateY(60px) rotate(var(--giro)) scale(.94); } to { opacity: 1; transform: translateY(0) rotate(var(--giro)) scale(1); } }
@keyframes retro-barra { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes retro-titulo { 0% { opacity: 0; transform: translateY(30px); } 12% { opacity: 1; transform: none; } 88% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .retro-mov { animation: none !important; } }
`;

const EFEITOS = ["retro-kb-a", "retro-kb-b", "retro-kb-c"];

/** Mede a foto para decidir: paisagem ocupa a tela; retrato vira uma foto impressa sobre o fundo desfocado. */
function useOrientacao(url: string | undefined) {
  const [retrato, setRetrato] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!url || url in retrato) return;
    const img = new Image();
    img.onload = () => setRetrato((r) => ({ ...r, [url]: img.naturalHeight > img.naturalWidth * 1.05 }));
    img.src = url;
  }, [url, retrato]);
  return url ? retrato[url] : undefined;
}

function Foto({ foto, indice, segundos }: { foto: FotoRetrospectiva; indice: number; segundos: number }) {
  const retrato = useOrientacao(foto.url);
  const giro = indice % 2 ? 2.5 : -2;
  return (
    <div style={{ position: "absolute", inset: 0, animation: "retro-entra 900ms ease both" }}>
      {/* Fundo: a mesma foto, desfocada e escurecida. */}
      <div style={{ position: "absolute", inset: -60, backgroundImage: `url("${foto.url}")`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(38px) brightness(.55) saturate(1.2)" }} />
      {retrato ? (
        <div
          className="retro-mov"
          style={
            {
              position: "absolute",
              left: "50%",
              top: 70,
              marginLeft: -340,
              width: 680,
              height: 900,
              padding: "26px 26px 90px",
              background: "#fbfaf7",
              borderRadius: 6,
              boxShadow: "0 40px 80px rgba(0,0,0,.5)",
              "--giro": `${giro}deg`,
              transform: `rotate(${giro}deg)`,
              animation: "retro-polaroid 900ms cubic-bezier(.2,.7,.2,1) both",
            } as CSSProperties
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      ) : retrato === false ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto.url}
          alt=""
          className="retro-mov"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: `${EFEITOS[indice % EFEITOS.length]} ${segundos + 1}s ease-out both` }}
        />
      ) : null}
    </div>
  );
}

function Abertura({ titulo, subtitulo, mosaico, comBotoes = false }: { titulo: string; subtitulo: string; mosaico: FotoRetrospectiva[]; comBotoes?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 30% 20%, #133e7a, ${COR.navyEscuro} 70%)` }}>
      {mosaico.length ? (
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(2, 1fr)", gap: 10, padding: 10, opacity: 0.35 }}>
          {mosaico.slice(0, 8).map((f) => (
            <div key={f.url} style={{ backgroundImage: `url("${f.url}")`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: 8 }} />
          ))}
        </div>
      ) : (
        <svg width={L} height={A} viewBox={`0 0 ${L} ${A}`} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={140 + i * 290} y={180 + (i % 2) * 90} width={250} height={330} rx={10} fill="#fff" opacity={0.06} transform={`rotate(${i % 2 ? 4 : -4} ${265 + i * 290} ${345 + (i % 2) * 90})`} />
          ))}
        </svg>
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(7,29,64,.25), rgba(7,29,64,.85))" }} />
      <div style={{ position: "absolute", left: 140, right: 140, bottom: comBotoes ? 290 : 190, color: "#fff" }}>
        <div style={{ width: 140, height: 10, borderRadius: 5, marginBottom: 34, background: `linear-gradient(90deg, ${COR.laranja}, ${COR.lima})` }} />
        <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 0.92, textTransform: "uppercase", letterSpacing: "0.01em" }}>{titulo || "Retrospectiva"}</div>
        {subtitulo ? <div style={{ marginTop: 22, fontSize: 52, fontWeight: 700, color: "rgba(255,255,255,.82)" }}>{subtitulo}</div> : null}
      </div>
    </div>
  );
}

function EscolherFotos({ livreId }: { livreId: string }) {
  const pasta = useRef<HTMLInputElement>(null);
  const arquivos = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState("");
  const receber = (lista: FileList | null) => {
    if (!lista?.length) return;
    const r = definirFotos(livreId, lista);
    setAviso(r.aceitas ? "" : r.ignoradas ? "Nenhuma foto em JPG, PNG ou WebP nessa pasta (fotos HEIC do iPhone precisam ser convertidas)." : "");
  };
  const botao: CSSProperties = { padding: "26px 44px", borderRadius: 999, border: "none", fontSize: 34, fontWeight: 800, cursor: "pointer", fontFamily: F };
  return (
    <div style={{ position: "absolute", left: 140, bottom: 70, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 20 }}>
        <button type="button" style={{ ...botao, background: COR.laranja, color: "#fff" }} onClick={(e) => { e.stopPropagation(); pasta.current?.click(); }}>
          Escolher a pasta de fotos
        </button>
        <button type="button" style={{ ...botao, background: "rgba(255,255,255,.14)", color: "#fff" }} onClick={(e) => { e.stopPropagation(); arquivos.current?.click(); }}>
          Escolher fotos
        </button>
      </div>
      <span style={{ fontSize: 26, color: "rgba(255,255,255,.7)" }}>{aviso || "As fotos ficam só neste computador: nada é enviado ao portal."}</span>
      <input ref={pasta} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={(e) => receber(e.target.files)} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
      <input ref={arquivos} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={(e) => receber(e.target.files)} />
    </div>
  );
}

/**
 * Ao vivo: abertura de 4 s e depois as fotos, uma a uma, em loop. Paisagem
 * ocupa a tela com movimento lento (Ken Burns); retrato vira uma foto impressa
 * levemente inclinada sobre a própria foto desfocada.
 * Nas miniaturas e no PDF, só a abertura (com um mosaico, se já houver fotos).
 */
export function SlideRetrospectiva({ livreId, titulo, subtitulo, segundos, aoVivo, familia }: { livreId: string; titulo: string; subtitulo: string; segundos: number; aoVivo: boolean; familia?: string }) {
  const fotos = useFotosRetrospectiva(livreId);
  const [passo, setPasso] = useState(-1);
  const temFotos = fotos.length > 0;

  useEffect(() => {
    if (!aoVivo || !temFotos) return;
    const id = window.setTimeout(() => setPasso((p) => (p + 1) % fotos.length), passo < 0 ? 4000 : segundos * 1000);
    return () => window.clearTimeout(id);
  }, [aoVivo, temFotos, passo, segundos, fotos.length]);

  // Pré-carrega a próxima foto para a troca não piscar.
  useEffect(() => {
    if (!aoVivo || !temFotos) return;
    const prox = fotos[(passo + 1) % fotos.length];
    if (prox) new Image().src = prox.url;
  }, [aoVivo, temFotos, passo, fotos]);

  const atual = aoVivo && temFotos && passo >= 0 ? fotos[passo % fotos.length] : null;
  const anterior = aoVivo && temFotos && passo > 0 ? fotos[(passo - 1) % fotos.length] : null;

  return (
    <div style={{ position: "relative", width: L, height: A, overflow: "hidden", background: "#000", fontFamily: familia ?? F }}>
      <style>{ESTILO_ANIMACOES}</style>
      {atual ? (
        <>
          {/* A anterior fica por baixo enquanto a nova aparece. */}
          {anterior ? <Foto key={`f-${passo - 1}`} foto={anterior} indice={passo - 1} segundos={segundos} /> : null}
          <Foto key={`f-${passo}`} foto={atual} indice={passo} segundos={segundos} />
          <div style={{ position: "absolute", left: 60, top: 48, display: "flex", alignItems: "center", gap: 16, color: "#fff", fontSize: 30, fontWeight: 800, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>
            <span style={{ width: 54, height: 7, borderRadius: 4, background: `linear-gradient(90deg, ${COR.laranja}, ${COR.lima})` }} />
            {titulo}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, background: "rgba(255,255,255,.18)" }}>
            <div key={`b-${passo}`} className="retro-mov" style={{ height: "100%", background: COR.laranja, transformOrigin: "left", animation: `retro-barra ${segundos}s linear both` }} />
          </div>
          <div style={{ position: "absolute", right: 60, bottom: 30, color: "rgba(255,255,255,.75)", fontSize: 24, fontWeight: 700 }}>
            {(passo % fotos.length) + 1} / {fotos.length}
          </div>
        </>
      ) : (
        <>
          <Abertura titulo={titulo} subtitulo={subtitulo} mosaico={fotos} comBotoes={aoVivo && !temFotos} />
          {aoVivo && !temFotos ? <EscolherFotos livreId={livreId} /> : null}
          {!aoVivo && temFotos ? (
            <div style={{ position: "absolute", right: 60, top: 48, padding: "12px 22px", borderRadius: 999, background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 24, fontWeight: 700 }}>{fotos.length} fotos</div>
          ) : null}
          <Logo claro />
        </>
      )}
    </div>
  );
}
