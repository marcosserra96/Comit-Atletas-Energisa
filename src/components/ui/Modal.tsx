"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

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

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const animationFrame = window.requestAnimationFrame(() => {
      const autoFocus = dialogRef.current?.querySelector<HTMLElement>("[autofocus]");
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (autoFocus ?? firstFocusable ?? dialogRef.current)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose]);

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
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "w-full border border-border bg-bg-card p-4 shadow-[var(--shadow-modal)] sm:p-6",
                SIZES[size],
                mobileSheet
                  ? "rounded-t-[var(--radius-2xl)] border-b-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-[var(--radius-lg)] sm:border-b"
                  : "rounded-[var(--radius-lg)]",
              )}
            >
              <div className="mb-1 flex items-start justify-between gap-3">
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
