import { useEffect } from "react";

/** Trava o scroll do body enquanto um modal/overlay está aberto, pra rolagem dentro dele não arrastar o fundo junto. */
export function useLockBodyScroll(travado: boolean) {
  useEffect(() => {
    if (!travado) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [travado]);
}
