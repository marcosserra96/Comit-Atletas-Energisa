"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  show: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const iconByKind: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const colorByKind: Record<ToastKind, string> = {
  success: "text-success border-success/30",
  error: "text-danger border-danger/30",
  info: "text-primary border-primary/30",
};

let counter = 0;

/** Tempo na tela: erros ficam mais, porque costumam ter mais texto e pedem ação. */
const DURACAO_MS: Record<ToastKind, number> = { success: 4500, info: 4500, error: 7000 };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const agendar = useCallback(
    (id: number, ms: number) => {
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => dismiss(id), ms));
    },
    [dismiss],
  );

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, kind, message }]);
      agendar(id, DURACAO_MS[kind]);
    },
    [agendar],
  );

  useEffect(() => {
    const ativos = timers.current;
    return () => ativos.forEach((timer) => clearTimeout(timer));
  }, []);

  /** Mouse em cima pausa o fechamento; ao sair, dá um tempo curto para terminar de ler. */
  const pausar = (id: number) => clearTimeout(timers.current.get(id));
  const retomar = (id: number) => agendar(id, 2500);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = iconByKind[toast.kind];
            return (
              <motion.div
                key={toast.id}
                role={toast.kind === "error" ? "alert" : undefined}
                onMouseEnter={() => pausar(toast.id)}
                onMouseLeave={() => retomar(toast.id)}
                onFocus={() => pausar(toast.id)}
                onBlur={() => retomar(toast.id)}
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  "pointer-events-auto flex items-center gap-2.5 rounded-[var(--radius)] border bg-bg-card px-4 py-3 shadow-[var(--shadow-elevated)]",
                  "max-w-sm w-full",
                  colorByKind[toast.kind],
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                <p className="text-sm font-medium text-text flex-1">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Fechar aviso"
                  className="-my-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:text-text-light"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
