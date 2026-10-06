import type { EventoDoc } from "@/lib/types";

export function ehReuniao(evento: Pick<EventoDoc, "tipo">) {
  return evento.tipo === "reuniao";
}

/** Só online (marcado no cadastro ou, nos antigos, local escrito "Online"). */
export function eventoOnline(evento: Pick<EventoDoc, "online" | "local">) {
  return evento.online === true || /^\s*online\s*$/i.test(evento.local ?? "");
}

/** "19:00 às 20:30" (ou só o início). Vazio quando não há horário. */
export function horarioDoEvento(evento: Pick<EventoDoc, "horaInicio" | "horaFim">) {
  if (!evento.horaInicio) return "";
  return evento.horaFim ? `${evento.horaInicio} às ${evento.horaFim}` : evento.horaInicio;
}

/** Intenção de ir (RSVP). Em reunião, a presença de fato é registrada no dia. */
export function rotuloRsvp(evento: Pick<EventoDoc, "tipo">, confirmado: boolean) {
  if (ehReuniao(evento)) return confirmado ? "Não vou mais" : "Vou participar";
  return confirmado ? "Cancelar presença" : "Confirmar presença";
}
