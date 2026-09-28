"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
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
      <SegmentedControl
        value={theme}
        onChange={handleChange}
        options={[
          { value: "light", label: "Claro", icon: Sun },
          { value: "dark", label: "Escuro", icon: Moon },
        ]}
      />
    </Card>
  );
}
