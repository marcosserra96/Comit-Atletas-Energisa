"use client";

import { useId } from "react";
import { Crown, Flame, Footprints, Medal as MedalIcon, Route, Trophy, UsersRound, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { IconeMedalha, NivelMedalha } from "@/lib/conquistas";

/**
 * Cores de cada nível. A medalha é um objeto com luz própria: as mesmas cores
 * nos temas claro e escuro (como o pódio do ranking).
 */
const METAL: Record<NivelMedalha, { claro: string; escuro: string; borda: string; icone: string }> = {
  1: { claro: "#E3A06A", escuro: "#9A5524", borda: "#7A3F16", icone: "#FFF4EA" }, // bronze
  2: { claro: "#EEF2F6", escuro: "#9AA7B6", borda: "#6E7C8D", icone: "#334155" }, // prata
  3: { claro: "#FCE38A", escuro: "#D19B0B", borda: "#9A6F00", icone: "#5C3D00" }, // ouro
  4: { claro: "#5EE0C1", escuro: "#0E8F78", borda: "#08604F", icone: "#F0FFFA" }, // energia
  5: { claro: "#2B5BA8", escuro: "#0B2C5F", borda: "#E9B730", icone: "#FFD86B" }, // lendária
};

const ICONE: Record<IconeMedalha, LucideIcon> = {
  treino: Footprints,
  km: Route,
  chama: Flame,
  recorde: Zap,
  prova: MedalIcon,
  reuniao: UsersRound,
  podio: Trophy,
  coroa: Crown,
};

/** Borda recortada (24 dentes), como uma medalha cunhada. */
function contornoRecortado(raio: number, dentes = 24, profundidade = 0.055) {
  const pontos: string[] = [];
  for (let i = 0; i < dentes * 2; i++) {
    const r = raio * (i % 2 === 0 ? 1 : 1 - profundidade);
    const a = (Math.PI * i) / dentes - Math.PI / 2;
    pontos.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pontos.join(" ");
}

const CONTORNO = contornoRecortado(48);

export function Medalha({
  icone,
  nivel,
  conquistada,
  progresso = 0,
  tamanho = 56,
  className,
  rotulo,
}: {
  icone: IconeMedalha;
  nivel: NivelMedalha;
  conquistada: boolean;
  /** 0 a 1, desenhado em volta da medalha bloqueada. */
  progresso?: number;
  tamanho?: number;
  className?: string;
  /** Texto para leitor de tela; sem ele a medalha é decorativa. */
  rotulo?: string;
}) {
  const id = useId().replace(/:/g, "");
  const metal = METAL[nivel];
  const Icone = ICONE[icone];
  const tamIcone = Math.round(tamanho * 0.36);
  const arco = 2 * Math.PI * 46;

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: tamanho, height: tamanho }}
      role={rotulo ? "img" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
    >
      <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} className="absolute inset-0 overflow-visible">
        {conquistada ? (
          <>
            <defs>
              <linearGradient id={`m-${id}`} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
                <stop offset="0" stopColor={metal.claro} />
                <stop offset="1" stopColor={metal.escuro} />
              </linearGradient>
              <linearGradient id={`d-${id}`} x1="0.85" y1="0.95" x2="0.15" y2="0.05">
                <stop offset="0" stopColor={metal.claro} />
                <stop offset="1" stopColor={metal.escuro} />
              </linearGradient>
            </defs>
            <polygon points={CONTORNO} fill={metal.borda} transform="translate(0 2.2)" opacity="0.35" />
            <polygon points={CONTORNO} fill={`url(#m-${id})`} stroke={metal.borda} strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="50" cy="50" r="35" fill={`url(#d-${id})`} stroke={metal.borda} strokeOpacity="0.55" strokeWidth="1.2" />
            <circle cx="50" cy="50" r="30.5" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="0.9" />
            {/* Brilho no alto, de onde vem a luz. */}
            <ellipse cx="38" cy="30" rx="16" ry="7.5" fill="#ffffff" opacity="0.32" transform="rotate(-28 38 30)" />
          </>
        ) : (
          <>
            <polygon points={CONTORNO} fill="var(--color-bg-inset)" stroke="var(--color-border)" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="50" cy="50" r="35" fill="var(--color-bg-card)" stroke="var(--color-border)" strokeWidth="1.2" strokeDasharray="3 3" />
            {progresso > 0 ? (
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray={`${arco * Math.min(1, progresso)} ${arco}`}
                transform="rotate(-90 50 50)"
              />
            ) : null}
          </>
        )}
      </svg>
      <Icone
        className="relative"
        style={{ width: tamIcone, height: tamIcone, color: conquistada ? metal.icone : "var(--color-text-muted)" }}
        strokeWidth={2.2}
        aria-hidden="true"
      />
    </span>
  );
}
