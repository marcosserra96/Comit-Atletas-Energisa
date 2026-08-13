import { Loader2 } from "lucide-react";

export function FullScreenLoader() {
  return (
    <div role="status" aria-label="Carregando" className="flex min-h-screen flex-1 items-center justify-center bg-bg">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}
