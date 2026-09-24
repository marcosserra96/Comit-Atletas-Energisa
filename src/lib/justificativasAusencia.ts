import type {
  JustificativaAusenciaDoc,
  MotivoAusencia,
  StatusJustificativaAusencia,
} from "@/lib/types";

export const MOTIVOS_AUSENCIA: Array<{ value: MotivoAusencia; label: string }> = [
  { value: "viagem", label: "Viagem" },
  { value: "doenca", label: "Doença" },
  { value: "lesao", label: "Lesão" },
  { value: "trabalho", label: "Trabalho" },
  { value: "pessoal", label: "Motivo pessoal" },
  { value: "outro", label: "Outro" },
];

export const motivoAusenciaLabel = Object.fromEntries(
  MOTIVOS_AUSENCIA.map((item) => [item.value, item.label]),
) as Record<MotivoAusencia, string>;

export const statusJustificativaLabel: Record<StatusJustificativaAusencia, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export const motivosAusenciaValidos = new Set<MotivoAusencia>(
  MOTIVOS_AUSENCIA.map((item) => item.value),
);

export function dataCivilValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export function intervaloAusenciaValido(inicio: string, fim: string) {
  return dataCivilValida(inicio) && dataCivilValida(fim) && inicio <= fim;
}

export function diasNoIntervalo(inicio: string, fim: string) {
  if (!intervaloAusenciaValido(inicio, fim)) return 0;
  const inicioMs = Date.parse(`${inicio}T00:00:00Z`);
  const fimMs = Date.parse(`${fim}T00:00:00Z`);
  return Math.floor((fimMs - inicioMs) / 86_400_000) + 1;
}

export function periodosAusenciaSobrepostos(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string,
) {
  return inicioA <= fimB && inicioB <= fimA;
}

export function justificativaAbrangeData(
  justificativa: Pick<JustificativaAusenciaDoc, "inicio" | "fim" | "status">,
  data: string,
) {
  return justificativa.status === "aprovada" && data >= justificativa.inicio && data <= justificativa.fim;
}

export function resumoJustificativa(
  justificativa: Pick<JustificativaAusenciaDoc, "motivo" | "descricao">,
) {
  const motivo = motivoAusenciaLabel[justificativa.motivo] ?? "Outro";
  return `${motivo}: ${justificativa.descricao.trim()}`;
}
