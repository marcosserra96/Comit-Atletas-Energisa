"use client";

import { useEffect } from "react";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A falha no registro não impede o uso normal do portal.
    });
  }, []);

  return <PwaInstallPrompt />;
}
