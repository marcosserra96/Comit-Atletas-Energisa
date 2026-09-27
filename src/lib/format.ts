export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

export function formatShortDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

/** Mostra a data normal com ano (evita ambiguidade em históricos com anos diferentes), ou "mês/ano (aproximado)" quando o dia exato não é conhecido (ex: migração de dados antigos). */
export function formatDataTreino(dataTreino: string, dataAproximada?: boolean) {
  const date = new Date(`${dataTreino}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  if (dataAproximada) {
    const mesAno = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(date);
    return `${mesAno} (aproximado)`;
  }
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function formatRelativeTime(value: unknown) {
  const date = toDate(value);
  if (!date) return "agora há pouco";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "agora há pouco";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

export function formatDateTime(value: unknown) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Número com casas decimais fixas no padrão brasileiro (vírgula): 12,5. */
export function formatDecimal(value: number, casas = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Quilometragem no padrão brasileiro: "12,5 km". */
export function formatKm(value: number) {
  return `${formatDecimal(value)} km`;
}

/**
 * Quantidade com a palavra no singular ou no plural: plural(1, "treino") →
 * "1 treino"; plural(3, "treino") → "3 treinos". Para plurais irregulares,
 * passe a forma plural: plural(2, "atleta ativo", "atletas ativos").
 */
export function plural(quantidade: number, singular: string, pluralForma = `${singular}s`) {
  return `${quantidade} ${quantidade === 1 ? singular : pluralForma}`;
}
