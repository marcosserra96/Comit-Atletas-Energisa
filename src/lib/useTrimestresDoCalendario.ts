"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizarCalendario, ordenarTrimestres } from "@/lib/calendarioPremiacao";
import type { TrimestreDoResumo } from "@/lib/resumoPeriodo";

/**
 * Os trimestres do calendário de premiação, para o resumo do atleta (imagem e
 * destaque). Sem calendário cadastrado, a lista fica vazia e quem chama usa o
 * trimestre do ranking.
 */
export function useTrimestresDoCalendario(): TrimestreDoResumo[] {
  const [lista, setLista] = useState<TrimestreDoResumo[]>([]);
  useEffect(() => {
    let ativo = true;
    getDoc(doc(db, "configuracoes", "calendario_premiacao"))
      .then((snap) => {
        if (!ativo) return;
        const cal = normalizarCalendario(snap.data() as never);
        setLista(ordenarTrimestres(cal.trimestres).map((t) => ({ nome: t.nome, inicio: t.inicio, fim: t.fim })));
      })
      .catch(() => ativo && setLista([]));
    return () => {
      ativo = false;
    };
  }, []);
  return lista;
}
