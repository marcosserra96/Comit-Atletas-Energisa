"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { applyActionCode } from "firebase/auth";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { AppSplash } from "@/components/ui/AppSplash";
import { firebaseErrorCode, mapFirebaseError } from "@/lib/firebaseErrors";
import { useBuscaDaUrl } from "@/lib/useBuscaDaUrl";

type ActionState = "checking" | "success" | "error";

export default function FirebaseActionPage() {
  const [state, setState] = useState<ActionState>("checking");
  const [message, setMessage] = useState("");
  const busca = useBuscaDaUrl();
  const linkValido = (() => {
    if (busca === undefined) return true; // ainda lendo a URL
    const params = new URLSearchParams(busca);
    const mode = params.get("mode");
    return (
      !!params.get("oobCode") &&
      (mode === "resetPassword" || mode === "verifyEmail" || mode === "recoverEmail")
    );
  })();

  useEffect(() => {
    if (busca === undefined || !linkValido) return;
    const params = new URLSearchParams(busca);
    const mode = params.get("mode");
    const code = params.get("oobCode");

    if (mode === "resetPassword" && code) {
      window.location.replace(`/redefinir-senha?${params.toString()}`);
      return;
    }

    if ((mode === "verifyEmail" || mode === "recoverEmail") && code) {
      applyActionCode(auth, code)
        .then(async () => {
          await auth.currentUser?.reload();
          setMessage(
            mode === "verifyEmail"
              ? "Seu e-mail foi confirmado com sucesso."
              : "Seu e-mail anterior foi restaurado com sucesso.",
          );
          setState("success");
        })
        .catch((error) => {
          setMessage(mapFirebaseError(firebaseErrorCode(error)));
          setState("error");
        });
    }
  }, [busca, linkValido]);

  const estado: ActionState = linkValido ? state : "error";
  const mensagem = linkValido
    ? message
    : "Este link é inválido ou está incompleto. Solicite um novo link.";

  if (estado === "checking") {
    return <AppSplash message="Validando seu link..." />;
  }

  return (
    <main className="relative isolate flex min-h-dvh overflow-hidden bg-navy px-4 py-8 [padding-top:max(2rem,env(safe-area-inset-top))] [padding-bottom:max(2rem,env(safe-area-inset-bottom))] sm:px-6">
      <section className="relative z-10 m-auto w-full max-w-md rounded-[var(--radius-2xl)] bg-bg-card p-6 text-center shadow-[var(--shadow-modal)] sm:p-8">
        <Image
          src="/logos/logo-comite-branca-trim.png"
          alt="Atletas Energisa"
          width={240}
          height={80}
          priority
          className="mx-auto mb-7 h-auto w-[210px] rounded-xl bg-navy px-4 py-3"
        />
        <div
          className={`mx-auto mb-5 flex size-16 items-center justify-center rounded-full ${
            estado === "success"
              ? "bg-success-subtle text-success"
              : "bg-danger-subtle text-danger"
          }`}
        >
          {estado === "success" ? (
            <CheckCircle2 className="size-8" aria-hidden="true" />
          ) : (
            <CircleAlert className="size-8" aria-hidden="true" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-text">
          {estado === "success" ? "Tudo certo" : "Não foi possível abrir o link"}
        </h1>
        <p role={estado === "error" ? "alert" : undefined} className="mt-2 text-sm leading-relaxed text-text-light">
          {mensagem}
        </p>
        <Button type="button" className="mt-7 w-full" onClick={() => window.location.assign("/login")}>
          Ir para o login
        </Button>
      </section>
    </main>
  );
}
