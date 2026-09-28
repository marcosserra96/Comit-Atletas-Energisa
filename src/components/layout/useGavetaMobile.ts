import { useRef, type RefObject, type TouchEvent } from "react";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

/** Distância (px) ou velocidade (px/ms) do arrasto para a esquerda que fecha a gaveta. */
const DISTANCIA_PARA_FECHAR = 72;
const VELOCIDADE_PARA_FECHAR = 0.45;

/**
 * Comportamento do menu lateral no celular: foco preso e Esc (como um diálogo),
 * rolagem do fundo travada e "arrastar para a esquerda" para fechar, com a
 * gaveta acompanhando o dedo. No computador a gaveta nunca abre, então nada
 * disso roda.
 */
export function useGavetaMobile(
  aberta: boolean,
  onFechar: () => void,
  painelRef: RefObject<HTMLElement | null>,
) {
  useDialogFocus(aberta, painelRef, onFechar);
  useLockBodyScroll(aberta);

  const inicio = useRef<{ x: number; y: number; t: number; horizontal: boolean | null } | null>(null);
  const deslocamento = useRef(0);

  function aplicar(dx: number, comTransicao: boolean) {
    const painel = painelRef.current;
    if (!painel) return;
    painel.style.transition = comTransicao ? "" : "none";
    painel.style.transform = dx === 0 ? "" : `translateX(${dx}px)`;
  }

  function onTouchStart(e: TouchEvent) {
    if (!aberta) return;
    const toque = e.touches[0];
    inicio.current = { x: toque.clientX, y: toque.clientY, t: e.timeStamp, horizontal: null };
    deslocamento.current = 0;
  }

  function onTouchMove(e: TouchEvent) {
    const i = inicio.current;
    if (!i) return;
    const toque = e.touches[0];
    const dx = toque.clientX - i.x;
    const dy = toque.clientY - i.y;
    // Decide a direção no primeiro movimento claro, para não brigar com a rolagem do menu.
    if (i.horizontal === null && Math.abs(dx) + Math.abs(dy) > 8) {
      i.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!i.horizontal) return;
    deslocamento.current = Math.min(0, dx);
    aplicar(deslocamento.current, false);
  }

  function onTouchEnd(e: TouchEvent) {
    const i = inicio.current;
    inicio.current = null;
    if (!i?.horizontal) return;
    const dx = deslocamento.current;
    const velocidade = Math.abs(dx) / Math.max(1, e.timeStamp - i.t);
    aplicar(0, true);
    if (dx < -DISTANCIA_PARA_FECHAR || (dx < -24 && velocidade > VELOCIDADE_PARA_FECHAR)) onFechar();
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };
}
