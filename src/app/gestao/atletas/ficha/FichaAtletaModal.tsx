"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, History, IdCard, MessageSquare, ShieldCheck, X } from "lucide-react";
import { equipeLabel } from "@/lib/labels";
import { FichaResumoTab } from "./FichaResumoTab";
import { FichaLancamentosTab } from "./FichaLancamentosTab";
import { FichaCadastroTab } from "./FichaCadastroTab";
import { FichaComentariosTab } from "./FichaComentariosTab";
import { FichaAuditoriaTab } from "./FichaAuditoriaTab";
import type { AtletaDoc } from "@/lib/types";

type FichaTab = "resumo" | "lancamentos" | "cadastro" | "comentarios" | "auditoria";

const TABS: { value: FichaTab; label: string; icon: typeof LayoutDashboard }[] = [
  { value: "resumo", label: "Resumo", icon: LayoutDashboard },
  { value: "lancamentos", label: "Lançamentos", icon: History },
  { value: "cadastro", label: "Cadastro", icon: IdCard },
  { value: "comentarios", label: "Comentários", icon: MessageSquare },
  { value: "auditoria", label: "Auditoria", icon: ShieldCheck },
];

export function FichaAtletaModal({
  atleta,
  initialTab = "resumo",
  onClose,
}: {
  atleta: AtletaDoc | null;
  initialTab?: FichaTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<FichaTab>(initialTab);

  return (
    <AnimatePresence>
      {atleta && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ficha-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="flex h-[85vh] max-h-[720px] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border bg-bg-card shadow-lg"
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-4 sm:px-6">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#007ba3] text-sm font-extrabold text-white shadow-sm">
                {atleta.nome.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="ficha-title" className="truncate text-base font-bold text-text">
                  {atleta.nome}
                </h2>
                <p className="truncate text-xs text-text-muted">{equipeLabel[atleta.equipe]}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="shrink-0 rounded-[var(--radius)] p-2 text-text-muted hover:bg-bg hover:text-text"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 sm:px-4">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-semibold transition-colors ${
                    tab === t.value
                      ? "border-primary text-primary"
                      : "border-transparent text-text-muted hover:text-text"
                  }`}
                >
                  <t.icon className="size-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {tab === "resumo" && <FichaResumoTab atleta={atleta} />}
              {tab === "lancamentos" && <FichaLancamentosTab atleta={atleta} />}
              {tab === "cadastro" && <FichaCadastroTab atleta={atleta} onSaved={onClose} />}
              {tab === "comentarios" && <FichaComentariosTab atleta={atleta} />}
              {tab === "auditoria" && <FichaAuditoriaTab atleta={atleta} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
