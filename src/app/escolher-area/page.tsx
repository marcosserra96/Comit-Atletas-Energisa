"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import { useSession } from "@/lib/session/SessionProvider";
import { souTambemAtleta } from "@/lib/session/dualRole";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { cn } from "@/lib/cn";

type Area = "comite" | "atleta";

function areaSessionKey(uid: string) {
  return `atletas-energisa:area:${uid}`;
}

export default function EscolherAreaPage() {
  const router = useRouter();
  const { session, logout } = useSession();
  const [entering, setEntering] = useState<Area | null>(null);
  const [leaving, setLeaving] = useState(false);

  const perfilDuplo =
    session.status === "active" &&
    souTambemAtleta(session.usuario, session.atleta);

  useEffect(() => {
    if (session.status === "signed-out") {
      router.replace("/login");
    } else if (session.status === "active" && !perfilDuplo) {
      router.replace(session.usuario.role === "atleta" ? "/dashboard" : "/gestao");
    }
  }, [perfilDuplo, router, session]);

  function entrar(area: Area) {
    if (session.status !== "active") return;
    setEntering(area);
    window.sessionStorage.setItem(areaSessionKey(session.uid), area);
    router.replace(area === "atleta" ? "/dashboard" : "/gestao");
  }

  async function trocarConta() {
    if (session.status !== "active") return;
    setLeaving(true);
    window.sessionStorage.removeItem(areaSessionKey(session.uid));
    await logout();
    router.replace("/login");
  }

  if (session.status !== "active" || !perfilDuplo) {
    return <FullScreenLoader message="Preparando seu acesso..." />;
  }

  const primeiroNome = session.atleta.nome.split(" ")[0];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-8 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 size-80 rounded-full bg-secondary/10 blur-3xl"
      />

      <section className="relative w-full max-w-4xl rounded-[var(--radius-xl)] border border-border bg-bg-card p-6 shadow-[var(--shadow-elevated)] sm:p-10">
        <header className="mx-auto max-w-xl text-center">
          <Image
            src="/logos/logo-comite-colorida.png"
            alt="Atletas Energisa"
            width={180}
            height={60}
            priority
            className="mx-auto h-auto w-[150px] sm:w-[170px]"
          />
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Bem-vindo, {primeiroNome}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
            Como você quer acessar?
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-light sm:text-base">
            Seu perfil possui acesso aos ambientes do Comitê e do Atleta.
          </p>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => entrar("comite")}
            disabled={entering !== null || leaving}
            aria-busy={entering === "comite"}
            className={cn(
              "group flex min-h-52 touch-manipulation flex-col rounded-[var(--radius-lg)] border border-white/10 bg-navy p-6 text-left text-white shadow-sm",
              "transition duration-200 hover:-translate-y-0.5 hover:bg-navy-light hover:shadow-[var(--shadow-elevated)] active:translate-y-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-primary">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <span className="mt-5 text-lg font-extrabold">Área do Comitê</span>
            <span className="mt-2 flex-1 text-sm leading-relaxed text-white/65">
              Gerencie atletas, eventos, pontuação, ranking e conteúdos do programa.
            </span>
            <span className="mt-5 flex items-center gap-2 text-sm font-bold text-primary">
              {entering === "comite" ? "Entrando..." : "Acessar gestão"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => entrar("atleta")}
            disabled={entering !== null || leaving}
            aria-busy={entering === "atleta"}
            className={cn(
              "group flex min-h-52 touch-manipulation flex-col rounded-[var(--radius-lg)] border border-primary/20 bg-gradient-to-br from-primary/10 via-bg-card to-secondary/10 p-6 text-left shadow-sm",
              "transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elevated)] active:translate-y-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
              <Activity className="size-6" aria-hidden="true" />
            </span>
            <span className="mt-5 text-lg font-extrabold text-text">Minha área de atleta</span>
            <span className="mt-2 flex-1 text-sm leading-relaxed text-text-light">
              Acompanhe seu desempenho, histórico, ranking e próximos eventos.
            </span>
            <span className="mt-5 flex items-center gap-2 text-sm font-bold text-secondary">
              {entering === "atleta" ? "Entrando..." : "Acessar meu painel"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </button>
        </div>

        <footer className="mt-7 flex flex-col items-center gap-3 text-center">
          <p className="text-xs text-text-muted">
            Você poderá alternar de ambiente depois pelo menu.
          </p>
          <button
            type="button"
            onClick={trocarConta}
            disabled={entering !== null || leaving}
            className="flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-text-light transition-colors hover:bg-bg-inset hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {leaving ? "Saindo..." : "Entrar com outra conta"}
          </button>
        </footer>
      </section>
    </main>
  );
}
