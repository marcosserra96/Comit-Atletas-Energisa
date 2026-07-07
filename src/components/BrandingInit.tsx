"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { applyBranding, getStoredBranding } from "@/lib/branding";

export function BrandingInit() {
  useEffect(() => {
    applyBranding(getStoredBranding());
    const unsubscribe = onSnapshot(
      doc(db, "configuracoes", "branding"),
      (snap) => {
        if (snap.exists()) applyBranding(snap.data());
      },
      () => {
        // Sem permissão ou offline — mantém o padrão/cache já aplicado.
      },
    );
    return unsubscribe;
  }, []);
  return null;
}
