"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { regrasDeTreino } from "@/lib/activityConsolidation";
import type { RegraPontuacaoDoc } from "@/lib/types";

/**
 * IDs dos critérios que contam como treino (`regras_pontuacao`, coleção pequena).
 * `null` enquanto carrega — quem conta treinos espera, para não mostrar um número
 * menor e depois corrigir.
 */
export function useRegrasDeTreino() {
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(
    () =>
      onSnapshot(
        collection(db, "regras_pontuacao"),
        (snap) => setIds(regrasDeTreino(snap.docs.map((d) => ({ ...(d.data() as RegraPontuacaoDoc), id: d.id })))),
        () => setIds(new Set()),
      ),
    [],
  );
  return ids;
}
