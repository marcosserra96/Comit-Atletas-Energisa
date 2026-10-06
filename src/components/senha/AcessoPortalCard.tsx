"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LinkDeSenha } from "@/components/senha/LinkDeSenha";
import { gerarLinkSenha, type LinkSenha } from "@/lib/senhaComite";
import type { AtletaDoc } from "@/lib/types";

/** Ficha do atleta: gerar um link de nova senha para mandar pelo WhatsApp. */
export function AcessoPortalCard({ atleta }: { atleta: AtletaDoc }) {
  const { show } = useToast();
  const [gerando, setGerando] = useState(false);
  const [link, setLink] = useState<LinkSenha | null>(null);

  async function gerar() {
    setGerando(true);
    try {
      setLink(await gerarLinkSenha({ atletaId: atleta.id }));
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Não foi possível gerar o link.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-bg p-4">
      <h4 className="flex items-center gap-1.5 text-sm font-bold text-text">
        <KeyRound className="size-3.5" aria-hidden="true" />
        Acesso ao portal
      </h4>
      {atleta.authUid ? (
        <>
          <p className="mt-1 text-xs text-text-muted">
            {atleta.email ? `Entra com ${atleta.email}. ` : ""}Esqueceu a senha? Gere um link e mande pelo WhatsApp.
          </p>
          {link ? (
            <LinkDeSenha dados={link} className="mt-3" />
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void gerar()} loading={gerando} className="mt-3 w-full justify-center">
              Gerar link de nova senha
            </Button>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-text-muted">Ainda não criou o acesso. Quando pedir, o pedido aparece no Início.</p>
      )}
    </div>
  );
}
