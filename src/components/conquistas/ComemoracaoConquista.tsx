"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Share2 } from "lucide-react";
import type { MedalhaDoAtleta } from "@/lib/conquistas";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Medalha } from "./Medalha";

/** A medalha nova aparece uma vez, com um único movimento: é o momento "uau". */
export function ComemoracaoConquista({
  novas,
  onFechar,
  onCompartilhar,
}: {
  novas: MedalhaDoAtleta[];
  onFechar: () => void;
  onCompartilhar?: () => void;
}) {
  const reduzir = useReducedMotion();
  const principal = [...novas].sort((a, b) => b.nivel - a.nivel)[0];
  const outras = novas.filter((m) => m.id !== principal?.id);

  return (
    <Modal open={!!principal} onClose={onFechar} mobileSheet title={novas.length > 1 ? `${novas.length} conquistas novas` : "Nova conquista"}>
      {principal ? (
        <div className="flex flex-col items-center gap-4 pb-1 text-center">
          <div className="relative flex size-44 items-center justify-center">
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(250,204,21,0.35) 0%, rgba(243,112,33,0.12) 45%, transparent 70%)" }}
              aria-hidden="true"
            />
            <motion.div
              initial={reduzir ? { opacity: 0 } : { scale: 0.55, rotate: -14, opacity: 0 }}
              animate={reduzir ? { opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
              transition={reduzir ? { duration: 0.2 } : { type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
            >
              <Medalha icone={principal.icone} nivel={principal.nivel} conquistada tamanho={132} />
            </motion.div>
          </div>
          <div>
            <p className="text-2xl font-black text-text">{principal.titulo}</p>
            <p className="mt-1 text-sm text-text-light">{principal.descricao.replace(/\.$/, "")}: feito!</p>
          </div>
          {outras.length ? (
            <ul className="flex flex-wrap justify-center gap-3" aria-label="Outras conquistas novas">
              {outras.map((m) => (
                <li key={m.id} className="flex w-20 flex-col items-center gap-1">
                  <Medalha icone={m.icone} nivel={m.nivel} conquistada tamanho={44} />
                  <span className="text-[11px] font-semibold leading-tight text-text">{m.titulo}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex w-full flex-col gap-2 pt-1 sm:flex-row-reverse">
            {onCompartilhar ? (
              <Button
                className="w-full"
                onClick={() => {
                  onFechar();
                  onCompartilhar();
                }}
              >
                <Share2 className="size-4" aria-hidden="true" />
                Compartilhar
              </Button>
            ) : null}
            <Button variant="ghost" className="w-full" onClick={onFechar}>
              Continuar
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
