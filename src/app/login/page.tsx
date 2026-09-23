"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  UserPlus,
  TrendingUp,
  Trophy,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { AppSplash } from "@/components/ui/AppSplash";
import { useToast } from "@/components/ui/Toast";
import { firebaseErrorCode, mapFirebaseError } from "@/lib/firebaseErrors";
import {
  criarSolicitacaoSeNecessario,
  useSession,
} from "@/lib/session/SessionProvider";
import { homeForRole } from "@/lib/session/routing";
import { souTambemAtleta } from "@/lib/session/dualRole";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

type Mode = "login" | "solicitar";

const features = [
  { icon: TrendingUp, text: "Acompanhe seu desempenho e evolução" },
  { icon: CalendarCheck, text: "Acompanhe os eventos do programa" },
  { icon: Trophy, text: "Ranking e conquistas por modalidade" },
];

export default function LoginPage() {
  const router = useRouter();
  const { session } = useSession();
  const { show } = useToast();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regNome, setRegNome] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  useEffect(() => {
    if (session.status !== "active") return;

    let destino = homeForRole(session.usuario.role);
    if (souTambemAtleta(session.usuario, session.atleta)) {
      const areaSalva = window.sessionStorage.getItem(
        "atletas-energisa:area:" + session.uid,
      );
      destino =
        areaSalva === "atleta"
          ? "/dashboard"
          : areaSalva === "comite"
            ? "/gestao"
            : "/escolher-area";
    }

    router.replace(destino);
  }, [session, router]);

  function trocarModo(proximoModo: Mode) {
    setMode(proximoModo);
    setLoading(false);
    setLoginError("");
    setRegisterError("");
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(
        auth,
        loginEmail.trim().toLowerCase(),
        loginPassword,
      );
      // O listener de sessão assume daqui e mantém o feedback até o redirecionamento.
    } catch (error) {
      setLoginError(mapFirebaseError(firebaseErrorCode(error)));
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegisterError("");
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        regEmail.trim().toLowerCase(),
        regPassword,
      );
      await updateProfile(credential.user, { displayName: regNome.trim() });
      try {
        await criarSolicitacaoSeNecessario(credential.user, regNome.trim());
        show("success", "Cadastro enviado para aprovação.");
      } catch {
        // Compatibilidade temporária enquanto a nova regra do Firestore não for publicada.
        await sendEmailVerification(credential.user);
        show("success", "Enviamos um link para confirmar seu e-mail.");
      }
    } catch (error) {
      setRegisterError(mapFirebaseError(firebaseErrorCode(error)));
    } finally {
      setLoading(false);
    }
  }

  const motionState = {
    initial: reduceMotion ? false : { opacity: 0, x: 16 },
    animate: { opacity: 1, x: 0 },
    exit: reduceMotion ? { opacity: 1 } : { opacity: 0, x: -16 },
    transition: { duration: reduceMotion ? 0 : 0.2 },
  };

  if (session.status === "active") {
    return <AppSplash message="Acesso reconhecido. Entrando..." />;
  }

  return (
    <div className="flex min-h-dvh flex-1">
      {/* PAINEL ESQUERDO — Branding */}
      <div className="relative hidden flex-col items-center justify-center overflow-hidden p-12 text-white lg:flex lg:w-[64%]">
        <div className="absolute inset-0" style={{ background: "var(--login-bg)" }} />
        <span className="pointer-events-none absolute -left-20 -top-32 size-[420px] rounded-full bg-white/10 blur-[110px]" />
        <span className="pointer-events-none absolute left-1/4 top-1/3 size-[320px] rounded-full bg-primary/40 blur-[110px]" />
        <span className="pointer-events-none absolute -bottom-40 -right-10 size-[480px] rounded-full bg-secondary/50 blur-[120px]" />
        <span className="pointer-events-none absolute -bottom-24 left-1/3 size-[260px] rounded-full bg-navy/60 blur-[100px]" />

        <div className="relative z-10 flex max-w-[480px] flex-col items-start">
          <Image
            src="/logos/logo-comite-branca-trim.png"
            alt="Atletas Energisa"
            width={260}
            height={82}
            priority
            className="mb-9 h-auto w-[220px] drop-shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
          />

          <h1 className="mb-4 text-[clamp(1.9rem,3vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.03em]">
            Portal Atletas
            <br />
            <span className="bg-gradient-to-r from-secondary to-[#5eead4] bg-clip-text text-transparent">
              Energisa
            </span>
          </h1>
          <p className="mb-10 text-[15px] leading-relaxed text-white/65">
            Desempenho, pontuação e evolução do programa de atletas em um só lugar.
          </p>

          <ul className="mb-10 flex w-full flex-col gap-3">
            {features.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3.5 text-[13px] font-medium text-white/80 backdrop-blur-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <p className="text-xs tracking-wide text-white/40">
            Energisa · Programa de Atletas
          </p>
        </div>
      </div>

      {/* PAINEL DIREITO — Formulário */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-bg px-4 py-6 [padding-bottom:max(1.5rem,env(safe-area-inset-bottom))] [padding-top:max(1.5rem,env(safe-area-inset-top))] sm:px-6 lg:py-12">
        <div className="absolute inset-x-0 top-0 h-[42%] bg-navy lg:hidden" aria-hidden="true" />
        <span
          className="pointer-events-none absolute -right-24 top-8 size-64 rounded-full bg-primary/15 blur-3xl lg:hidden"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -left-24 top-36 size-56 rounded-full bg-secondary/10 blur-3xl lg:hidden"
          aria-hidden="true"
        />

        <div className="relative z-10 w-full max-w-[400px]">
          <div className="mb-5 flex justify-center lg:hidden">
            <Image
              src="/logos/logo-comite-branca-trim.png"
              alt="Atletas Energisa"
              width={190}
              height={60}
              priority
              className="h-auto w-[170px] drop-shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
            />
          </div>

          <div className="rounded-3xl border border-border/60 bg-bg-card p-6 shadow-[var(--shadow-modal)] sm:p-9">
            <AnimatePresence mode="wait">
              {mode === "login" ? (
                <motion.div key="login" {...motionState}>
                  <div className="mb-6 flex items-center gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Lock className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h1 className="text-xl font-bold tracking-[-0.02em] text-text">
                        Acesse sua conta
                      </h1>
                      <p className="mt-0.5 text-sm text-text-light">
                        Use o e-mail cadastrado no programa.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate={false}>
                    <TextField
                      label="E-mail"
                      type="email"
                      icon={<Mail className="size-[18px]" aria-hidden="true" />}
                      placeholder="voce@energisa.com.br"
                      autoComplete="email"
                      inputMode="email"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (loginError) setLoginError("");
                      }}
                      required
                    />
                    <TextField
                      label="Senha"
                      type="password"
                      icon={<Lock className="size-[18px]" aria-hidden="true" />}
                      placeholder="Sua senha"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (loginError) setLoginError("");
                      }}
                      error={loginError || undefined}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="-mt-2 inline-flex min-h-11 self-end items-center rounded-lg px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-subtle hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--ring-primary)]"
                    >
                      Esqueceu a senha?
                    </button>
                    <Button type="submit" loading={loading} className="w-full">
                      Entrar
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  </form>

                  <div className="mt-6 border-t border-border pt-5">
                    <p className="text-center text-sm text-text-light">
                      Primeiro acesso ao programa?
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => trocarModo("solicitar")}
                      className="mt-3 w-full"
                    >
                      <UserPlus className="size-4" aria-hidden="true" />
                      Solicitar acesso
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="solicitar" {...motionState}>
                  <div className="mb-6 flex items-center gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                      <UserPlus className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h1 className="text-xl font-bold tracking-[-0.02em] text-text">
                        Solicitar acesso
                      </h1>
                      <p className="mt-0.5 text-sm text-text-light">
                        O comitê analisará seus dados.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleRegister} className="flex flex-col gap-4">
                    <TextField
                      label="Nome completo"
                      icon={<User className="size-[18px]" aria-hidden="true" />}
                      placeholder="Seu nome completo"
                      autoComplete="name"
                      value={regNome}
                      onChange={(e) => {
                        setRegNome(e.target.value);
                        if (registerError) setRegisterError("");
                      }}
                      required
                    />
                    <TextField
                      label="E-mail"
                      type="email"
                      icon={<Mail className="size-[18px]" aria-hidden="true" />}
                      placeholder="voce@energisa.com.br"
                      autoComplete="email"
                      inputMode="email"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        if (registerError) setRegisterError("");
                      }}
                      error={registerError || undefined}
                      required
                    />
                    <TextField
                      label="Crie uma senha"
                      type="password"
                      icon={<Lock className="size-[18px]" aria-hidden="true" />}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        if (registerError) setRegisterError("");
                      }}
                      required
                    />
                    <Button type="submit" loading={loading} className="mt-1 w-full">
                      Enviar solicitação
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  </form>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => trocarModo("login")}
                    className="mt-4 w-full"
                  >
                    Já tenho acesso
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        initialEmail={loginEmail}
      />
    </div>
  );
}
