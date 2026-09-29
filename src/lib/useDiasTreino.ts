"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizarDiasTreino, type DiasTreinoConfigDoc } from "@/lib/aderencia";

/** Agenda de treinos (`configuracoes/dias_treino`); `null` enquanto carrega. */
export function useDiasTreino() {
  const [config, setConfig] = useState<DiasTreinoConfigDoc | null>(null);
  useEffect(
    () =>
      onSnapshot(
        doc(db, "configuracoes", "dias_treino"),
        (snap) => setConfig(normalizarDiasTreino(snap.exists() ? (snap.data() as Partial<DiasTreinoConfigDoc>) : null)),
        () => setConfig(normalizarDiasTreino(null)),
      ),
    [],
  );
  return config;
}
