"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { AlertCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import type { AtletaDoc } from "@/lib/types";

interface AthleteViewContextValue {
  atleta: AtletaDoc;
  isPreview: boolean;
  withPreview: (href: string) => string;
}

const AthleteViewContext = createContext<AthleteViewContextValue | null>(null);

export function AthleteViewProvider({
  previewAtletaId,
  children,
}: {
  previewAtletaId: string | null;
  children: React.ReactNode;
}) {
  const { usuario, atleta: sessionAtleta } = useActiveSession();
  const isPreview = usuario.role === "administrador" && Boolean(previewAtletaId);
  const [previewState, setPreviewState] = useState<{
    atletaId: string;
    atleta: AtletaDoc | null;
    erro: boolean;
  } | null>(() =>
    isPreview && previewAtletaId === sessionAtleta.id
      ? { atletaId: previewAtletaId, atleta: sessionAtleta, erro: false }
      : null,
  );

  useEffect(() => {
    if (!isPreview || !previewAtletaId) return;

    const unsubscribe = onSnapshot(
      doc(db, "atletas", previewAtletaId),
      (snap) => {
        if (!snap.exists()) {
          setPreviewState({ atletaId: previewAtletaId, atleta: null, erro: true });
          return;
        }
        setPreviewState({
          atletaId: previewAtletaId,
          atleta: { id: snap.id, ...snap.data() } as AtletaDoc,
          erro: false,
        });
      },
      () => {
        setPreviewState({ atletaId: previewAtletaId, atleta: null, erro: true });
      },
    );

    return unsubscribe;
  }, [isPreview, previewAtletaId]);

  const previewAtual =
    isPreview && previewState?.atletaId === previewAtletaId ? previewState : null;
  const erro = previewAtual?.erro ?? false;
  const atleta = isPreview ? previewAtual?.atleta ?? null : sessionAtleta;

  const value = useMemo<AthleteViewContextValue | null>(() => {
    if (!atleta) return null;

    return {
      atleta,
      isPreview,
      withPreview: (href: string) => {
        if (!isPreview) return href;
        const separator = href.includes("?") ? "&" : "?";
        return `${href}${separator}visualizarAtleta=${encodeURIComponent(atleta.id)}`;
      },
    };
  }, [atleta, isPreview]);

  if (erro) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="max-w-md rounded-[var(--radius-lg)] border border-danger/20 bg-bg-card p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto size-9 text-danger" />
          <h1 className="mt-3 text-lg font-bold text-text">Atleta não encontrado</h1>
          <p className="mt-1 text-sm text-text-light">
            Não foi possível abrir esta visualização. O cadastro pode ter sido removido ou estar indisponível.
          </p>
          <Link
            href="/gestao/atletas?tab=ver"
            className="mt-5 inline-flex rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Voltar aos atletas
          </Link>
        </div>
      </div>
    );
  }

  if (!value) return <FullScreenLoader />;

  return <AthleteViewContext.Provider value={value}>{children}</AthleteViewContext.Provider>;
}

export function useAthleteView() {
  const context = useContext(AthleteViewContext);
  if (!context) {
    throw new Error("useAthleteView deve ser usado dentro de AthleteViewProvider");
  }
  return context;
}
