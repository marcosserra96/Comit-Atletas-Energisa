/** Onde estamos dentro de um período de datas civis (inclusivas, "YYYY-MM-DD"). */
export interface TempoDoPeriodo {
  fase: "antes" | "durante" | "depois";
  /** Dias até o fim, contando hoje (durante); dias até começar (antes); 0 (depois). */
  dias: number;
  /** 0 a 1: quanto do período já passou. */
  progresso: number;
}

function diaUtc(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
}

function hojeBrasil(agora: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export function tempoDoPeriodo(inicio: string, fim: string, agora = new Date()): TempoDoPeriodo {
  const hoje = diaUtc(hojeBrasil(agora));
  const ini = diaUtc(inicio);
  const fi = diaUtc(fim);
  const total = Math.max(1, fi - ini + 1);
  if (hoje < ini) return { fase: "antes", dias: ini - hoje, progresso: 0 };
  if (hoje > fi) return { fase: "depois", dias: 0, progresso: 1 };
  return { fase: "durante", dias: fi - hoje + 1, progresso: (hoje - ini + 1) / total };
}

/** "Faltam 12 dias" / "Último dia" / "Começa em 3 dias" / "Encerrado". */
export function textoTempoDoPeriodo(t: TempoDoPeriodo) {
  if (t.fase === "antes") return t.dias === 1 ? "Começa amanhã" : `Começa em ${t.dias} dias`;
  if (t.fase === "depois") return "Encerrado · resultado em conferência";
  return t.dias === 1 ? "Último dia" : `Faltam ${t.dias} dias`;
}
