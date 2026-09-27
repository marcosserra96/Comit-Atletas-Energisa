import { useSyncExternalStore } from "react";

function nuncaMuda() {
  return () => {};
}

/**
 * A query string atual (`window.location.search`) lida durante o render.
 * No servidor e na hidratação devolve `undefined` ("ainda não sei"); no
 * cliente, a string. Evita ler a URL num efeito só para copiar para o estado.
 */
export function useBuscaDaUrl() {
  return useSyncExternalStore(
    nuncaMuda,
    () => window.location.search,
    () => undefined,
  );
}
