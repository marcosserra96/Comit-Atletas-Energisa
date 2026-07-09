"use client";

import { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

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
}

export function Modal({ open, onClose, title, description, children, footer, size = "sm" }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] overflow-y-auto bg-navy/50 backdrop-blur-sm px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="flex min-h-full items-center justify-center">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className={`w-full ${SIZES[size]} rounded-[var(--radius-lg)] bg-bg-card border border-border shadow-lg p-6`}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 id="modal-title" className="text-lg font-bold text-text">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Fechar"
                  className="text-text-muted hover:text-text-light shrink-0"
                >
                  <X className="size-5" />
                </button>
              </div>
              {description && <p className="text-sm text-text-light mb-4">{description}</p>}
              {children}
              {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
