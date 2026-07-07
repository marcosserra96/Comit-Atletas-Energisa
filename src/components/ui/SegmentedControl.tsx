"use client";

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
            "flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] px-3.5 py-2 text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-bg-card font-semibold text-primary shadow-sm"
              : "text-text-light hover:text-text",
          )}
        >
          {opt.icon && <opt.icon className="size-3.5" />}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
