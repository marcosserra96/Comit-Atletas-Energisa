"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { iniciais } from "@/lib/fotoRegras";
import { carregarPasta, useRetrospectiva } from "@/lib/retrospectivaFotos";
import { montarCenas, SEGUNDOS_ABERTURA, type Cena, type ItemRetro, type OpcoesRetro } from "@/lib/retrospectiva";

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
@keyframes retro-sobe { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
@keyframes retro-zoom { from { transform: scale(1.08); } to { transform: scale(1); } }
.retro-pausado .retro-mov { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) { .retro-mov { animation: none !important; } }
`;

const EFEITOS = ["retro-kb-a", "retro-kb-b", "retro-kb-c"];

/** A mesma foto, desfocada e escurecida, atrás de tudo. */
function FundoDesfocado({ url }: { url: string }) {
  return <div style={{ position: "absolute", inset: -60, backgroundImage: `url("${url}")`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(38px) brightness(.5) saturate(1.2)" }} />;
}

/** Foto impressa (polaroide), levemente inclinada. */
function Impressa({ url, giro, largura, altura, atraso = 0, estilo }: { url: string; giro: number; largura: number; altura: number; atraso?: number; estilo?: CSSProperties }) {
  return (
    <div
      className="retro-mov"
      style={
        {
          width: largura,
          height: altura,
          padding: "24px 24px 84px",
          background: "#fbfaf7",
          borderRadius: 6,
          boxShadow: "0 40px 80px rgba(0,0,0,.5)",
          "--giro": `${giro}deg`,
          transform: `rotate(${giro}deg)`,
          animation: `retro-polaroid 900ms cubic-bezier(.2,.7,.2,1) ${atraso}ms both`,
          ...estilo,
        } as CSSProperties
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

function CenaFoto({ item, indice, duracao }: { item: ItemRetro; indice: number; duracao: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, animation: "retro-entra 900ms ease both" }}>
      <FundoDesfocado url={item.url} />
      {item.retrato ? (
        <div style={{ position: "absolute", left: "50%", top: 70, marginLeft: -340 }}>
          <Impressa url={item.url} giro={indice % 2 ? 2.5 : -2} largura={680} altura={900} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt=""
          className="retro-mov"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: `${EFEITOS[indice % EFEITOS.length]} ${duracao + 1}s ease-out both` }}
        />
      )}
    </div>
  );
}

function CenaDupla({ itens }: { itens: [ItemRetro, ItemRetro] }) {
  return (
    <div style={{ position: "absolute", inset: 0, animation: "retro-entra 900ms ease both" }}>
      <FundoDesfocado url={itens[0].url} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 70 }}>
        <Impressa url={itens[0].url} giro={-3} largura={620} altura={850} />
        <Impressa url={itens[1].url} giro={2.5} largura={620} altura={850} atraso={350} estilo={{ marginTop: 50 }} />
      </div>
    </div>
  );
}

/** Uma grande à esquerda e duas empilhadas à direita, entrando uma de cada vez. */
function CenaMosaico({ itens }: { itens: ItemRetro[] }) {
  const quadro = (url: string, atraso: number, estilo: CSSProperties) => (
    <div className="retro-mov" style={{ position: "absolute", overflow: "hidden", borderRadius: 14, boxShadow: "0 24px 50px rgba(0,0,0,.45)", animation: `retro-sobe 800ms cubic-bezier(.2,.7,.2,1) ${atraso}ms both`, ...estilo }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="retro-mov" style={{ width: "100%", height: "100%", objectFit: "cover", animation: `retro-zoom 6s ease-out ${atraso}ms both` }} />
    </div>
  );
  return (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 30% 20%, #133e7a, ${COR.navyEscuro} 70%)`, animation: "retro-entra 700ms ease both" }}>
      {quadro(itens[0].url, 0, { left: 70, top: 70, width: 1080, height: 940 })}
      {itens[1] ? quadro(itens[1].url, 400, { left: 1180, top: 70, width: 670, height: 455 }) : null}
      {itens[2] ? quadro(itens[2].url, 800, { left: 1180, top: 555, width: 670, height: 455 }) : null}
    </div>
  );
}

