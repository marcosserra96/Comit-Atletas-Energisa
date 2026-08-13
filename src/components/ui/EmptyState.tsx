import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-bg text-text-muted">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-text">{title}</p>
      <p className="text-xs text-text-light">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
