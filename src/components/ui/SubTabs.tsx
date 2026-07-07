"use client";

import { cn } from "@/lib/cn";

interface SubTabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}

export function SubTabs<T extends string>({ value, onChange, options }: SubTabsProps<T>) {
  return (
    <div className="flex w-fit flex-wrap gap-1 rounded-[var(--radius)] border border-border bg-bg-card p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[calc(var(--radius)-2px)] px-4 py-2 text-sm font-semibold transition-colors",
            value === opt.value ? "bg-primary text-white" : "text-text-light hover:text-text",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
