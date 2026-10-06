/**
 * "Não vou" num evento ou reunião, com o motivo. Fica numa coleção só do
 * servidor (`ausencias_eventos`): motivo de saúde é dado sensível, então só o
 * próprio atleta e o comitê com a permissão de eventos enxergam.
 */

export type MotivoAusenciaEvento = "trabalho" | "viagem" | "saude" | "pessoal" | "outro";

export const MOTIVOS_AUSENCIA_EVENTO: { value: MotivoAusenciaEvento; label: string }[] = [
  { value: "trabalho", label: "Trabalho" },
  { value: "viagem", label: "Viagem" },
  { value: "saude", label: "Saúde ou lesão" },
  { value: "pessoal", label: "Compromisso pessoal" },
  { value: "outro", label: "Outro motivo" },
];

export const motivoAusenciaEventoLabel = Object.fromEntries(
  MOTIVOS_AUSENCIA_EVENTO.map((m) => [m.value, m.label]),
) as Record<MotivoAusenciaEvento, string>;

export const DETALHE_MAXIMO = 300;

export interface AusenciaEvento {
  eventoId: string;
  atletaId: string;
  motivo: MotivoAusenciaEvento;
  detalhe: string;
  /** ISO de quando avisou. */
  em: string | null;
}

/** Id do documento: um aviso por atleta e evento. */
export function idAusenciaEvento(eventoId: string, atletaId: string) {
  return `${eventoId}__${atletaId}`;
}

/** Valida o que veio do formulário. Retorna a mensagem de erro, ou os dados limpos. */
export function validarAusenciaEvento(
  entrada: { motivo?: unknown; detalhe?: unknown },
): { erro: string } | { motivo: MotivoAusenciaEvento; detalhe: string } {
  const motivo = entrada.motivo as MotivoAusenciaEvento;
  if (!MOTIVOS_AUSENCIA_EVENTO.some((m) => m.value === motivo)) return { erro: "Escolha o motivo." };
  const detalhe = typeof entrada.detalhe === "string" ? entrada.detalhe.trim().replace(/\s+/g, " ") : "";
  if (detalhe.length > DETALHE_MAXIMO) return { erro: `Use até ${DETALHE_MAXIMO} caracteres.` };
  if (motivo === "outro" && detalhe.length < 3) return { erro: "Conte em poucas palavras o motivo." };
  return { motivo, detalhe };
}

/** "Trabalho · plantão no fim de semana" */
export function textoAusencia(a: Pick<AusenciaEvento, "motivo" | "detalhe">) {
  const rotulo = motivoAusenciaEventoLabel[a.motivo] ?? "Outro motivo";
  return a.detalhe ? `${rotulo} · ${a.detalhe}` : rotulo;
}
