"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: LucideIcon }[];
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  const grupo = useId();
  return (
    <div
      role="group"
      className={cn(
        "flex w-fit gap-1 rounded-[var(--radius)] border border-border bg-bg p-[3px]",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "relative flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            value === opt.value ? "font-semibold text-primary" : "text-text-light hover:text-text",
          )}
        >
          {value === opt.value ? (
            <motion.span
              layoutId={`${grupo}-selecionado`}
              transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.8 }}
              aria-hidden="true"
              className="absolute inset-0 rounded-[calc(var(--radius)-2px)] bg-bg-card shadow-sm"
            />
          ) : null}
          {opt.icon && <opt.icon className="relative size-3.5" />}
          <span className="relative">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
