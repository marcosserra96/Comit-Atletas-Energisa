"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckCircle2, FileCheck2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface TermosAceiteScreenProps {
  titulo: string;
  conteudo: string;
  versao: number;
  nome: string;
  email: string;
  onAceitar: () => Promise<void>;
  onLogout: () => void;
}

export function TermosAceiteScreen({
  titulo,
  conteudo,
  versao,
  nome,
  email,
  onAceitar,
  onLogout,
}: TermosAceiteScreenProps) {
  const [concordou, setConcordou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function aceitar() {
    if (!concordou) return;
    setSalvando(true);
    setErro("");
    try {
      await onAceitar();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar seu aceite. Tente novamente.",
      );
      setSalvando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-6 [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))] [padding-top:max(1.5rem,env(safe-area-inset-top))] sm:px-6">
      <section className="flex max-h-[calc(100dvh-3rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-bg-card shadow-[var(--shadow-modal)]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
          <Image
            src="/logos/logo-comite-colorida.png"
            alt="Atletas Energisa"
            width={154}
            height={48}
            className="h-auto w-[126px]"
            priority
          />
          <span className="rounded-full bg-primary-subtle px-3 py-1 text-xs font-bold text-primary">
            Versão {versao}
          </span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <FileCheck2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                Primeiro acesso
              </p>
              <h1 className="mt-1 text-xl font-extrabold text-text sm:text-2xl">{titulo}</h1>
              <p className="mt-1 text-sm text-text-light">
                Leia o documento completo para continuar no portal.
              </p>
            </div>
          </div>

          <article
            tabIndex={0}
            aria-label="Conteúdo dos termos do programa"
            className="max-h-[34dvh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-bg p-4 text-sm leading-6 text-text sm:max-h-[38dvh] sm:p-5"
          >
            {conteudo}
          </article>

          <div className="mt-4 rounded-xl bg-bg px-4 py-3 text-xs leading-relaxed text-text-light">
            O aceite será registrado para <strong className="text-text">{nome}</strong>
            {email ? <> ({email})</> : null}, com data e hora do servidor.
          </div>

          <label className="mt-4 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-text transition-colors hover:border-primary/50">
            <input
              type="checkbox"
              checked={concordou}
              onChange={(event) => setConcordou(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]"
            />
            <span>Li e concordo com os termos do programa apresentados acima.</span>
          </label>

          {erro && (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {erro}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-between sm:px-7">
          <Button type="button" variant="ghost" onClick={onLogout} disabled={salvando}>
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </Button>
          <Button type="button" onClick={aceitar} disabled={!concordou} loading={salvando}>
            {!salvando && <CheckCircle2 className="size-4" aria-hidden="true" />}
            Aceitar e continuar
          </Button>
        </footer>
      </section>
    </main>
  );
}
