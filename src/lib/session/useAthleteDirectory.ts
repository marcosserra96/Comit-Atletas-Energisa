"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AthleteDirectoryCollection = "atletas" | "atletas_publicos";

export function useAthleteDirectoryCollection() {
  const [collectionName, setCollectionName] = useState<AthleteDirectoryCollection | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "configuracoes", "privacidade_atletas"),
      (snapshot) => {
        setCollectionName(snapshot.data()?.ativa === true ? "atletas_publicos" : "atletas");
      },
      () => setCollectionName("atletas"),
    );
    return unsubscribe;
  }, []);

  return collectionName;
}
