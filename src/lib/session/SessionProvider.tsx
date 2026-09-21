"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, sendEmailVerification, signOut, type User } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AppSplash } from "@/components/ui/AppSplash";
import { EmailVerificationScreen } from "@/components/session/EmailVerificationScreen";
import { PendingScreen } from "@/components/session/PendingScreen";
import { RecusadoScreen } from "@/components/session/RecusadoScreen";
import type { AtletaDoc, SolicitacaoAcessoDoc, UsuarioDoc } from "@/lib/types";

type Session =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "email-nao-verificado"; email: string }
  | { status: "pending" }
  | { status: "recusado"; motivo?: string }
  | { status: "active"; uid: string; usuario: UsuarioDoc; atleta: AtletaDoc };

interface SessionContextValue {
  session: Session;
  logout: () => Promise<void>;
  confirmarVerificacaoEmail: () => Promise<boolean>;
  reenviarVerificacaoEmail: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function criarSolicitacaoSeNecessario(user: User) {
  const solicitacaoRef = doc(db, "solicitacoes_acesso", user.uid);
  const existente = await getDoc(solicitacaoRef);
  if (existente.exists()) return;

  const email = user.email?.trim().toLowerCase();
  if (!email) throw new Error("Usuário sem e-mail.");

  await user.getIdToken(true);
  await setDoc(solicitacaoRef, {
    uid: user.uid,
    nome: user.displayName?.trim() || email.split("@")[0],
    email,
    status: "pendente",
    criadoEm: serverTimestamp(),
  });
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });

  useEffect(() => {
    let unsubUsuario: (() => void) | undefined;
    let unsubSolicitacao: (() => void) | undefined;
    let unsubAtleta: (() => void) | undefined;

    function clearNested() {
      unsubUsuario?.();
      unsubSolicitacao?.();
      unsubAtleta?.();
      unsubUsuario = unsubSolicitacao = unsubAtleta = undefined;
    }

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      clearNested();

      if (!user) {
        setSession({ status: "signed-out" });
        return;
      }

      unsubUsuario = onSnapshot(doc(db, "usuarios", user.uid), async (usuarioSnap) => {
        unsubSolicitacao?.();
        unsubAtleta?.();

        if (!usuarioSnap.exists()) {
          if (!user.emailVerified) {
            setSession({ status: "email-nao-verificado", email: user.email ?? "" });
            return;
          }

          try {
            await criarSolicitacaoSeNecessario(user);
          } catch {
            setSession({ status: "email-nao-verificado", email: user.email ?? "" });
            return;
          }

          unsubSolicitacao = onSnapshot(
            doc(db, "solicitacoes_acesso", user.uid),
            (solSnap) => {
              const sol = solSnap.data() as SolicitacaoAcessoDoc | undefined;
              if (sol?.status === "recusado") {
                setSession({ status: "recusado", motivo: sol.motivoRecusa });
              } else {
                setSession({ status: "pending" });
              }
            },
            () => setSession({ status: "pending" }),
          );
          return;
        }

        const usuario = usuarioSnap.data() as UsuarioDoc;
        unsubAtleta = onSnapshot(doc(db, "atletas", usuario.atletaId), (atletaSnap) => {
          if (!atletaSnap.exists()) {
            setSession({ status: "pending" });
            return;
          }
          setSession({
            status: "active",
            uid: user.uid,
            usuario,
            atleta: { id: atletaSnap.id, ...atletaSnap.data() } as AtletaDoc,
          });
        });
      });
    });

    return () => {
      clearNested();
      unsubAuth();
    };
  }, []);

  async function logout() {
    await signOut(auth);
  }

  async function confirmarVerificacaoEmail() {
    const user = auth.currentUser;
    if (!user) return false;
    await user.reload();
    await user.getIdToken(true);
    if (!user.emailVerified) return false;
    await criarSolicitacaoSeNecessario(user);
    setSession({ status: "pending" });
    return true;
  }

  async function reenviarVerificacaoEmail() {
    const user = auth.currentUser;
    if (!user) throw new Error("Sessão encerrada.");
    await sendEmailVerification(user);
  }

  return (
    <SessionContext.Provider
      value={{ session, logout, confirmarVerificacaoEmail, reenviarVerificacaoEmail }}
    >
      {session.status === "loading" ? (
        <AppSplash />
      ) : session.status === "email-nao-verificado" ? (
        <EmailVerificationScreen
          email={session.email}
          onConfirmar={confirmarVerificacaoEmail}
          onReenviar={reenviarVerificacaoEmail}
          onLogout={logout}
        />
      ) : session.status === "pending" ? (
        <PendingScreen onLogout={logout} />
      ) : session.status === "recusado" ? (
        <RecusadoScreen motivo={session.motivo} onLogout={logout} />
      ) : (
        children
      )}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Helper para telas que exigem sessão ativa (uso após já saber status==="active"). */
export function useActiveSession() {
  const { session, logout } = useSession();
  if (session.status !== "active") {
    throw new Error("useActiveSession chamado fora de uma sessão ativa");
  }
  return { ...session, logout };
}
