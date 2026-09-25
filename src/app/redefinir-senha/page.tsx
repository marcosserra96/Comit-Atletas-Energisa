"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { CheckCircle2, CircleAlert, KeyRound, LockKeyhole } from "lucide-react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { AppSplash } from "@/components/ui/AppSplash";
import { firebaseErrorCode, mapFirebaseError } from "@/lib/firebaseErrors";

type PageState = "checking" | "ready" | "success" | "error";

export default function RedefinirSenhaPage() {
  const [pageState, setPageState] = useState<PageState>("checking");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const actionCode = new URLSearchParams(window.location.search).get("oobCode");

    if (!actionCode) {
      queueMicrotask(() => {
        setPageError("Este link de redefinição está incompleto. Solicite um novo link.");
        setPageState("error");
      });
      return;
    }

    verifyPasswordResetCode(auth, actionCode)
      .then((verifiedEmail) => {
        setCode(actionCode);
        setEmail(verifiedEmail);
        setPageState("ready");
      })
      .catch((error) => {
        setPageError(mapFirebaseError(firebaseErrorCode(error)));
        setPageState("error");
      });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");

    if (password.length < 6) {
      setFormError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setFormError("As senhas digitadas não são iguais.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, code, password);
      setPageState("success");
    } catch (error) {
      const message = mapFirebaseError(firebaseErrorCode(error));
      setPageError(message);
      setPageState("error");
    } finally {
      setLoading(false);
    }
  }

  if (pageState === "checking") {
    return <AppSplash message="Validando seu link..." />;
  }

  return (
    <main className="relative isolate flex min-h-dvh overflow-hidden bg-navy px-4 py-8 [padding-top:max(2rem,env(safe-area-inset-top))] [padding-bottom:max(2rem,env(safe-area-inset-bottom))] sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 top-1/3 size-72 rounded-full bg-secondary/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 top-10 size-72 rounded-full bg-primary/15 blur-3xl" />

      <section className="relative z-10 m-auto w-full max-w-md rounded-[var(--radius-2xl)] bg-bg-card p-6 shadow-[var(--shadow-modal)] sm:p-8">
        <Image
          src="/logos/logo-comite-branca-trim.png"
          alt="Atletas Energisa"
          width={240}
          height={80}
          priority
          className="mx-auto mb-7 h-auto w-[210px] rounded-xl bg-navy px-4 py-3"
        />

        {pageState === "ready" && (
          <>
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-primary-subtle text-primary">
              <KeyRound className="size-7" aria-hidden="true" />
            </div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-text">Crie uma nova senha</h1>
              <p className="mt-2 text-sm leading-relaxed text-text-light">
                Defina a nova senha para <span className="font-semibold text-text">{email}</span>.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <TextField
                label="Nova senha"
                type="password"
                icon={<LockKeyhole className="size-[18px]" />}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFormError("");
                }}
                autoComplete="new-password"
                minLength={6}
                required
                autoFocus
              />
              <TextField
                label="Confirme a nova senha"
                type="password"
                icon={<LockKeyhole className="size-[18px]" />}
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setFormError("");
                }}
                autoComplete="new-password"
                minLength={6}
                required
                error={formError}
              />
              <p className="text-xs text-text-muted">Use pelo menos 6 caracteres.</p>
              <Button type="submit" loading={loading} className="mt-1 w-full">
                Salvar nova senha
              </Button>
            </form>
          </>
        )}

        {pageState === "success" && (
          <div className="text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-success-subtle text-success">
              <CheckCircle2 className="size-8" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-text">Senha redefinida</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-light">
              Sua nova senha foi salva. Agora você já pode entrar no portal.
            </p>
            <Button type="button" className="mt-7 w-full" onClick={() => window.location.assign("/login")}>
              Ir para o login
            </Button>
          </div>
        )}

        {pageState === "error" && (
          <div className="text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-danger-subtle text-danger">
              <CircleAlert className="size-8" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-text">Não foi possível abrir o link</h1>
            <p role="alert" className="mt-2 text-sm leading-relaxed text-text-light">
              {pageError}
            </p>
            <Button type="button" className="mt-7 w-full" onClick={() => window.location.assign("/login")}>
              Voltar e solicitar novo link
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
