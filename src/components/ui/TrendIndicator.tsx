import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TrendIndicatorProps {
  value: number;
  label?: string;
  inverted?: boolean;
  className?: string;
}

export function TrendIndicator({ value, label, inverted = false, className }: TrendIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = value === 0;

  // If inverted, negative is good (success) and positive is bad (danger)
  let textColorClass = "text-[var(--color-text-muted)]";
  if (isPositive) {
    textColorClass = inverted ? "text-[var(--color-danger)]" : "text-[var(--color-success)]";
  } else if (isNegative) {
    textColorClass = inverted ? "text-[var(--color-success)]" : "text-[var(--color-danger)]";
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5 font-medium", textColorClass, className)}>
      {isPositive ? (
        <TrendingUp size={16} />
      ) : isNegative ? (
        <TrendingDown size={16} />
      ) : (
        <Minus size={16} />
      )}
      
      <span>
        {isPositive ? '+' : ''}{value}%
        {label && <span className="ml-1 text-[var(--color-text-secondary)] font-normal">{label}</span>}
      </span>
    </div>
  );
}