function CenaVideo({ item, pausado, comSom }: { item: ItemRetro; pausado: boolean; comSom: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (pausado) v.pause();
    else void v.play().catch(() => undefined);
  }, [pausado]);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000", animation: "retro-entra 700ms ease both" }}>
      <video
        ref={ref}
        src={item.url}
        autoPlay
        playsInline
        muted={!comSom}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: item.retrato ? "contain" : "cover" }}
      />
    </div>
  );
}

function CenaCapitulo({ titulo, quantidade, fotos }: { titulo: string; quantidade: number; fotos: ItemRetro[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 75% 40%, #164a8f, ${COR.navyEscuro} 65%)`, animation: "retro-entra 700ms ease both" }}>
      <div style={{ position: "absolute", right: 120, top: 150, width: 760, height: 780 }}>
        {fotos.map((f, i) => (
          <div key={f.id} style={{ position: "absolute", left: 60 + i * 130, top: 40 + (i % 2) * 90 }}>
            <Impressa url={f.url} giro={[-7, 4, -2][i] ?? 0} largura={420} altura={540} atraso={200 + i * 220} />
          </div>
        ))}
      </div>
      <div className="retro-mov" style={{ position: "absolute", left: 140, top: 0, bottom: 0, width: 860, display: "flex", flexDirection: "column", justifyContent: "center", color: "#fff", animation: "retro-sobe 900ms cubic-bezier(.2,.7,.2,1) both" }}>
        <div style={{ width: 120, height: 10, borderRadius: 5, marginBottom: 34, background: `linear-gradient(90deg, ${COR.laranja}, ${COR.lima})` }} />
        <div style={{ fontSize: titulo.length > 28 ? 92 : 124, fontWeight: 900, lineHeight: 0.95 }}>{titulo}</div>
        <div style={{ marginTop: 26, fontSize: 40, fontWeight: 700, color: "rgba(255,255,255,.72)" }}>{quantidade === 1 ? "1 momento" : `${quantidade} momentos`}</div>
      </div>
    </div>
  );
}

function Encerramento({ titulo, total, fotos }: { titulo: string; total: number; fotos: ItemRetro[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: COR.navyEscuro, animation: "retro-entra 1200ms ease both" }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gridTemplateRows: "repeat(3, 1fr)", gap: 8, padding: 8, opacity: 0.28 }}>
        {fotos.slice(0, 18).map((f) => (
          <div key={f.id} style={{ backgroundImage: `url("${f.url}")`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: 6 }} />
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 55%, rgba(7,29,64,.55), rgba(7,29,64,.92) 75%)" }} />
      <div className="retro-mov" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#fff", animation: "retro-sobe 1200ms cubic-bezier(.2,.7,.2,1) 300ms both" }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: "rgba(255,255,255,.75)" }}>{titulo || "Retrospectiva"}</div>
        <div style={{ marginTop: 18, fontSize: 112, fontWeight: 900, lineHeight: 0.95 }}>Obrigado por cada momento</div>
        <div style={{ marginTop: 36, width: 160, height: 10, borderRadius: 5, background: `linear-gradient(90deg, ${COR.laranja}, ${COR.lima})` }} />
        <div style={{ marginTop: 30, fontSize: 38, fontWeight: 700, color: "rgba(255,255,255,.7)" }}>{total === 1 ? "1 momento juntos" : `${total} momentos juntos`}</div>
      </div>
      <Logo claro />
    </div>
  );
}

function Abertura({ titulo, subtitulo, mosaico, comBotoes = false }: { titulo: string; subtitulo: string; mosaico: ItemRetro[]; comBotoes?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 30% 20%, #133e7a, ${COR.navyEscuro} 70%)` }}>
      {mosaico.length ? (
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(2, 1fr)", gap: 10, padding: 10, opacity: 0.35 }}>
          {mosaico.slice(0, 8).map((f) => (
            <div key={f.id} style={{ backgroundImage: `url("${f.url}")`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: 8 }} />
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

const ACEITA = "image/*,video/mp4,video/webm,video/quicktime,audio/*,.heic,.heif,.mov";

/** Ao vivo, sem fotos ainda: escolher a pasta (ou arquivos) e, se quiser, a música. */
function EscolherFotos({ livreId, preparando }: { livreId: string; preparando: { feitos: number; total: number } | null }) {
  const pasta = useRef<HTMLInputElement>(null);
  const arquivos = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState("");
  const receber = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setAviso("");
    const r = await carregarPasta(livreId, lista);
    if (r && !r.aceitas) setAviso("Nenhuma foto ou vídeo que o navegador abra nessa pasta.");
  };
  const botao: CSSProperties = { padding: "26px 44px", borderRadius: 999, border: "none", fontSize: 34, fontWeight: 800, cursor: "pointer", fontFamily: F };
  return (
    <div style={{ position: "absolute", left: 140, bottom: 70, display: "flex", flexDirection: "column", gap: 18 }}>
      {preparando ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 760, color: "#fff" }}>
          <span style={{ fontSize: 34, fontWeight: 800 }}>
            Preparando as fotos… {preparando.feitos} de {preparando.total}
          </span>
          <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,.18)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(preparando.feitos / Math.max(1, preparando.total)) * 100}%`, background: COR.laranja, transition: "width 300ms" }} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 20 }}>
          <button type="button" style={{ ...botao, background: COR.laranja, color: "#fff" }} onClick={(e) => { e.stopPropagation(); pasta.current?.click(); }}>
            Escolher a pasta de fotos
          </button>
          <button type="button" style={{ ...botao, background: "rgba(255,255,255,.14)", color: "#fff" }} onClick={(e) => { e.stopPropagation(); arquivos.current?.click(); }}>
            Escolher arquivos
          </button>
        </div>
      )}
      <span style={{ fontSize: 26, color: "rgba(255,255,255,.7)" }}>{aviso || "Fotos, vídeos e uma música (se tiver na pasta) ficam só neste computador: nada é enviado ao portal."}</span>
      <input ref={pasta} type="file" multiple accept={ACEITA} style={{ display: "none" }} onChange={(e) => void receber(e.target.files)} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
      <input ref={arquivos} type="file" multiple accept={ACEITA} style={{ display: "none" }} onChange={(e) => void receber(e.target.files)} />
    </div>
  );
}

/** Tecla dentro da retrospectiva: espaço pausa, setas trocam a foto. Na última cena, as setas voltam a trocar de slide. */
function useTeclasDaRetrospectiva(raiz: React.RefObject<HTMLDivElement | null>, ativo: boolean, acoes: { pausar: () => void; ir: (d: number) => boolean }) {
  const ref = useRef(acoes);
  useEffect(() => {
    ref.current = acoes;
  });
  useEffect(() => {
    if (!ativo) return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT")) return;
      let tratou = false;
      if (e.key === " ") {
        ref.current.pausar();
        tratou = true;
      } else if (e.key === "ArrowRight") tratou = ref.current.ir(1);
      else if (e.key === "ArrowLeft") tratou = ref.current.ir(-1);
      if (tratou) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    // O slide pode estar no telão (outra janela): escuta nas duas.
    const janelas = [...new Set([window, raiz.current?.ownerDocument.defaultView].filter((j): j is Window & typeof globalThis => !!j))];
    janelas.forEach((j) => j.addEventListener("keydown", tecla, true));
    return () => janelas.forEach((j) => j.removeEventListener("keydown", tecla, true));
  }, [ativo, raiz]);
}

/**
 * Ao vivo: abertura, capítulos (subpastas), fotos sozinhas, em dupla ou em
 * mosaico, vídeos, legenda do mês e, no fim, o encerramento (ou repete).
 * Com música, ela toca junto e abaixa sozinha no fim.
 * Nas miniaturas e no PDF, só a abertura (com um mosaico, se já houver fotos).
 */
export function SlideRetrospectiva({ livreId, titulo, subtitulo, opcoes, aoVivo, familia }: { livreId: string; titulo: string; subtitulo: string; opcoes: OpcoesRetro; aoVivo: boolean; familia?: string }) {
  const { itens, musica, preparando } = useRetrospectiva(livreId);
  // Ainda preparando: começa com o que já está pronto, sem o encerramento (as próximas fotos chegam no fim da fila).
  const chegando = !!preparando;
  const { cenas } = useMemo(() => {
    const r = montarCenas(itens, opcoes, musica?.duracao);
    return chegando ? { ...r, cenas: r.cenas.filter((c) => c.tipo !== "encerramento") } : r;
  }, [itens, opcoes, musica?.duracao, chegando]);
  const visiveis = useMemo(() => itens.filter((i) => !i.oculta && i.tipo === "foto"), [itens]);
  const [pos, setPos] = useState(-1);
  const [decorrido, setDecorrido] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [mouse, setMouse] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const temCenas = cenas.length > 0;
  const rodando = aoVivo && temCenas;
  const cena: Cena | null = rodando && pos >= 0 ? (cenas[pos] ?? null) : null;
  const duracaoAtual = pos < 0 ? SEGUNDOS_ABERTURA : (cena?.duracao ?? 0);
  const noFim = cena?.tipo === "encerramento";

  const irPara = (p: number) => {
    setPos(p);
    setDecorrido(0);
  };

  // Relógio: soma o tempo quando não está pausado e passa de cena no fim.
  useEffect(() => {
    if (!rodando || pausado || noFim) return;
    const id = window.setInterval(() => setDecorrido((d) => d + 0.1), 100);
    return () => window.clearInterval(id);
  }, [rodando, pausado, noFim]);
  useEffect(() => {
    if (!rodando || noFim || duracaoAtual <= 0 || decorrido < duracaoAtual) return;
    // Na última foto pronta, espera as próximas em vez de voltar ao começo.
    if (chegando && pos + 1 >= cenas.length) return;
    const proxima = pos + 1 < cenas.length ? pos + 1 : 0;
    const id = window.setTimeout(() => irPara(proxima), 0);
    return () => window.clearTimeout(id);
  }, [rodando, noFim, decorrido, duracaoAtual, pos, cenas.length, chegando]);

  // Música: começa com a abertura, pausa junto e abaixa sozinha no encerramento.
  useEffect(() => {
    const a = audio.current;
    if (!a || !rodando) return;
    a.loop = opcoes.repetir;
    if (pausado) a.pause();
    else if (!noFim) {
      a.volume = 1;
      void a.play().catch(() => undefined);
    }
  }, [rodando, pausado, noFim, opcoes.repetir, musica?.url]);
  useEffect(() => {
    const a = audio.current;
    if (!a || !noFim) return;
    const id = window.setInterval(() => {
      a.volume = Math.max(0, a.volume - 0.05);
      if (a.volume <= 0) {
        a.pause();
        window.clearInterval(id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [noFim]);

  // Pré-carrega a próxima cena para a troca não piscar.
  useEffect(() => {
    if (!rodando) return;
    const prox = cenas[pos + 1];
    const urls = !prox ? [] : prox.tipo === "foto" ? [prox.item.url] : prox.tipo === "dupla" || prox.tipo === "mosaico" ? prox.itens.map((i) => i.url) : [];
    urls.forEach((u) => (new Image().src = u));
  }, [rodando, pos, cenas]);

  useTeclasDaRetrospectiva(raiz, rodando, {
    pausar: () => {
      if (!noFim) setPausado((p) => !p);
      return !noFim;
    },
    ir: (d) => {
      if (d > 0 && (noFim || (opcoes.repetir ? false : pos >= cenas.length - 1))) return false;
      if (d < 0 && pos < 0) return false;
      irPara(d > 0 ? (pos + 1) % cenas.length : pos - 1);
      return true;
    },
  });

  useEffect(() => {
    if (!mouse) return;
    const id = window.setTimeout(() => setMouse(false), 2500);
    return () => window.clearTimeout(id);
  }, [mouse]);

  const legenda = cena && "legenda" in cena ? cena.legenda : null;
  const botao: CSSProperties = { width: 76, height: 76, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.45)", color: "#fff", fontSize: 30, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F };

  return (
    <div ref={raiz} className={pausado ? "retro-pausado" : undefined} onMouseMove={() => rodando && setMouse(true)} style={{ position: "relative", width: L, height: A, overflow: "hidden", background: "#000", fontFamily: familia ?? F }}>
      <style>{ESTILO_ANIMACOES}</style>
      {rodando && musica ? <audio ref={audio} src={musica.url} preload="auto" /> : null}
      {cena ? (
        <>
          {cena.tipo === "foto" ? <CenaFoto key={`c-${pos}`} item={cena.item} indice={pos} duracao={cena.duracao} /> : null}
          {cena.tipo === "dupla" ? <CenaDupla key={`c-${pos}`} itens={cena.itens} /> : null}
          {cena.tipo === "mosaico" ? <CenaMosaico key={`c-${pos}`} itens={cena.itens} /> : null}
          {cena.tipo === "video" ? <CenaVideo key={`c-${pos}`} item={cena.item} pausado={pausado} comSom={!musica} /> : null}
          {cena.tipo === "capitulo" ? <CenaCapitulo key={`c-${pos}`} titulo={cena.titulo} quantidade={cena.quantidade} fotos={cena.fotos} /> : null}
          {cena.tipo === "encerramento" ? <Encerramento titulo={titulo} total={cena.total} fotos={visiveis} /> : null}
          {cena.tipo !== "capitulo" && cena.tipo !== "encerramento" ? (
            <div style={{ position: "absolute", left: 60, top: 48, display: "flex", alignItems: "center", gap: 16, color: "#fff", fontSize: 30, fontWeight: 800, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>
              <span style={{ width: 54, height: 7, borderRadius: 4, background: `linear-gradient(90deg, ${COR.laranja}, ${COR.lima})` }} />
              {titulo}
            </div>
          ) : null}
          {legenda ? (
            <div key={`l-${pos}`} className="retro-mov" style={{ position: "absolute", left: 60, bottom: 54, padding: "14px 28px", borderRadius: 999, background: "rgba(7,29,64,.72)", color: "#fff", fontSize: 34, fontWeight: 800, animation: "retro-sobe 700ms ease 300ms both" }}>
              {legenda}
            </div>
          ) : null}
          {!noFim ? (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, background: "rgba(255,255,255,.18)" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (decorrido / Math.max(0.1, duracaoAtual)) * 100)}%`, background: COR.laranja, transition: "width 100ms linear" }} />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <Abertura titulo={titulo} subtitulo={subtitulo} mosaico={visiveis} comBotoes={aoVivo && !temCenas} />
          {aoVivo && !temCenas ? <EscolherFotos livreId={livreId} preparando={preparando} /> : null}
          {!aoVivo && visiveis.length ? (
            <div style={{ position: "absolute", right: 60, top: 48, padding: "12px 22px", borderRadius: 999, background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 24, fontWeight: 700 }}>{visiveis.length} fotos</div>
          ) : null}
          {rodando ? (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, background: "rgba(255,255,255,.18)" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (decorrido / SEGUNDOS_ABERTURA) * 100)}%`, background: COR.laranja, transition: "width 100ms linear" }} />
            </div>
          ) : null}
          <Logo claro />
        </>
      )}
      {rodando && preparando ? (
        <div style={{ position: "absolute", right: 50, top: 44, padding: "10px 20px", borderRadius: 999, background: "rgba(0,0,0,.45)", color: "rgba(255,255,255,.85)", fontSize: 22, fontWeight: 700 }}>
          Preparando fotos · {preparando.feitos} de {preparando.total}
        </div>
      ) : null}
      {rodando && (pausado || mouse) ? (
        <div style={{ position: "absolute", right: 50, bottom: 40, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ marginRight: 10, color: "rgba(255,255,255,.85)", fontSize: 24, fontWeight: 700, textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>
            {pausado ? "Pausado · espaço continua" : "Espaço pausa · ← → trocam a foto"}
          </span>
          <button type="button" aria-label="Foto anterior" style={botao} onClick={(e) => { e.stopPropagation(); if (pos >= 0) irPara(pos - 1); }}>‹</button>
          <button type="button" aria-label={pausado ? "Continuar" : "Pausar"} style={botao} onClick={(e) => { e.stopPropagation(); if (!noFim) setPausado((p) => !p); }}>
            {pausado ? "▶" : "❚❚"}
          </button>
          <button type="button" aria-label="Próxima foto" style={botao} onClick={(e) => { e.stopPropagation(); if (!noFim) irPara(pos + 1 < cenas.length ? pos + 1 : 0); }}>›</button>
        </div>
      ) : null}
    </div>
  );
}
