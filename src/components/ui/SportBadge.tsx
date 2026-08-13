import React from "react";
import { Bike, Footprints } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SportBadgeProps {
  modalidade?: "corrida" | "bicicleta" | "ambas" | null;
  /** Alias for modalidade */
  sport?: "corrida" | "bicicleta" | "ambas" | string | null;
  size?: "sm" | "md";
  className?: string;
}

export function SportBadge({ modalidade, sport, size = "md", className }: SportBadgeProps) {
  const mod = modalidade || sport;
  if (!mod || mod === "ambas") return null;
  if (mod !== "corrida" && mod !== "bicicleta") return null;

  const isBicicleta = mod === "bicicleta";
  const Icon = isBicicleta ? Bike : Footprints;

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center border font-medium",
        size === "sm"
          ? "gap-1 rounded-[var(--radius-sm)] px-2 py-0.5 text-xs"
          : "gap-1.5 rounded-[var(--radius)] px-3 py-1 text-sm",
        isBicicleta
          ? "border-sport-cycling/20 bg-sport-cycling-subtle text-sport-cycling"
          : "border-sport-running/20 bg-sport-running-subtle text-sport-running",
        className,
      )}
      title={isBicicleta ? "Ciclismo" : "Corrida"}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={2.5} />
      <span className="capitalize">{isBicicleta ? "Ciclismo" : "Corrida"}</span>
    </div>
  );
}
