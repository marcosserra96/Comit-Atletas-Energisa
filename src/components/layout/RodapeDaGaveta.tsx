"use client";

import { useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { AvatarAtleta } from "@/components/atletas/AvatarAtleta";

/**
 * Parte de baixo do menu lateral no celular: quem está conectado, o tema e o
 * "Sair". No celular esses controles saem da barra do topo, onde o "Sair"
 * ficava colado na foto e era fácil de tocar sem querer.
 */
export function RodapeDaGaveta({
  nome,
  foto,
  papel,
  onSair,
  comTema = false,
}: {
  nome: string;
  foto?: string;
  papel?: string;
  onSair: () => void;
  comTema?: boolean;
}) {
  const [tema, setTema] = useState<Theme>(() => getStoredTheme());

  function alternarTema() {
    const proximo = tema === "light" ? "dark" : "light";
    setTema(proximo);
    applyTheme(proximo);
  }

  return (
    <div className="flex flex-col gap-1 border-t border-white/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
      <div className="flex items-center gap-3 px-3 py-2">
        <AvatarAtleta nome={nome} foto={foto} className="size-9 text-xs" tom="bg-primary text-on-primary" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-white">{nome}</p>
          {papel ? <p className="truncate text-xs text-white/55">{papel}</p> : null}
        </div>
      </div>
      {comTema ? (
        <button
          type="button"
          onClick={alternarTema}
          className="flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          {tema === "light" ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
          {tema === "light" ? "Tema escuro" : "Tema claro"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onSair}
        className="flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
      >
        <LogOut className="size-[18px]" />
        Sair
      </button>
    </div>
  );
}
