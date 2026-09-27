"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Faz todas as animações do framer-motion respeitarem a preferência
 * "reduzir movimento" do sistema: deslocamentos e escalas viram mudanças
 * instantâneas, e fades de opacidade continuam (ajudam a entender a mudança).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
