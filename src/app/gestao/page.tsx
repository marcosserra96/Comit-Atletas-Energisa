"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { primeiraRotaPermitida, temPermissao } from "@/lib/permissoes";
import { VisaoEstrategica } from "./VisaoEstrategica";

export default function GestaoDashboardPage() {
  const { usuario } = useActiveSession();
  const router = useRouter();
  const podeVerInicio = temPermissao(usuario, "inicio");
  const rotaAlternativa = podeVerInicio ? null : primeiraRotaPermitida(usuario);

  useEffect(() => {
    if (rotaAlternativa) router.replace(rotaAlternativa);
  }, [rotaAlternativa, router]);

  if (podeVerInicio) return <VisaoEstrategica />;
  // Sem "inicio" mas com alguma outra permissão: mostra um loader breve
  // enquanto redireciona pra primeira área que a pessoa realmente acessa.
  if (rotaAlternativa) return <FullScreenLoader />;
  // Sem nenhuma permissão configurada — aí sim não há pra onde mandar.
  return <NotAuthorized />;
}
