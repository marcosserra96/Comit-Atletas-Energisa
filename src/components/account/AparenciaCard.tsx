"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

export function AparenciaCard() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  function handleChange(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-text">
        <Sun className="size-4 text-text-muted" />
        Aparência
      </h3>
      <p className="mb-2 text-xs text-text-light">Tema</p>
      <div className="flex w-fit gap-1 rounded-[var(--radius)] border border-border bg-bg p-1">
        <button
          onClick={() => handleChange("light")}
          className={cn(
            "flex items-center gap-2 rounded-[calc(var(--radius)-2px)] px-4 py-2 text-sm font-semibold transition-colors",
            theme === "light" ? "bg-bg-card text-primary shadow-sm" : "text-text-light",
          )}
        >
          <Sun className="size-4" />
          Claro
        </button>
        <button
          onClick={() => handleChange("dark")}
          className={cn(
            "flex items-center gap-2 rounded-[calc(var(--radius)-2px)] px-4 py-2 text-sm font-semibold transition-colors",
            theme === "dark" ? "bg-bg-card text-primary shadow-sm" : "text-text-light",
          )}
        >
          <Moon className="size-4" />
          Escuro
        </button>
      </div>
    </Card>
  );
}
