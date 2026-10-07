"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
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

/** Tela cheia para o telão: setas/espaço avançam, Esc sai, controles somem parados. */
export function Apresentador({
  total,
  inicial,
  renderSlide,
  onFechar,
}: {
  total: number;
  inicial: number;
  renderSlide: (indice: number) => ReactNode;
  onFechar: () => void;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(Math.min(inicial, Math.max(0, total - 1)));
  const [escala, setEscala] = useState(1);
  const [controles, setControles] = useState(true);
  const [cheia, setCheia] = useState(false);
  const toque = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ir = useCallback((delta: number) => setIndice((i) => Math.max(0, Math.min(total - 1, i + delta))), [total]);

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

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        ir(1);
      } else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        ir(-1);
      } else if (e.key === "Home") setIndice(0);
      else if (e.key === "End") setIndice(total - 1);
      else if (e.key === "Escape" && !document.fullscreenElement) onFechar();
    };
    const fs = () => setCheia(!!document.fullscreenElement);
    window.addEventListener("keydown", tecla);
    document.addEventListener("fullscreenchange", fs);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.removeEventListener("fullscreenchange", fs);
      document.body.style.overflow = "";
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ir, onFechar, total]);

  // Abre já em tela cheia quando o navegador permite.
  useEffect(() => {
    raiz.current?.requestFullscreen?.().catch(() => undefined);
    // Controles começam visíveis e somem sozinhos.
    timer.current = setTimeout(() => setControles(false), 2500);
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  const alternarTelaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void raiz.current?.requestFullscreen?.().catch(() => undefined);
  };

  const botao =
    "flex size-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-30";

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
        <div style={{ width: SLIDE_L, height: SLIDE_A, transform: `scale(${escala})`, transformOrigin: "top left" }}>{renderSlide(indice)}</div>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-5 transition-opacity duration-300",
          controles ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <button type="button" className={botao} onClick={() => ir(-1)} disabled={indice === 0} aria-label="Slide anterior">
          <ChevronLeft className="size-6" />
        </button>
        <span className="min-w-20 text-center text-sm font-semibold tabular-nums text-white">
          {indice + 1} / {total}
        </span>
        <button type="button" className={botao} onClick={() => ir(1)} disabled={indice >= total - 1} aria-label="Próximo slide">
          <ChevronRight className="size-6" />
        </button>
        <span className="mx-2 h-6 w-px bg-white/20" aria-hidden="true" />
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
