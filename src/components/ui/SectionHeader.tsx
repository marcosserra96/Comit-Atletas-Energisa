import React, { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, icon: Icon, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-4 border-b border-border-subtle pb-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="size-5 text-primary" aria-hidden="true" />}
          <h2 className="text-lg font-semibold tracking-tight text-text">{title}</h2>
        </div>
        {action && <div className="flex items-center">{action}</div>}
      </div>
      {description && (
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      )}
    </div>
  );
}
