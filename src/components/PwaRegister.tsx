"use client";

import { useEffect } from "react";
import { iniciarInstalacao } from "@/lib/pwa/instalacao";

export function PwaRegister() {
  useEffect(() => {
    // Começa a ouvir o convite de instalação do navegador o quanto antes.
    iniciarInstalacao();
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A falha no registro não impede o uso normal do portal.
    });
  }, []);

  return null;
}
