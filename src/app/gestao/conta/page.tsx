"use client";

import { useActiveSession } from "@/lib/session/SessionProvider";
import { AparenciaCard } from "@/components/account/AparenciaCard";
import { SenhaCard } from "@/components/account/SenhaCard";
import { FotoCard } from "@/components/account/FotoCard";

export default function MinhaContaPage() {
  const { atleta } = useActiveSession();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-text">Minha conta</h1>
        <p className="text-sm text-text-light">
          Personalize a aparência do portal e gerencie os dados de {atleta.nome.split(" ")[0]}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FotoCard />
        <AparenciaCard />
        <SenhaCard />
      </div>
    </div>
  );
}
