"use client";

import { FormEvent, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { CheckCircle2, Mail, MessageCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { firebaseErrorCode, mapFirebaseError } from "@/lib/firebaseErrors";

export function ForgotPasswordModal({
  open,
  onClose,
  initialEmail,
}: {
  open: boolean;
  onClose: () => void;
  initialEmail: string;
}) {
  const { show } = useToast();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"comite" | "email" | null>(null);
  const [enviado, setEnviado] = useState<"comite" | "email" | null>(null);

  // Ao abrir (ou se o e-mail sugerido mudar com o modal aberto), recomeça do e-mail
  // digitado no login. Ajuste de estado durante o render, sem efeito em cascata.
  const chaveAbertura = open ? initialEmail : null;
  const [chaveAnterior, setChaveAnterior] = useState(chaveAbertura);
  if (chaveAbertura !== chaveAnterior) {
    setChaveAnterior(chaveAbertura);
    if (chaveAbertura !== null) {
      setEmail(chaveAbertura);
      setError("");
      setEnviado(null);
    }
  }

  function emailValido() {
    const valor = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
      setError("Digite o e-mail que você usa para entrar.");
      return null;
    }
    return valor;
  }

  /** Caminho principal: o comitê confere e manda o link pelo WhatsApp. */
  async function pedirAoComite(e: FormEvent) {
    e.preventDefault();
    setError("");
    const valor = emailValido();
    if (!valor) return;
    setLoading("comite");
    try {
      const resposta = await fetch("/api/senha/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: valor }),
      });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
        throw new Error(corpo.error || "Não foi possível enviar o pedido.");
      }
      setEnviado("comite");
    } catch (erro) {
      setError(erro instanceof Error ? erro.message : "Não foi possível enviar o pedido.");
    } finally {
      setLoading(null);
    }
  }

  async function handleSubmit() {
    setError("");
    if (!emailValido()) return;
    setLoading("email");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      try {
        // Depois de criar a senha na página do Firebase, o botão "Continuar" volta ao login do portal.
        await sendPasswordResetEmail(auth, normalizedEmail, { url: `${window.location.origin}/login` });
      } catch (comRetorno) {
        const codigo = firebaseErrorCode(comRetorno);
        // Endereço do portal fora dos domínios autorizados: envia mesmo assim, sem o botão de volta.
        if (codigo !== "auth/unauthorized-continue-uri" && codigo !== "auth/invalid-continue-uri") throw comRetorno;
        await sendPasswordResetEmail(auth, normalizedEmail);
      }
      show("success", "Se o e-mail estiver cadastrado, o link chega em alguns minutos.");
      setEnviado("email");
    } catch (requestError) {
      setError(mapFirebaseError(firebaseErrorCode(requestError)));
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Esqueci minha senha"
      description={enviado ? undefined : "O comitê confere o pedido e te manda um link pelo WhatsApp para criar a senha nova."}
    >
      {enviado ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center" role="status">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </span>
          <p className="font-bold text-text">{enviado === "comite" ? "Pedido enviado ao comitê" : "Pedido de e-mail enviado"}</p>
          <p className="text-sm text-text-light">
            {enviado === "comite"
              ? "Assim que conferirem, você recebe pelo WhatsApp um link que vale por 1 hora. Se demorar, fale com alguém do comitê."
              : "Se o e-mail estiver cadastrado, o link chega em alguns minutos. Olhe também o spam. Não chegou? Peça ao comitê."}
          </p>
          <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
            {enviado === "email" ? (
              <Button variant="secondary" onClick={() => setEnviado(null)}>
                Pedir ao comitê
              </Button>
            ) : null}
            <Button onClick={onClose}>Voltar ao login</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={pedirAoComite} className="flex flex-col gap-4" noValidate>
          <TextField
            label="E-mail"
            type="email"
            icon={<Mail className="size-[18px]" />}
            placeholder="voce@energisa.com.br"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
            error={error}
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
          />
          <Button type="submit" loading={loading === "comite"} disabled={loading !== null} className="h-11">
            <MessageCircle className="size-4" />
            Pedir um link ao comitê
          </Button>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading !== null}
              className="text-sm font-semibold text-text-light hover:text-text disabled:opacity-50"
            >
              {loading === "email" ? "Enviando…" : "Prefiro receber por e-mail"}
            </button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
