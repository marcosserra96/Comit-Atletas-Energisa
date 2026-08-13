import React, { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, description, icon: Icon, actions, badge, className }: PageHeaderProps) {
  const sub = subtitle || description;
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="shrink-0 rounded-[var(--radius-lg)] bg-primary-subtle p-2.5 text-primary">
            <Icon className="size-6" aria-hidden="true" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text">
              {title}
            </h1>
            {badge && <div className="inline-flex">{badge}</div>}
          </div>
          {sub && (
            <p className="text-sm text-text-secondary">{sub}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>
      )}
    </div>
  );
}

