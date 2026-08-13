import React, { ReactNode } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface InlineAlertProps {
  tone: 'info' | 'success' | 'warning' | 'danger';
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

const toneConfig = {
  info: {
    icon: Info,
    bg: 'bg-[var(--color-info-subtle)]',
    border: 'border-l-[var(--color-info)]',
    text: 'text-[var(--color-info)]',
  },
  success: {
    icon: CheckCircle,
    bg: 'bg-[var(--color-success-subtle)]',
    border: 'border-l-[var(--color-success)]',
    text: 'text-[var(--color-success)]',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-[var(--color-warning-subtle)]',
    border: 'border-l-[var(--color-warning)]',
    text: 'text-[var(--color-warning)]',
  },
  danger: {
    icon: XCircle,
    bg: 'bg-[var(--color-danger-subtle)]',
    border: 'border-l-[var(--color-danger)]',
    text: 'text-[var(--color-danger)]',
  },
};

export function InlineAlert({ tone, icon, children, className }: InlineAlertProps) {
  const config = toneConfig[tone];
  const Icon = icon || config.icon;

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 p-4 rounded-[var(--radius)] border border-l-4",
        config.bg,
        config.border,
        className
      )}
    >
      <div className={cn("flex-shrink-0 mt-0.5", config.text)}>
        <Icon size={20} />
      </div>
      <div className="text-sm text-[var(--color-text)]">
        {children}
      </div>
    </div>
  );
}
