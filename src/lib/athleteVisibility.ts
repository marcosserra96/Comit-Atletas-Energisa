import type { AtletaDoc, AtletaPublicoDoc } from "@/lib/types";

type PerfilComVisibilidade = Pick<AtletaDoc, "visivelNasListas">;

/** Cadastros antigos, que ainda não possuem o campo, continuam visíveis. */
export function perfilAtletaVisivel(atleta: PerfilComVisibilidade) {
  return atleta.visivelNasListas !== false;
}

export function filtrarPerfisAtletasVisiveis<T extends PerfilComVisibilidade>(atletas: T[]) {
  return atletas.filter(perfilAtletaVisivel);
}

export function dadosAtletaPublico(
  atleta: Pick<
    AtletaDoc,
    "id" | "nome" | "equipe" | "ativo" | "pontuacaoTotal" | "visivelNasListas"
  >,
): AtletaPublicoDoc {
  return {
    id: atleta.id,
    nome: atleta.nome,
    equipe: atleta.equipe,
    ativo: atleta.ativo,
    visivelNasListas: perfilAtletaVisivel(atleta),
    pontuacaoTotal: atleta.pontuacaoTotal,
  };
}
