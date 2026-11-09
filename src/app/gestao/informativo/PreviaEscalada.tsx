"use client";

import { useEffect, useRef, useState } from "react";

/** Mostra a arte em tamanho real reduzida para caber na largura disponível. */
export function PreviaEscalada({ largura, altura, children }: { largura: number; altura: number; children: React.ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.3);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) => setEscala(entrada.contentRect.width / largura));
    obs.observe(el);
    return () => obs.disconnect();
  }, [largura]);
  return (
    <div ref={caixa} className="w-full">
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-elevated)]"
        style={{ height: altura * escala }}
      >
        <div style={{ transform: `scale(${escala})`, transformOrigin: "top left", width: largura, height: altura }}>
          {children}
        </div>
      </div>
    </div>
  );
}
