"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Entrada curta ao trocar de tela: o conteúdo sobe 6px e aparece. Rápida o
 * bastante para não atrasar quem navega muito; com "reduzir movimento" vira
 * só o fade (MotionProvider).
 */
export function EntradaDePagina({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
