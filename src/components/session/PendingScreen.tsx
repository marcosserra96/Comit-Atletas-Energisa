"use client";

import { Clock3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function PendingScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-bg-card p-9 text-center shadow-xl">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Clock3 className="size-6" />
        </span>
        <h1 className="mb-2 text-lg font-bold text-text">Acesso em análise</h1>
        <p className="mb-7 text-sm leading-relaxed text-text-light">
          Seu cadastro foi enviado para o Comitê. Assim que o acesso for liberado, entraremos em
          contato.
        </p>
        <Button variant="secondary" className="w-full" onClick={onLogout}>
          <LogOut className="size-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
