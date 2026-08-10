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

/**
 * Verdadeiro quando o atleta tem vínculo real com o elenco (competindo ou na
 * fila), independente do "role" — um membro do Comitê pode também competir
 * (ver souTambemAtleta em lib/session/dualRole.ts), e nesse caso role é
 * "comite" mas equipe é "bicicleta"/"corrida". Só exclui quem é comitê puro
 * (equipe "comite", sem time) ou ainda sem vínculo definido ("nenhuma").
 */
export function ehMembroDoElenco(equipe: Equipe) {
  return equipe !== "comite" && equipe !== "nenhuma";
}

/** Verdadeiro quando o atleta está competindo de fato (não é fila de espera nem comitê puro). */
export function competeAtivamente(equipe: Equipe) {
  return equipe === "bicicleta" || equipe === "corrida";
}

export function modalidadeFromEquipe(equipe: Equipe) {
  if (equipe === "corrida" || equipe === "fila_corrida") return "corrida" as const;
  if (equipe === "bicicleta" || equipe === "fila_bicicleta") return "bicicleta" as const;
  return null;
}
