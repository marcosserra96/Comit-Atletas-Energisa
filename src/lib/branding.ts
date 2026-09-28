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

function luminancia(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b);
}

/** Razão de contraste WCAG entre duas cores hex (1 a 21). */
export function contraste(a: string, b: string) {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return 1;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Contraste mínimo para texto normal (WCAG AA). */
export const CONTRASTE_MINIMO = 4.5;
/** Fundo de página do tema claro — o mais claro onde texto colorido aparece. */
const FUNDO_CLARO = "#f0f4f8";
/** Card do tema escuro — onde texto colorido aparece no modo escuro. */
const FUNDO_ESCURO = "#161921";

/**
 * Ajusta a cor da marca só o necessário para ser legível sobre `fundo`:
 * escurece (fundo claro) ou clareia (fundo escuro) em passos pequenos até
 * atingir o contraste mínimo. Se a cor já passa, volta sem alteração.
 */
export function corLegivel(hex: string, fundo: string, minimo = CONTRASTE_MINIMO) {
  if (!hexToRgb(hex)) return hex;
  const escurecer = (luminancia(fundo) ?? 1) > 0.5;
  let cor = hex;
  for (let passo = 0; passo < 40 && contraste(cor, fundo) < minimo; passo++) {
    cor = ajustarHex(cor, escurecer ? -4 : 6);
  }
  return cor;
}

/** Variações legíveis de uma cor da marca para o tema claro e o escuro. */
export function variacoesLegiveis(hex: string) {
  return {
    claro: corLegivel(hex, FUNDO_CLARO),
    escuro: corLegivel(hex, FUNDO_ESCURO),
  };
}

/** Variação usada no tema claro (a que o painel de identidade visual mostra). */
export function corLegivelClara(hex: string) {
  return corLegivel(hex, FUNDO_CLARO).toLowerCase();
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
  // As cores escolhidas no painel são ajustadas para leitura (texto colorido e
  // texto branco sobre botões). O globals.css escolhe a variação clara ou escura
  // conforme o tema; por isso aqui só definimos as variáveis --brand-*.
  for (const chave of ["primary", "secondary", "accent", "danger"] as const) {
    const { claro, escuro } = variacoesLegiveis(b[chave]);
    root.setProperty(`--brand-${chave}-light`, claro);
    root.setProperty(`--brand-${chave}-dark`, escuro);
  }
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
