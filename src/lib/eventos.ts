import type { EventoDoc } from "@/lib/types";

export function ehReuniao(evento: Pick<EventoDoc, "tipo">) {
  return evento.tipo === "reuniao";
}

/** "19:00 às 20:30" (ou só o início). Vazio quando não há horário. */
export function horarioDoEvento(evento: Pick<EventoDoc, "horaInicio" | "horaFim">) {
  if (!evento.horaInicio) return "";
  return evento.horaFim ? `${evento.horaInicio} às ${evento.horaFim}` : evento.horaInicio;
}
