import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
export { dadosAtletaPublico } from "@/lib/athleteVisibility";

export const PRIVACIDADE_ATLETAS_REF = ["configuracoes", "privacidade_atletas"] as const;

export function atletaPublicoRef(atletaId: string) {
  return doc(db, "atletas_publicos", atletaId);
}
