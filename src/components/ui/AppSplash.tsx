import Image from "next/image";
import { Loader2 } from "lucide-react";

export function AppSplash({
  message = "Preparando seu acesso...",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className="relative isolate flex min-h-dvh flex-1 overflow-hidden bg-navy px-6 text-center text-white [padding-top:max(2rem,env(safe-area-inset-top))] [padding-bottom:max(2rem,env(safe-area-inset-bottom))]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 top-1/4 size-72 rounded-full bg-secondary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-10 size-80 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 left-1/3 size-72 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative z-10 m-auto flex w-full max-w-sm flex-col items-center">
        <Image
          src="/logos/logo-comite-branca-trim.png"
          alt="Atletas Energisa"
          width={320}
          height={107}
          priority
          className="h-auto w-[min(78vw,320px)] drop-shadow-[0_14px_30px_rgba(0,0,0,0.28)]"
        />

        <p className="mt-7 text-xs font-bold tracking-[0.3em] text-primary sm:text-sm">
          MOVIMENTO QUE CONECTA
        </p>

        <div className="mt-10 flex min-h-11 items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-5 text-white/75 backdrop-blur-sm">
          <Loader2
            className="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="text-sm font-medium">{message}</span>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent"
      />
    </div>
  );
}
