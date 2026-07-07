import { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-bg text-text-muted">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-semibold text-text">{title}</p>
      <p className="max-w-[220px] text-xs text-text-light">{description}</p>
    </div>
  );
}
