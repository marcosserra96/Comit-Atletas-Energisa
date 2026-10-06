"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { mensagemDoLink, type LinkSenha } from "@/lib/senhaComite";

function horario(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Link gerado: enviar pelo WhatsApp, compartilhar ou copiar a mensagem pronta. */
export function LinkDeSenha({ dados, className }: { dados: LinkSenha; className?: string }) {
  const [copiado, setCopiado] = useState(false);
  const mensagem = mensagemDoLink(dados);
  const podeCompartilhar = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className={cn("flex flex-col gap-3 rounded-[var(--radius)] border border-success/30 bg-success/5 p-3.5", className)}>
      <div className="flex items-start gap-2.5">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-text">Link pronto para {dados.nome.split(" ")[0]}</p>
          <p className="text-xs text-text-light">
            Vale até {horario(dados.expiraEm)} e só funciona uma vez. Mande só para a própria pessoa.
          </p>
        </div>
      </div>
      <p className="break-all rounded-[var(--radius)] bg-bg-card px-3 py-2 font-mono text-xs text-text-light">{dados.link}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[#1f8f4e] px-3 text-sm font-bold text-white transition-colors hover:bg-[#187a42]"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          WhatsApp
        </a>
        {podeCompartilhar ? (
          <Button
            variant="secondary"
            size="sm"
            className="h-10"
            onClick={() => void navigator.share({ title: "Nova senha · Atletas Energisa", text: mensagem }).catch(() => undefined)}
          >
            <Share2 className="size-4" />
            Compartilhar
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          className={cn("h-10", !podeCompartilhar && "sm:col-span-2")}
          onClick={() =>
            void navigator.clipboard?.writeText(mensagem).then(() => {
              setCopiado(true);
              window.setTimeout(() => setCopiado(false), 2500);
            })
          }
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copiado ? "Mensagem copiada" : "Copiar mensagem"}
        </Button>
      </div>
    </div>
  );
}
