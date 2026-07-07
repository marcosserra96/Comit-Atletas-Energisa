import type { Equipe, Role } from "@/lib/types";

export const equipeLabel: Record<Equipe, string> = {
  corrida: "Corrida",
  bicicleta: "Bicicleta",
  fila_corrida: "Fila de espera · Corrida",
  fila_bicicleta: "Fila de espera · Bicicleta",
  comite: "Comitê",
  nenhuma: "Sem modalidade definida",
};

export const roleLabel: Record<Role, string> = {
  atleta: "Atleta",
  comite: "Comitê",
  administrador: "Administrador",
};

export function isWaitlisted(equipe: Equipe) {
  return equipe === "fila_corrida" || equipe === "fila_bicicleta";
}

export function modalidadeFromEquipe(equipe: Equipe) {
  if (equipe === "corrida" || equipe === "fila_corrida") return "corrida" as const;
  if (equipe === "bicicleta" || equipe === "fila_bicicleta") return "bicicleta" as const;
  return null;
}
