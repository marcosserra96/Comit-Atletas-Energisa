import { ShieldAlert } from "lucide-react";

export function NotAuthorized() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <ShieldAlert className="size-6" />
      </span>
      <p className="text-base font-bold text-text">Acesso restrito</p>
      <p className="max-w-xs text-sm text-text-light">
        Esta área não está disponível para o seu perfil.
      </p>
    </div>
  );
}
