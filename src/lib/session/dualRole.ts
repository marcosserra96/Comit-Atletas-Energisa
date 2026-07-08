import type { AtletaDoc, UsuarioDoc } from "@/lib/types";

/**
 * Alguns membros do Comitê/Administração também competem no programa (mesma pessoa,
 * dois chapéus). Isso já é representável hoje sem campo novo: o vínculo `atletas.equipe`
 * é independente do `usuarios.role` — um "comite" cujo atleta vinculado tem equipe
 * "bicicleta"/"corrida" está de fato competindo, não é só um registro de staff.
 */
export function souTambemAtleta(usuario: UsuarioDoc, atleta: AtletaDoc): boolean {
  return usuario.role !== "atleta" && (atleta.equipe === "bicicleta" || atleta.equipe === "corrida");
}
