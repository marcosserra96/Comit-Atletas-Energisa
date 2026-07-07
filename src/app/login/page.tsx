"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
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
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { firebaseErrorCode, mapFirebaseError } from "@/lib/firebaseErrors";
import { useSession } from "@/lib/session/SessionProvider";
import { homeForRole } from "@/lib/session/routing";
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
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regNome, setRegNome] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  useEffect(() => {
    if (session.status === "active") {
      router.replace(homeForRole(session.usuario.role));
    }
  }, [session, router]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      show("error", mapFirebaseError(firebaseErrorCode(error)));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      await setDoc(doc(db, "solicitacoes_acesso", credential.user.uid), {
        uid: credential.user.uid,
        nome: regNome,
        email: regEmail,
        status: "pendente",
        criadoEm: serverTimestamp(),
      });
      show("success", "Solicitação enviada! Avisaremos quando seu acesso for aprovado.");
    } catch (error) {
      show("error", mapFirebaseError(firebaseErrorCode(error)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 min-h-screen">
      {/* PAINEL ESQUERDO — Branding */}
      <div className="relative hidden lg:flex lg:w-[64%] flex-col items-center justify-center overflow-hidden p-12 text-white">
        <div className="absolute inset-0" style={{ background: "var(--login-bg)" }} />
        <span className="pointer-events-none absolute -top-32 -left-20 size-[420px] rounded-full bg-white/10 blur-[110px]" />
        <span className="pointer-events-none absolute top-1/3 left-1/4 size-[320px] rounded-full bg-primary/40 blur-[110px]" />
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

          <h1 className="mb-4 text-[clamp(1.9rem,3vw,2.6rem)] leading-[1.1] font-bold tracking-[-0.03em]">
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
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <p className="text-xs tracking-wide text-white/40">Energisa · Programa de Atletas</p>
        </div>
      </div>

      {/* PAINEL DIREITO — Formulário */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[400px] rounded-3xl border border-border/60 bg-bg-card p-9 shadow-2xl">
          <div className="mb-8 flex justify-center lg:hidden">
            <Image
              src="/logos/logo-comite-colorida.png"
              alt="Atletas Energisa"
              width={180}
              height={60}
              className="w-[160px] h-auto"
            />
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-8 flex items-center gap-3.5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Lock className="size-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.14em] text-primary">
                      BEM-VINDO DE VOLTA
                    </p>
                    <h2 className="text-lg font-bold tracking-[-0.02em] text-text">
                      Entrar no sistema
                    </h2>
                  </div>
                </div>
                <p className="-mt-4 mb-7 text-sm text-text-light">
                  Acesse com o e-mail cadastrado no programa.
                </p>

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <TextField
                    label="E-mail"
                    type="email"
                    icon={<Mail className="size-[18px]" />}
                    placeholder="voce@energisa.com.br"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                  <TextField
                    label="Senha"
                    type="password"
                    icon={<Lock className="size-[18px]" />}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    action={
                      <button
                        type="button"
                        onClick={() => setForgotOpen(true)}
                        className="text-xs font-semibold text-primary hover:text-primary-hover"
                      >
                        Esqueceu a senha?
                      </button>
                    }
                  />
                  <Button type="submit" loading={loading} className="mt-2 w-full">
                    Entrar no sistema
                    <ArrowRight className="size-4" />
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-text-light">
                  Ainda não tem acesso?{" "}
                  <button
                    onClick={() => setMode("solicitar")}
                    className="font-semibold text-primary hover:text-primary-hover"
                  >
                    Solicite aqui
                  </button>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="solicitar"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-8 flex items-center gap-3.5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserPlus className="size-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.14em] text-primary">
                      PRIMEIRO ACESSO
                    </p>
                    <h2 className="text-lg font-bold tracking-[-0.02em] text-text">
                      Solicitar acesso
                    </h2>
                  </div>
                </div>
                <p className="-mt-4 mb-7 text-sm text-text-light">
                  Preencha seus dados e aguarde a aprovação do administrador.
                </p>

                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                  <TextField
                    label="Nome completo"
                    icon={<User className="size-[18px]" />}
                    placeholder="Seu nome completo"
                    autoComplete="name"
                    value={regNome}
                    onChange={(e) => setRegNome(e.target.value)}
                    required
                  />
                  <TextField
                    label="E-mail"
                    type="email"
                    icon={<Mail className="size-[18px]" />}
                    placeholder="voce@energisa.com.br"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                  <TextField
                    label="Crie uma senha"
                    type="password"
                    icon={<Lock className="size-[18px]" />}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                  <Button type="submit" loading={loading} className="mt-2 w-full">
                    Enviar solicitação
                    <ArrowRight className="size-4" />
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-text-light">
                  Já tem acesso?{" "}
                  <button
                    onClick={() => setMode("login")}
                    className="font-semibold text-primary hover:text-primary-hover"
                  >
                    Faça login
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
