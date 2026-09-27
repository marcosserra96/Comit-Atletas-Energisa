"use client";

import { useEffect, useState } from "react";

/**
 * Verdadeiro quando o título principal da página (o primeiro `<h1>` visível
 * dentro de `<main>`) saiu da tela por rolagem. A barra superior usa isso para
 * mostrar o nome da página só quando ele não está mais à vista — assim o mesmo
 * título não aparece duas vezes, uma em cima da outra.
 *
 * Se a página não tiver `<h1>`, devolve verdadeiro (a barra mostra o título).
 */
export function useTituloDaPaginaForaDaTela(pathname: string, alturaDaBarra = 64) {
  const [foraDaTela, setForaDaTela] = useState(false);

  useEffect(() => {
    let intersection: IntersectionObserver | null = null;
    let observado: Element | null = null;

    function acharTitulo() {
      const titulos = document.querySelectorAll<HTMLElement>("main h1");
      return [...titulos].find((h) => h.offsetParent !== null) ?? null;
    }

    function observar() {
      const titulo = acharTitulo();
      if (titulo === observado) return;
      intersection?.disconnect();
      observado = titulo;
      if (!titulo) {
        setForaDaTela(true);
        return;
      }
      intersection = new IntersectionObserver(
        ([entrada]) => setForaDaTela(!entrada.isIntersecting),
        { rootMargin: `-${alturaDaBarra}px 0px 0px 0px` },
      );
      intersection.observe(titulo);
    }

    // As páginas carregam dados antes de mostrar o título; acompanha o <main>
    // até ele aparecer (ou trocar, entre skeleton e conteúdo).
    const main = document.querySelector("main");
    const mutation = new MutationObserver(observar);
    if (main) mutation.observe(main, { childList: true, subtree: true });
    observar();

    return () => {
      mutation.disconnect();
      intersection?.disconnect();
    };
  }, [pathname, alturaDaBarra]);

  return foraDaTela;
}
