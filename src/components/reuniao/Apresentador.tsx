"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, MonitorUp, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { SLIDE_A, SLIDE_L } from "@/components/reuniao/SlidesReuniao";

/** Mostra um slide 1920×1080 escalado para a largura do contêiner. */
export function SlideEscalado({ children, className }: { children: ReactNode; className?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0);
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / SLIDE_L);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={caixa} className={cn("relative w-full overflow-hidden", className)} style={{ aspectRatio: `${SLIDE_L} / ${SLIDE_A}` }}>
      {escala > 0 ? (
        <div style={{ width: SLIDE_L, height: SLIDE_A, transform: `scale(${escala})`, transformOrigin: "top left", position: "absolute", left: 0, top: 0 }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface AcaoDoSlide {
  rotulo: string;
  executar: () => void;
  desabilitado?: boolean;
}

/** Slide 1920×1080 encaixado numa área (mantém a proporção). */
function SlideNaArea({ largura, altura, children }: { largura: number; altura: number; children: ReactNode }) {
  const escala = Math.min(largura / SLIDE_L, altura / SLIDE_A);
  return (
    <div style={{ width: SLIDE_L * escala, height: SLIDE_A * escala, position: "relative", overflow: "hidden" }}>
      <div style={{ width: SLIDE_L, height: SLIDE_A, transform: `scale(${escala})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

/** Copia estilos e fontes da página para a janela do telão (o React desenha lá por portal). */
function prepararJanelaDoTelao(janela: Window) {
  const d = janela.document;
  d.title = "Telão · Reunião de resultados";
  d.head.innerHTML = "";
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => d.head.appendChild(n.cloneNode(true)));
  d.body.innerHTML = "";
  d.body.style.cssText = "margin:0;background:#000;overflow:hidden;";
  const alvo = d.createElement("div");
  d.body.appendChild(alvo);
  return alvo;
}

function formatarTempo(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

/** O que a plateia vê na janela do telão. */
function Telao({ janela, children }: { janela: Window; children: ReactNode }) {
  const [tamanho, setTamanho] = useState({ l: janela.innerWidth, a: janela.innerHeight });
  const [cheia, setCheia] = useState(false);
  useEffect(() => {
    const medir = () => setTamanho({ l: janela.innerWidth, a: janela.innerHeight });
    const fs = () => setCheia(!!janela.document.fullscreenElement);
    janela.addEventListener("resize", medir);
    janela.document.addEventListener("fullscreenchange", fs);
    return () => {
      janela.removeEventListener("resize", medir);
      janela.document.removeEventListener("fullscreenchange", fs);
    };
  }, [janela]);
  return (
    <div
      style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", cursor: cheia ? "none" : "default" }}
      onDoubleClick={() => void janela.document.documentElement.requestFullscreen?.().catch(() => undefined)}
    >
      <SlideNaArea largura={tamanho.l} altura={tamanho.a}>
        {children}
      </SlideNaArea>
      {cheia ? null : (
        <button
          type="button"
          onClick={() => void janela.document.documentElement.requestFullscreen?.().catch(() => undefined)}
          style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", padding: "12px 22px", borderRadius: 999, border: "none", background: "rgba(255,255,255,.92)", color: "#0b2c5f", font: "700 15px system-ui, sans-serif", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.35)" }}
        >
          Arraste esta janela para o projetor e clique aqui para tela cheia
        </button>
      )}
    </div>
  );
}

/** Durações das animações (globals.css) para a velocidade escolhida: 1 = normal. */
function duracoes(fator: number): CSSProperties {
  const ms = (n: number) => `${Math.round(n * fator)}ms`;
  return {
    "--t-entra": ms(650),
    "--t-d2": ms(120),
    "--t-d3": ms(240),
    "--t-d4": ms(360),
    "--t-d5": ms(480),
    "--t-d6": ms(600),
    "--t-podio": ms(750),
    "--t-podio-texto": ms(500),
    "--t-podio-atraso": ms(250),
    "--t-transicao": ms(480),
  } as CSSProperties;
}

/**
 * Apresentação. Sozinha: tela cheia no próprio navegador. Com "Tela do
 * apresentador": os slides vão para uma segunda janela (o telão) e esta tela
 * mostra o slide atual, o próximo, o tempo e as anotações.
 */
export function Apresentador({
  total,
  inicial,
  renderSlide,
  onFechar,
  rotulo,
  nota,
  onNota,
  acao,
  passos,
  transicao = "esmaecer",
  velocidade = 1,
}: {
  total: number;
  inicial: number;
  /** `passo`: cliques já dados no slide (pódio revelado aos poucos); `aoVivo`: anima a entrada. */
  renderSlide: (indice: number, opcoes?: { passo?: number; aoVivo?: boolean }) => ReactNode;
  onFechar: () => void;
  rotulo?: (indice: number) => string;
  nota?: (indice: number) => string;
  onNota?: (indice: number, texto: string) => void;
  /** Botão extra para o slide atual (ex.: "Sortear"). */
  acao?: (indice: number) => AcaoDoSlide | null;
  /** Cliques que o slide tem antes de passar ao próximo. */
  passos?: (indice: number) => number;
  transicao?: "nenhuma" | "esmaecer" | "deslizar" | "zoom";
  /** Multiplica a duração das animações (1 = normal). */
  velocidade?: number;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ indice: Math.min(inicial, Math.max(0, total - 1)), passo: 0 });
  const { indice, passo } = pos;
  const passosRef = useRef(passos);
  useEffect(() => {
    passosRef.current = passos;
  });
  const totalPassos = passos?.(indice) ?? 0;
  const noInicio = indice === 0 && passo === 0;
  const noFim = indice >= total - 1 && passo >= totalPassos;
  const [escala, setEscala] = useState(1);
  const [controles, setControles] = useState(true);
  const [cheia, setCheia] = useState(false);
  const [telao, setTelao] = useState<{ janela: Window; alvo: HTMLElement } | null>(null);
  const [inicio, setInicio] = useState(() => Date.now());
  const [agora, setAgora] = useState(() => Date.now());
  const toque = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acaoAtual = acao?.(indice) ?? null;
  const acaoRef = useRef(acaoAtual);
  useEffect(() => {
    acaoRef.current = acaoAtual;
  });

  // Avançar revela o próximo passo do slide (se houver) antes de trocar; voltar desfaz.
  const ir = useCallback(
    (delta: number) =>
      setPos(({ indice: i, passo: p }) => {
        const de = (n: number) => passosRef.current?.(n) ?? 0;
        if (delta > 0) {
          if (p < de(i)) return { indice: i, passo: p + 1 };
          return i < total - 1 ? { indice: i + 1, passo: 0 } : { indice: i, passo: p };
        }
        if (p > 0) return { indice: i, passo: p - 1 };
        return i > 0 ? { indice: i - 1, passo: de(i - 1) } : { indice: i, passo: p };
      }),
    [total],
  );

  const mostrarControles = useCallback(() => {
    setControles(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setControles(false), 2500);
  }, []);

  useEffect(() => {
    const medir = () => setEscala(Math.min(window.innerWidth / SLIDE_L, window.innerHeight / SLIDE_A));
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  // Relógio da tela do apresentador.
  useEffect(() => {
    if (!telao) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [telao]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT")) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        ir(1);
      } else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        ir(-1);
      } else if (e.key === "Home") setPos({ indice: 0, passo: 0 });
      else if (e.key === "End") setPos({ indice: total - 1, passo: passosRef.current?.(total - 1) ?? 0 });
      else if ((e.key === "s" || e.key === "S") && acaoRef.current && !acaoRef.current.desabilitado) acaoRef.current.executar();
      else if (e.key === "Escape" && !document.fullscreenElement) onFechar();
    };
    const fs = () => setCheia(!!document.fullscreenElement);
    window.addEventListener("keydown", tecla);
    telao?.janela.addEventListener("keydown", tecla);
    document.addEventListener("fullscreenchange", fs);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      telao?.janela.removeEventListener("keydown", tecla);
      document.removeEventListener("fullscreenchange", fs);
      document.body.style.overflow = "";
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ir, onFechar, total, telao]);

  // Abre já em tela cheia quando o navegador permite.
  useEffect(() => {
    raiz.current?.requestFullscreen?.().catch(() => undefined);
    timer.current = setTimeout(() => setControles(false), 2500);
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // Fechou a apresentação: fecha o telão junto. Fecharam o telão: volta ao modo simples.
  useEffect(() => {
    if (!telao) return;
    const fechou = () => setTelao(null);
    telao.janela.addEventListener("pagehide", fechou);
    const vigia = setInterval(() => telao.janela.closed && setTelao(null), 1000);
    return () => {
      telao.janela.removeEventListener("pagehide", fechou);
      clearInterval(vigia);
    };
  }, [telao]);
  useEffect(() => () => telao?.janela.close(), [telao]);

  function abrirTelao() {
    const janela = window.open("", "telao-reuniao", "popup,width=1280,height=720");
    if (!janela) return;
    const alvo = prepararJanelaDoTelao(janela);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setInicio(Date.now());
    setAgora(Date.now());
    setTelao({ janela, alvo });
  }

  /** Troca de slide com a transição escolhida (a chave remonta o slide e repete a animação). */
  const comTransicao = (no: ReactNode) => (
    <div key={indice} className={transicao === "nenhuma" ? undefined : `transicao-${transicao}`} style={{ width: SLIDE_L, height: SLIDE_A, ...duracoes(velocidade) }}>
      {no}
    </div>
  );

  const alternarTelaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void raiz.current?.requestFullscreen?.().catch(() => undefined);
  };

  const botao =
    "flex size-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-30";
  const botaoAcao = "flex h-12 items-center gap-2 rounded-full bg-[#f37021] px-5 text-sm font-bold text-white shadow-lg transition-transform active:scale-[0.97] disabled:opacity-40";

  // ---------- modo apresentador (dois monitores) ----------
  if (telao) {
    const proximo = indice + 1 < total ? indice + 1 : null;
    // Ainda há o que revelar neste slide: o "próximo" é o próximo clique.
    const revelaAqui = passo < totalPassos;
    return (
      <div ref={raiz} role="dialog" aria-modal="true" aria-label="Tela do apresentador" className="fixed inset-0 z-[100] flex flex-col bg-[#0b1220] text-white">
        {createPortal(<Telao janela={telao.janela}>{comTransicao(renderSlide(indice, { passo, aoVivo: true }))}</Telao>, telao.alvo)}
        <div className="flex items-center gap-4 border-b border-white/10 px-6 py-3">
          <p className="text-sm font-semibold text-white/70">Tela do apresentador</p>
          <p className="ml-auto text-sm tabular-nums text-white/70">
            {new Date(agora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button type="button" onClick={() => telao.janela.close()} className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">
            Voltar a uma tela
          </button>
          <button type="button" onClick={onFechar} className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">
            <X className="size-4" aria-hidden="true" />
            Encerrar
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-6 p-6">
          <div className="flex min-h-0 flex-col gap-3">
            <p className="text-sm font-semibold text-white/70">
              Agora · <span className="tabular-nums">{indice + 1} / {total}</span>
              {rotulo ? ` · ${rotulo(indice)}` : ""}
            </p>
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden rounded-xl ring-2 ring-[#f37021]">
              <AreaMedida>{(l, a) => <SlideNaArea largura={l} altura={a}>{renderSlide(indice, { passo })}</SlideNaArea>}</AreaMedida>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button type="button" className={botao} onClick={() => ir(-1)} disabled={noInicio} aria-label="Slide anterior">
                <ChevronLeft className="size-6" />
              </button>
              <button type="button" className={botao} onClick={() => ir(1)} disabled={noFim} aria-label="Próximo slide">
                <ChevronRight className="size-6" />
              </button>
              {acaoAtual ? (
                <button type="button" className={botaoAcao} onClick={acaoAtual.executar} disabled={acaoAtual.desabilitado}>
                  {acaoAtual.rotulo}
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-white/70">
                {revelaAqui ? `Próximo clique · revela o ${totalPassos - passo}º lugar` : proximo !== null ? `Próximo${rotulo ? ` · ${rotulo(proximo)}` : ""}` : "Último slide"}
              </p>
              {revelaAqui || proximo !== null ? (
                <div className="overflow-hidden rounded-lg opacity-90">
                  <SlideEscalado>{revelaAqui ? renderSlide(indice, { passo: passo + 1 }) : renderSlide(proximo!)}</SlideEscalado>
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-white/60">Tempo de reunião</p>
                <p className="text-3xl font-black tabular-nums">{formatarTempo(agora - inicio)}</p>
              </div>
              <button type="button" onClick={() => setInicio(Date.now())} className="rounded-full px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10">
                Zerar
              </button>
            </div>
            <label className="flex min-h-0 flex-1 flex-col gap-2">
              <span className="text-xs font-semibold text-white/60">Anotações deste slide (só você vê)</span>
              <textarea
                value={nota?.(indice) ?? ""}
                onChange={(e) => onNota?.(indice, e.target.value)}
                disabled={!onNota}
                placeholder="O que falar aqui, números para lembrar, quem chamar…"
                className="min-h-24 flex-1 resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-base leading-relaxed text-white outline-none placeholder:text-white/40 focus:border-[#f37021]"
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // ---------- modo simples (uma tela) ----------
  return (
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label="Apresentação"
      className={cn("fixed inset-0 z-[100] flex items-center justify-center bg-black", !controles && "cursor-none")}
      onMouseMove={mostrarControles}
      onClick={(e) => {
        // Clique na metade direita avança; na esquerda volta.
        if ((e.target as HTMLElement).closest("button")) return;
        ir(e.clientX > window.innerWidth / 2 ? 1 : -1);
        mostrarControles();
      }}
      onTouchStart={(e) => (toque.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (toque.current === null) return;
        const dx = e.changedTouches[0].clientX - toque.current;
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
        toque.current = null;
      }}
    >
      <div style={{ width: SLIDE_L * escala, height: SLIDE_A * escala, position: "relative", overflow: "hidden" }}>
        <div style={{ width: SLIDE_L, height: SLIDE_A, transform: `scale(${escala})`, transformOrigin: "top left" }}>{comTransicao(renderSlide(indice, { passo, aoVivo: true }))}</div>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-5 transition-opacity duration-300",
          controles || acaoAtual ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <button type="button" className={botao} onClick={() => ir(-1)} disabled={noInicio} aria-label="Slide anterior">
          <ChevronLeft className="size-6" />
        </button>
        <span className="min-w-20 text-center text-sm font-semibold tabular-nums text-white">
          {indice + 1} / {total}
        </span>
        <button type="button" className={botao} onClick={() => ir(1)} disabled={noFim} aria-label="Próximo slide">
          <ChevronRight className="size-6" />
        </button>
        {acaoAtual ? (
          <button type="button" className={botaoAcao} onClick={acaoAtual.executar} disabled={acaoAtual.desabilitado}>
            {acaoAtual.rotulo}
          </button>
        ) : null}
        <span className="mx-2 h-6 w-px bg-white/20" aria-hidden="true" />
        <button type="button" className={cn(botao, "w-auto gap-2 px-4 text-sm font-semibold")} onClick={abrirTelao} title="Os slides vão para uma segunda janela (o projetor); aqui ficam o próximo slide, o tempo e as anotações">
          <MonitorUp className="size-5" />
          <span className="hidden sm:inline">Tela do apresentador</span>
        </button>
        <button type="button" className={botao} onClick={alternarTelaCheia} aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"}>
          {cheia ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        </button>
        <button type="button" className={botao} onClick={onFechar} aria-label="Fechar apresentação">
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}

/** Mede a área disponível e entrega largura e altura para o conteúdo. */
function AreaMedida({ children }: { children: (largura: number, altura: number) => ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<{ l: number; a: number } | null>(null);
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setT({ l: el.clientWidth, a: el.clientHeight });
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={caixa} className="flex size-full items-center justify-center">
      {t ? children(t.l, t.a) : null}
    </div>
  );
}

/**
 * PDF com um slide por página (1920×1080). Os slides são desenhados fora da
 * tela pela página e capturados aqui, um a um.
 */
export async function gerarPdfDosSlides(nos: HTMLElement[], nomeArquivo: string, onProgresso?: (feitos: number) => void) {
  const [{ toJpeg }, { pdf, Document, Page, Image }, { createElement }] = await Promise.all([
    import("html-to-image"),
    import("@react-pdf/renderer"),
    import("react"),
  ]);
  await document.fonts.ready;
  const imagens: string[] = [];
  for (const [i, no] of nos.entries()) {
    imagens.push(await toJpeg(no, { width: SLIDE_L, height: SLIDE_A, pixelRatio: 1, quality: 0.9, cacheBust: true }));
    onProgresso?.(i + 1);
  }
  // Página em pontos (proporção 16:9): 960×540.
  const documento = createElement(
    Document,
    { title: nomeArquivo.replace(/\.pdf$/, ""), author: "Comitê Atletas Energisa" },
    ...imagens.map((src, i) =>
      createElement(Page, { key: i, size: [960, 540], style: { padding: 0 } }, createElement(Image, { src, style: { width: 960, height: 540 } })),
    ),
  );
  const blob = await pdf(documento).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
