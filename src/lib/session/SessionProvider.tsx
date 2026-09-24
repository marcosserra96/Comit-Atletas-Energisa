"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AppSplash } from "@/components/ui/AppSplash";
import { PendingScreen } from "@/components/session/PendingScreen";
import { RecusadoScreen } from "@/components/session/RecusadoScreen";
import { TermosAceiteScreen } from "@/components/session/TermosAceiteScreen";
import { TermosErroScreen } from "@/components/session/TermosErroScreen";
import type {
  AtletaDoc,
  SolicitacaoAcessoDoc,
  TermosProgramaDoc,
  UsuarioDoc,
} from "@/lib/types";

type ActiveSessionData = { uid: string; usuario: UsuarioDoc; atleta: AtletaDoc };

type Session =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "pending" }
  | { status: "recusado"; motivo?: string }
  | ({ status: "termos-pendentes"; termos: TermosProgramaDoc } & ActiveSessionData)
  | ({ status: "erro-termos" } & ActiveSessionData)
  | ({ status: "active" } & ActiveSessionData);

interface SessionContextValue {
  session: Session;
  logout: () => Promise<void>;
  aceitarTermos: () => Promise<void>;
  recarregarTermos: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export async function criarSolicitacaoSeNecessario(user: User, nomeInformado?: string) {
  const solicitacaoRef = doc(db, "solicitacoes_acesso", user.uid);
  const email = user.email?.trim().toLowerCase();
  if (!email) throw new Error("Usuário sem e-mail.");

  await user.getIdToken(true);
  await runTransaction(db, async (transaction) => {
    const existente = await transaction.get(solicitacaoRef);
    if (existente.exists()) return;

    transaction.set(solicitacaoRef, {
      uid: user.uid,
      nome: nomeInformado?.trim() || user.displayName?.trim() || email.split("@")[0],
      email,
      status: "pendente",
      criadoEm: serverTimestamp(),
    });
  });
}

async function respostaJson(response: Response) {
  const texto = await response.text();
  if (!texto) return {};
  try {
    return JSON.parse(texto) as Record<string, unknown>;
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }
}

async function consultarTermos(user: User, dados: ActiveSessionData): Promise<Session> {
  const token = await user.getIdToken();
  const response = await fetch("/api/termos/status", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await respostaJson(response);
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Falha ao verificar os termos.");
  }

  if (body.exigido === true && body.termos && typeof body.termos === "object") {
    const termos = body.termos as Record<string, unknown>;
    return {
      status: "termos-pendentes",
      ...dados,
      termos: {
        titulo: String(termos.titulo || "Termos do Programa"),
        conteudo: String(termos.conteudo || ""),
        versao: Number(termos.versao) || 1,
        ativo: true,
      },
    };
  }

  return { status: "active", ...dados };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });

  useEffect(() => {
    let unsubUsuario: (() => void) | undefined;
    let unsubSolicitacao: (() => void) | undefined;
    let unsubAtleta: (() => void) | undefined;
    let verificacaoAtual = 0;

    function clearNested() {
      verificacaoAtual += 1;
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
          try {
            await criarSolicitacaoSeNecessario(user);
          } catch {
            setSession({ status: "pending" });
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
          const dados: ActiveSessionData = {
            uid: user.uid,
            usuario,
            atleta: { id: atletaSnap.id, ...atletaSnap.data() } as AtletaDoc,
          };
          const verificacao = ++verificacaoAtual;
          setSession({ status: "loading" });
          void consultarTermos(user, dados)
            .then((proximaSessao) => {
              if (verificacao === verificacaoAtual) setSession(proximaSessao);
            })
            .catch(() => {
              if (verificacao === verificacaoAtual) {
                setSession({ status: "erro-termos", ...dados });
              }
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

  async function recarregarTermos() {
    const user = auth.currentUser;
    if (!user || (session.status !== "erro-termos" && session.status !== "termos-pendentes")) {
      return;
    }
    const dados = { uid: session.uid, usuario: session.usuario, atleta: session.atleta };
    setSession({ status: "loading" });
    try {
      setSession(await consultarTermos(user, dados));
    } catch {
      setSession({ status: "erro-termos", ...dados });
    }
  }

  async function aceitarTermos() {
    const user = auth.currentUser;
    if (!user || session.status !== "termos-pendentes") {
      throw new Error("Sessão encerrada. Entre novamente.");
    }
    const token = await user.getIdToken();
    const response = await fetch("/api/termos/aceitar", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await respostaJson(response);
    if (!response.ok) {
      throw new Error(
        typeof body.error === "string" ? body.error : "Não foi possível registrar o aceite.",
      );
    }
    setSession({
      status: "active",
      uid: session.uid,
      usuario: session.usuario,
      atleta: session.atleta,
    });
  }

  return (
    <SessionContext.Provider
      value={{ session, logout, aceitarTermos, recarregarTermos }}
    >
      {session.status === "loading" ? (
        <AppSplash />
      ) : session.status === "pending" ? (
        <PendingScreen onLogout={logout} />
      ) : session.status === "recusado" ? (
        <RecusadoScreen motivo={session.motivo} onLogout={logout} />
      ) : session.status === "termos-pendentes" ? (
        <TermosAceiteScreen
          titulo={session.termos.titulo}
          conteudo={session.termos.conteudo}
          versao={session.termos.versao}
          nome={session.atleta.nome}
          email={session.atleta.email || auth.currentUser?.email || ""}
          onAceitar={aceitarTermos}
          onLogout={logout}
        />
      ) : session.status === "erro-termos" ? (
        <TermosErroScreen onRetry={recarregarTermos} onLogout={logout} />
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
