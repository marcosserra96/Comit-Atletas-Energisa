"use client";

import { ErroInesperado } from "@/components/ErroInesperado";

export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErroInesperado error={error} tentarDeNovo={unstable_retry} />;
}
