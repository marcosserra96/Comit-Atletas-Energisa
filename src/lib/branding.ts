import type { BrandingDoc } from "@/lib/types";

const STORAGE_KEY = "atletas-energisa-branding";

export const BRANDING_PADRAO: BrandingDoc = {
  primary: "#009bc1",
  secondary: "#00b37e",
  accent: "#f37021",
  danger: "#e63946",
  loginStyle: "gradiente",
  loginCorInicio: "#07192d",
  loginCorFim: "#00836e",
};

function hexToRgb(hex: string) {
  const limpo = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(limpo)) return null;
  return {
    r: parseInt(limpo.slice(0, 2), 16),
    g: parseInt(limpo.slice(2, 4), 16),
    b: parseInt(limpo.slice(4, 6), 16),
  };
}

/** Escurece (percentual negativo) ou clareia (positivo) uma cor hex. */
export function ajustarHex(hex: string, percentual: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const fator = percentual / 100;
  const calc = (v: number) =>
    Math.max(0, Math.min(255, Math.round(percentual < 0 ? v * (1 + fator) : v + (255 - v) * fator)));
  return `#${[calc(rgb.r), calc(rgb.g), calc(rgb.b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Valor CSS (cor sólida ou gradiente) para o painel de marca da tela de login. */
export function loginBackground(b: Pick<BrandingDoc, "loginStyle" | "loginCorInicio" | "loginCorFim">) {
  if (b.loginStyle === "solido") return b.loginCorInicio;
  return `linear-gradient(155deg, ${b.loginCorInicio} 0%, ${b.loginCorFim} 100%)`;
}

export function normalizarBranding(config: Partial<BrandingDoc> = {}): BrandingDoc {
  return { ...BRANDING_PADRAO, ...config };
}

export function applyBranding(config: Partial<BrandingDoc>) {
  const b = normalizarBranding(config);
  const root = document.documentElement.style;
  root.setProperty("--color-primary", b.primary);
  root.setProperty("--color-primary-hover", ajustarHex(b.primary, -16));
  root.setProperty("--color-secondary", b.secondary);
  root.setProperty("--color-accent", b.accent);
  root.setProperty("--color-danger", b.danger);
  root.setProperty("--login-bg", loginBackground(b));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    // localStorage indisponível (modo privado, etc.) — sem cache, sem problema.
  }
  return b;
}

export function getStoredBranding(): BrandingDoc {
  if (typeof window === "undefined") return BRANDING_PADRAO;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizarBranding(JSON.parse(raw));
  } catch {
    // ignora cache corrompido
  }
  return BRANDING_PADRAO;
}
