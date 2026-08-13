import React from 'react';
import { cn } from '@/lib/cn';

export interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  className?: string;
}

export function ProgressRing({
  value,
  size = 90,
  strokeWidth = 8,
  color = 'var(--color-primary)',
  trackColor = 'var(--color-bg-inset)',
  label,
  sublabel,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  // Ensure value is between 0 and 100
  const safeValue = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div 
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      
      <div className="absolute flex flex-col items-center justify-center text-center px-2">
        {label ? (
          <span className="font-bold text-[var(--color-text)]" style={{ fontSize: size / 4.5 }}>
            {label}
          </span>
        ) : (
          <span className="font-bold text-[var(--color-text)]" style={{ fontSize: size / 4.5 }}>
            {Math.round(safeValue)}%
          </span>
        )}
        {sublabel && (
          <span className="text-[var(--color-text-secondary)] leading-none mt-1" style={{ fontSize: size / 8 }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
