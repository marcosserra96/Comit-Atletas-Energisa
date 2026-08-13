import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "flat" | "transparent";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClasses = {
  default: "border border-border bg-bg-card shadow-[var(--shadow-card)]",
  elevated: "border border-border bg-elevated shadow-[var(--shadow-elevated)]",
  flat: "border border-border bg-bg-card",
  transparent: "bg-transparent border-transparent",
};

const paddingClasses = {
  none: "p-0",
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
};

export function Card({ className, variant = "default", padding = "md", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)]",
        variantClasses[variant],
        paddingClasses[padding],
        className,
      )}
      {...props}
    />
  );
}
