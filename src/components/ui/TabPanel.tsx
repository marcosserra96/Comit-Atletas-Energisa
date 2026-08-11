"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Suaviza a entrada do conteúdo ao trocar de aba. Use com `key={aba}` pra que a
 * troca remonte o painel e a animação rode de novo.
 *
 * Sem AnimatePresence/exit de propósito: com vários painéis condicionais o
 * mode="wait" fica esperando uma saída que nunca conclui e a aba nova nunca
 * chega a montar — o conteúdo simplesmente não troca.
 */
export function TabPanel({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
