import React from 'react';
import { cn } from '@/lib/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius)] bg-[var(--color-bg-inset)]", className)}
      {...props}
    />
  );
}

export function SkeletonLine({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-4 w-full rounded-[var(--radius-sm)]", className)} {...props} />;
}

export function SkeletonCard({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn("h-32 w-full rounded-[var(--radius-lg)]", className)} {...props} />;
}

export function SkeletonMetric({ className, ...props }: SkeletonProps) {
  return (
    <div className={cn("bg-[var(--color-bg-card)] rounded-[var(--radius-lg)] p-5 border border-[var(--color-border-subtle)] flex justify-between items-start", className)} {...props}>
      <div className="flex flex-col gap-2 w-full">
        <SkeletonLine className="h-4 w-1/3" />
        <SkeletonLine className="h-8 w-1/2" />
        <SkeletonLine className="h-4 w-2/3 mt-2" />
      </div>
      <Skeleton className="w-10 h-10 rounded-[var(--radius-full)] flex-shrink-0 ml-4" />
    </div>
  );
}
