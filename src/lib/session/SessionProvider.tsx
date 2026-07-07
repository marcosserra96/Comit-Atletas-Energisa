"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { PendingScreen } from "@/components/session/PendingScreen";
import { RecusadoScreen } from "@/components/session/RecusadoScreen";
import type { AtletaDoc, SolicitacaoAcessoDoc, UsuarioDoc } from "@/lib/types";

type Session =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "pending" }
  | { status: "recusado"; motivo?: string }
  | { status: "active"; uid: string; usuario: UsuarioDoc; atleta: AtletaDoc };

interface SessionContextValue {
  session: Session;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

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

      unsubUsuario = onSnapshot(doc(db, "usuarios", user.uid), (usuarioSnap) => {
        unsubSolicitacao?.();
        unsubAtleta?.();

        if (!usuarioSnap.exists()) {
          // Ainda não foi aprovado/vinculado — verifica a solicitação de acesso.
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

  return (
    <SessionContext.Provider value={{ session, logout }}>
      {session.status === "loading" ? (
        <FullScreenLoader />
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
