import { Loader2 } from "lucide-react";

export function FullScreenLoader({
  message = "Carregando...",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 bg-bg px-6 text-center"
    >
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm font-medium text-text-light">{message}</p>
    </div>
  );
}
