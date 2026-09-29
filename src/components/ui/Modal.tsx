"use client";

import { useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

// Curvas do design system: modal central com ease-out forte; sheet sobe de baixo
// e desce pelo mesmo caminho, com a curva de gaveta do iOS.
const ANIMACAO_MODAL = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.97 },
  transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] as const },
};
const ANIMACAO_SHEET = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
  transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] as const },
};

const CONSULTA_CELULAR = "(max-width: 639px)";

/** Mesmo corte do breakpoint `sm` do Tailwind, que decide se o modal vira sheet. */
function useEhCelular() {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia(CONSULTA_CELULAR);
      consulta.addEventListener("change", avisar);
      return () => consulta.removeEventListener("change", avisar);
    },
    () => window.matchMedia(CONSULTA_CELULAR).matches,
    () => false,
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  mobileSheet?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "sm",
  mobileSheet = false,
}: ModalProps) {
  useLockBodyScroll(open);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useDialogFocus(open, dialogRef, onClose);
  const comoSheet = useEhCelular() && mobileSheet;
  const arrasto = useDragControls();

  // Sheet: arrastar para baixo pela alça ou pelo título fecha, como nos apps nativos.
  function aoSoltar(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn(
            "fixed inset-0 z-[90] overflow-y-auto bg-navy/50 backdrop-blur-sm",
            mobileSheet ? "px-0 py-0 sm:px-4 sm:py-6" : "px-4 py-6",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div
            className={cn(
              "flex min-h-full justify-center",
              mobileSheet ? "items-end sm:items-center" : "items-center",
            )}
          >
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descriptionId : undefined}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
              {...(comoSheet ? ANIMACAO_SHEET : ANIMACAO_MODAL)}
              {...(comoSheet
                ? {
                    drag: "y" as const,
                    dragControls: arrasto,
                    dragListener: false,
                    dragConstraints: { top: 0, bottom: 0 },
                    dragElastic: { top: 0, bottom: 0.9 },
                    onDragEnd: aoSoltar,
                  }
                : {})}
              className={cn(
                "w-full border border-border bg-bg-card p-4 shadow-[var(--shadow-modal)] sm:p-6",
                SIZES[size],
                mobileSheet
                  ? "rounded-t-[var(--radius-2xl)] border-b-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-[var(--radius-lg)] sm:border-b"
                  : "rounded-[var(--radius-lg)]",
              )}
            >
              {comoSheet ? (
                <div
                  aria-hidden="true"
                  onPointerDown={(evento) => arrasto.start(evento)}
                  className="-mx-4 -mt-4 flex h-6 touch-none cursor-grab items-center justify-center"
                >
                  <span className="h-1 w-10 rounded-full bg-border-strong" />
                </div>
              ) : null}
              <div
                onPointerDown={comoSheet ? (evento) => arrasto.start(evento) : undefined}
                className={cn("mb-1 flex items-start justify-between gap-3", comoSheet && "touch-none")}
              >
                <h2 id={titleId} className="text-lg font-bold text-text">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="-mr-2 -mt-2 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full p-2 text-text-muted hover:text-text-light"
                >
                  <X className="size-5" />
                </button>
              </div>
              {description ? (
                <p id={descriptionId} className="mb-4 text-sm text-text-light">
                  {description}
                </p>
              ) : null}
              {children}
              {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
