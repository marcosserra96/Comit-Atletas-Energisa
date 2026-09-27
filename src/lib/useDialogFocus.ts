import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento de teclado e foco de um diálogo modal:
 * - foca o elemento com `autofocus` (ou o primeiro focável) ao abrir;
 * - fecha com Escape;
 * - mantém o Tab preso dentro do diálogo;
 * - devolve o foco para quem abriu ao fechar.
 *
 * `onClose` fica guardado em ref de propósito: as páginas costumam passar uma
 * função inline, que muda a cada render. Se ela fosse dependência do efeito,
 * qualquer re-render do pai (ex.: um `onSnapshot` do Firestore) reiniciaria o
 * efeito e jogaria o foco de volta para o primeiro campo enquanto a pessoa digita.
 */
export function useDialogFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const animationFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const autoFocus = dialog?.querySelector<HTMLElement>("[autofocus]");
      const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE);
      (autoFocus ?? firstFocusable ?? dialog)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      const dialog = dialogRef.current;
      if (event.key !== "Tab" || !dialog) return;

      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
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
  }, [open, dialogRef]);
}
