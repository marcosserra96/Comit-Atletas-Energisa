"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, ClipboardList, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePesquisasDoAtleta } from "@/components/pesquisas/PesquisasAtleta";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { formatarDataHora, situacaoPesquisa, type PesquisaDoc } from "@/lib/pesquisas";

function Linha({ pesquisa, respondida }: { pesquisa: PesquisaDoc; respondida: boolean }) {
  const { withPreview } = useAthleteView();
  const situacao = situacaoPesquisa(pesquisa);
  return (
    <Link
      href={withPreview(`/pesquisas/${pesquisa.id}`)}
      className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)]",
          respondida ? "bg-success/10 text-success" : "bg-primary-subtle text-primary",
        )}
      >
        {respondida ? <CheckCircle2 className="size-5" /> : <ClipboardList className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-text">{pesquisa.titulo}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-light">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          {respondida
            ? "Respondida"
            : situacao === "agendada"
              ? `Abre em ${formatarDataHora(pesquisa.abreEm)}`
              : situacao === "encerrada"
                ? `Encerrada em ${formatarDataHora(pesquisa.fechaEm)}`
                : `${plural(pesquisa.perguntas.length, "pergunta")} · até ${formatarDataHora(pesquisa.fechaEm)}`}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-text-muted" aria-hidden="true" />
    </Link>
  );
}

export default function PesquisasAtletaPage() {
  const { pesquisas, respondidas, pendentes, carregando } = usePesquisasDoAtleta();
  const respondidasLista = pesquisas.filter((p) => respondidas.has(p.id));
  const agendadas = pesquisas.filter((p) => situacaoPesquisa(p) === "agendada");

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Pesquisas"
        subtitle="Sua opinião ajuda o comitê a melhorar o programa."
        icon={ClipboardList}
      />
      {carregando ? (
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </Card>
      ) : pendentes.length === 0 && respondidasLista.length === 0 && agendadas.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma pesquisa no momento"
            description="Quando o comitê abrir uma pesquisa, ela aparece aqui e você recebe um aviso ao entrar no portal."
          />
        </Card>
      ) : (
        <>
          {[
            { titulo: "Para responder", lista: pendentes },
            { titulo: "Em breve", lista: agendadas },
            { titulo: "Respondidas", lista: respondidasLista },
          ]
            .filter((s) => s.lista.length > 0)
            .map((s) => (
              <section key={s.titulo} className="flex flex-col gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-text-light">{s.titulo}</h2>
                <Card className="divide-y divide-border p-0">
                  {s.lista.map((p) => (
                    <Linha key={p.id} pesquisa={p} respondida={respondidas.has(p.id)} />
                  ))}
                </Card>
              </section>
            ))}
        </>
      )}
    </div>
  );
}
