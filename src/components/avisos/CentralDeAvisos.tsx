"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CheckCircle2, ChevronRight, ClipboardList, UsersRound } from "lucide-react";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { usePesquisasDoAtleta } from "@/components/pesquisas/PesquisasAtleta";
import { useReuniaoAgora } from "@/components/reunioes/AvisoReuniao";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatarDataHora } from "@/lib/pesquisas";
import { textoDaFase } from "@/lib/reunioes";

export interface AvisoDoAtleta {
  chave: string;
  tipo: "reuniao" | "pesquisa";
  titulo: string;
  detalhe: string;
  acao: string;
  href: string;
}

/** Pendências do atleta, da mais urgente para a menos: reunião agora, depois pesquisas. */
export function useAvisosDoAtleta(): AvisoDoAtleta[] {
  const { reuniao } = useReuniaoAgora();
  const { pendentes } = usePesquisasDoAtleta();
  const { withPreview } = useAthleteView();
  const avisos: AvisoDoAtleta[] = [];
  if (reuniao) {
    avisos.push({
      chave: `reuniao-${reuniao.id}`,
      tipo: "reuniao",
      titulo: reuniao.titulo,
      detalhe: textoDaFase(reuniao),
      acao: "Registrar presença",
      href: withPreview(`/presenca/${reuniao.id}`),
    });
  }
  for (const p of pendentes) {
    avisos.push({
      chave: `pesquisa-${p.id}`,
      tipo: "pesquisa",
      titulo: p.titulo,
      detalhe: `Pesquisa · responda até ${formatarDataHora(p.fechaEm)}`,
      acao: "Responder",
      href: withPreview(`/pesquisas/${p.id}`),
    });
  }
  return avisos;
}

const ICONE = { reuniao: UsersRound, pesquisa: ClipboardList } as const;
const COR = {
  reuniao: "bg-accent-subtle text-accent",
  pesquisa: "bg-primary-subtle text-primary",
} as const;

function LinhaAviso({ aviso, onEscolher }: { aviso: AvisoDoAtleta; onEscolher?: () => void }) {
  const Icone = ICONE[aviso.tipo];
  return (
    <Link
      href={aviso.href}
      onClick={onEscolher}
      className="group flex min-h-16 items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 transition-colors hover:bg-bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)]", COR[aviso.tipo])}>
        <Icone className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text">{aviso.titulo}</span>
        <span className="block truncate text-xs text-text-light">{aviso.detalhe}</span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-primary">
        <span className="hidden sm:inline">{aviso.acao}</span>
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

/** Sino no topo: o número mostra o que falta fazer; abre a lista ali mesmo. */
export function SinoDeAvisos() {
  const avisos = useAvisosDoAtleta();
  const { withPreview } = useAthleteView();
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [rotaAberta, setRotaAberta] = useState(pathname);
  const raiz = useRef<HTMLDivElement>(null);
  const idPainel = useId();

  // Mudou de página: fecha o painel.
  if (rotaAberta !== pathname) {
    setRotaAberta(pathname);
    if (aberto) setAberto(false);
  }

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const total = avisos.length;

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={idPainel}
        aria-label={total ? `Avisos: ${total} pendente${total > 1 ? "s" : ""}` : "Avisos"}
        className={cn(
          "relative flex size-11 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          aberto && "bg-bg text-text",
        )}
      >
        <Bell className={cn("size-5", total > 0 && "text-text")} aria-hidden="true" />
        {total > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-[18px] text-white ring-2 ring-bg-card">
            {total > 9 ? "9+" : total}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div
          id={idPainel}
          role="dialog"
          aria-label="Avisos"
          className="fixed inset-x-3 top-[4.25rem] z-30 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-card shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-bold text-text">Para você</p>
            {total > 0 ? <span className="text-xs font-semibold text-text-light">{total} pendente{total > 1 ? "s" : ""}</span> : null}
          </div>
          {total > 0 ? (
            <div className="flex max-h-[60vh] flex-col overflow-y-auto p-1.5">
              {avisos.map((a) => (
                <LinhaAviso key={a.chave} aviso={a} onEscolher={() => setAberto(false)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <CheckCircle2 className="size-8 text-success" aria-hidden="true" />
              <p className="font-semibold text-text">Tudo em dia</p>
              <p className="text-sm text-text-light">Quando houver pesquisa ou reunião, ela aparece aqui.</p>
            </div>
          )}
          <Link
            href={withPreview("/pesquisas")}
            onClick={() => setAberto(false)}
            className="flex items-center justify-center gap-1 border-t border-border px-4 py-3 text-sm font-semibold text-text-light transition-colors hover:bg-bg-inset hover:text-text"
          >
            Ver pesquisas respondidas
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** Bloco no Início: só aparece quando há algo para fazer. */
export function PendenciasNoInicio({ className }: { className?: string }) {
  const avisos = useAvisosDoAtleta();
  if (avisos.length === 0) return null;
  return (
    <Card className={cn("flex flex-col gap-1 p-2 sm:p-3", className)}>
      <p className="px-3 pt-2 text-xs font-bold uppercase tracking-wide text-text-muted">Para você agora</p>
      {avisos.map((a) => (
        <LinhaAviso key={a.chave} aviso={a} />
      ))}
    </Card>
  );
}
