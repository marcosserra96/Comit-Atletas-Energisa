import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "primary" | "success" | "warning" | "danger" | "neutral" | "sport-running" | "sport-cycling";

const toneClasses: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-ranking-gold-text",
  danger: "bg-danger/10 text-danger",
  neutral: "bg-text-muted/10 text-text-light",
  "sport-running": "bg-sport-running-subtle text-sport-running",
  "sport-cycling": "bg-sport-cycling-subtle text-sport-cycling",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
