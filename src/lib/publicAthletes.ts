import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AtletaDoc, AtletaPublicoDoc } from "@/lib/types";

export const PRIVACIDADE_ATLETAS_REF = ["configuracoes", "privacidade_atletas"] as const;

export function atletaPublicoRef(atletaId: string) {
  return doc(db, "atletas_publicos", atletaId);
}

export function dadosAtletaPublico(
  atleta: Pick<AtletaDoc, "id" | "nome" | "equipe" | "ativo" | "pontuacaoTotal">,
): AtletaPublicoDoc {
  return {
    id: atleta.id,
    nome: atleta.nome,
    equipe: atleta.equipe,
    ativo: atleta.ativo,
    pontuacaoTotal: atleta.pontuacaoTotal,
  };
}
