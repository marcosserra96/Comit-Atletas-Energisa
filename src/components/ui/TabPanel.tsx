"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Envolve o conteúdo de uma aba pra usar dentro de um <AnimatePresence mode="wait">
 * no lugar da troca instantânea de {cond && <Componente />}. Mesma duração/easing
 * do Toast e do Modal, pra manter a sensação consistente no app inteiro.
 */
export function TabPanel({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
