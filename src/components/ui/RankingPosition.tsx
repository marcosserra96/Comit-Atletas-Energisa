import React from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface RankingPositionProps {
  position: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RankingPosition({ position, size = 'md', className }: RankingPositionProps) {
  const isMedal = position >= 1 && position <= 3;
  
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base"
  };

  const getMedalStyles = () => {
    switch (position) {
      case 1:
        return "bg-[var(--color-ranking-gold-bg)] text-[var(--color-ranking-gold-text)] border-[var(--color-ranking-gold)] border-2";
      case 2:
        return "bg-[var(--color-ranking-silver-bg)] text-[var(--color-ranking-silver-text)] border-[var(--color-ranking-silver)] border-2";
      case 3:
        return "bg-[var(--color-ranking-bronze-bg)] text-[var(--color-ranking-bronze-text)] border-[var(--color-ranking-bronze)] border-2";
      default:
        return "bg-[var(--color-bg-inset)] text-[var(--color-text-secondary)] border-[var(--color-border)] border";
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center font-bold rounded-[var(--radius-full)] shadow-sm",
        sizeClasses[size],
        getMedalStyles(),
        className
      )}
    >
      {isMedal ? (
        <span className="sr-only">{position}º lugar</span>
      ) : null}
      
      {isMedal && size === 'lg' ? (
        <Trophy size={18} />
      ) : (
        <span>{position}º</span>
      )}
    </div>
  );
}
