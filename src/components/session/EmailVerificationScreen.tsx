"use client";

import { useState } from "react";
import { LogOut, MailCheck, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function EmailVerificationScreen({
  email,
  onConfirmar,
  onReenviar,
  onLogout,
}: {
  email: string;
  onConfirmar: () => Promise<boolean>;
  onReenviar: () => Promise<void>;
  onLogout: () => void;
}) {
  const [verificando, setVerificando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function confirmar() {
    setVerificando(true);
    setMensagem("");
    try {
      const verificado = await onConfirmar();
      if (!verificado) {
        setMensagem("O e-mail ainda não foi confirmado. Abra o link recebido e tente novamente.");
      }
    } catch {
      setMensagem("Não foi possível confirmar agora. Verifique sua conexão e tente novamente.");
    } finally {
      setVerificando(false);
    }
  }

  async function reenviar() {
    setReenviando(true);
    setMensagem("");
    try {
      await onReenviar();
      setMensagem("Novo link enviado. Confira também a caixa de spam.");
    } catch {
      setMensagem("Não foi possível reenviar agora. Aguarde um pouco e tente novamente.");
    } finally {
      setReenviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-bg-card p-8 text-center shadow-xl sm:p-9">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MailCheck className="size-7" />
        </span>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          Primeiro acesso
        </p>
        <h1 className="mb-2 text-xl font-bold text-text">Confirme seu e-mail</h1>
        <p className="text-sm leading-relaxed text-text-light">
          Enviamos um link para <strong className="text-text">{email}</strong>. A solicitação de acesso
          só será encaminhada ao administrador depois da confirmação.
        </p>

        {mensagem && (
          <p className="mt-5 rounded-[var(--radius)] border border-border bg-bg px-4 py-3 text-sm text-text-light">
            {mensagem}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-3">
          <Button className="w-full justify-center" loading={verificando} onClick={confirmar}>
            <RefreshCw className="size-4" />
            Já confirmei meu e-mail
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-center"
            loading={reenviando}
            onClick={reenviar}
          >
            <Send className="size-4" />
            Reenviar link
          </Button>
          <Button variant="ghost" className="w-full justify-center" onClick={onLogout}>
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
