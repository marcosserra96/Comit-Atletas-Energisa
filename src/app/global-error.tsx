"use client";

import { ErroInesperado } from "@/components/ErroInesperado";
import "./globals.css";

/** Último recurso: o layout raiz quebrou. Precisa do próprio <html> e <body>. */
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="bg-bg text-text antialiased">
        <title>Algo deu errado · Atletas Energisa</title>
        <ErroInesperado error={error} tentarDeNovo={unstable_retry} />
      </body>
    </html>
  );
}
