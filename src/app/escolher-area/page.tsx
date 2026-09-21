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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-3 py-3 sm:px-6 sm:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 size-80 rounded-full bg-secondary/10 blur-3xl"
      />

      <section className="relative w-full max-w-4xl rounded-[var(--radius-xl)] border border-border bg-bg-card p-4 shadow-[var(--shadow-elevated)] sm:p-10">
        <header className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex w-fit rounded-2xl bg-navy px-4 py-2.5 shadow-sm sm:px-5 sm:py-3">
            <Image
              src="/logos/logo-comite-branca-trim.png"
              alt="Atletas Energisa"
              width={180}
              height={60}
              priority
              className="h-auto w-[112px] sm:w-[170px]"
            />
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-primary sm:mt-6 sm:text-xs sm:tracking-[0.18em]">
            Bem-vindo, {primeiroNome}
          </p>
          <h1 className="mt-1 text-xl font-extrabold tracking-tight text-text sm:mt-2 sm:text-3xl">
            Como você quer acessar?
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-text-light sm:mt-3 sm:text-base">
            Seu perfil possui acesso aos ambientes do Comitê e do Atleta.
          </p>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4">
          <button
            type="button"
            onClick={() => entrar("comite")}
            disabled={entering !== null || leaving}
            aria-busy={entering === "comite"}
            className={cn(
              "group flex min-h-60 touch-manipulation flex-col rounded-[var(--radius-lg)] border border-white/10 bg-navy p-4 text-left text-white shadow-sm sm:min-h-52 sm:p-6",
              "transition duration-200 hover:-translate-y-0.5 hover:bg-navy-light hover:shadow-[var(--shadow-elevated)] active:translate-y-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-primary sm:size-12 sm:rounded-2xl">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </span>
            <span className="mt-3 text-base font-extrabold leading-tight sm:mt-5 sm:text-lg">Área do Comitê</span>
            <span className="mt-2 flex-1 text-xs leading-relaxed text-white/65 sm:text-sm">
              <span className="sm:hidden">Gerencie o programa e os atletas.</span>
              <span className="hidden sm:inline">
                Gerencie atletas, eventos, pontuação, ranking e conteúdos do programa.
              </span>
            </span>
            <span className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary sm:mt-5 sm:gap-2 sm:text-sm">
              {entering === "comite" ? "Entrando..." : <><span className="sm:hidden">Entrar</span><span className="hidden sm:inline">Acessar gestão</span></>}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => entrar("atleta")}
            disabled={entering !== null || leaving}
            aria-busy={entering === "atleta"}
            className={cn(
              "group flex min-h-60 touch-manipulation flex-col rounded-[var(--radius-lg)] border border-primary/20 bg-gradient-to-br from-primary/10 via-bg-card to-secondary/10 p-4 text-left shadow-sm sm:min-h-52 sm:p-6",
              "transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elevated)] active:translate-y-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary/15 text-secondary sm:size-12 sm:rounded-2xl">
              <Activity className="size-6" aria-hidden="true" />
            </span>
            <span className="mt-3 text-base font-extrabold leading-tight text-text sm:mt-5 sm:text-lg">Minha área de atleta</span>
            <span className="mt-2 flex-1 text-xs leading-relaxed text-text-light sm:text-sm">
              <span className="sm:hidden">Acompanhe seu desempenho e ranking.</span>
              <span className="hidden sm:inline">
                Acompanhe seu desempenho, histórico, ranking e próximos eventos.
              </span>
            </span>
            <span className="mt-3 flex items-center gap-1.5 text-xs font-bold text-secondary sm:mt-5 sm:gap-2 sm:text-sm">
              {entering === "atleta" ? "Entrando..." : <><span className="sm:hidden">Entrar</span><span className="hidden sm:inline">Acessar meu painel</span></>}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </button>
        </div>

        <footer className="mt-4 flex flex-col items-center gap-1 text-center sm:mt-7 sm:gap-3">
          <p className="hidden text-xs text-text-muted sm:block">
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
