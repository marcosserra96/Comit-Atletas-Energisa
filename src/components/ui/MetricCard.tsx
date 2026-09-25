import React from "react";
import { ChevronRight, LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label?: string };
  subtitle?: string;
  className?: string;
  onClick?: () => void;
  detailLabel?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  iconColor,
  trend,
  subtitle,
  className,
  onClick,
  detailLabel = "Ver detalhes",
}: MetricCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {label}
          </span>
          <span className="truncate text-xl font-extrabold leading-tight text-text sm:text-2xl">
            {value}
          </span>
        </div>
        {Icon && (
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)]"
            style={{
              backgroundColor: iconColor
                ? `color-mix(in srgb, ${iconColor} 10%, transparent)`
                : "var(--color-primary-subtle)",
              color: iconColor ?? "var(--color-primary)",
            }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>

      {(trend || subtitle) && (
        <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                trend.value > 0 && "text-success",
                trend.value < 0 && "text-danger",
                trend.value === 0 && "text-text-muted",
              )}
            >
              {trend.value > 0 ? (
                <TrendingUp className="size-3.5" />
              ) : trend.value < 0 ? (
                <TrendingDown className="size-3.5" />
              ) : (
                <Minus className="size-3.5" />
              )}
              {trend.value > 0 ? "+" : ""}
              {trend.value}%
            </span>
          )}
          {(trend?.label || subtitle) && (
            <span className="text-text-light">{trend?.label || subtitle}</span>
          )}
        </div>
      )}
      {onClick ? (
        <span className="mt-3 flex items-center justify-end gap-1 border-t border-border-subtle pt-3 text-xs font-semibold text-primary">
          {detailLabel}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </span>
      ) : null}
    </>
  );

  const classes = cn(
    "min-w-0 rounded-[var(--radius-lg)] border border-border-subtle bg-bg-card p-4 shadow-[var(--shadow-card)]",
    "transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]",
    onClick && "cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    className,
  );

  return onClick ? (
    <button type="button" className={classes} onClick={onClick} aria-label={`${detailLabel}: ${label}`}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}
