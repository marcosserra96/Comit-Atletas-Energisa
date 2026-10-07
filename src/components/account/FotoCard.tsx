"use client";

import { Camera } from "lucide-react";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { Card } from "@/components/ui/Card";
import { EditorFotoAtleta } from "@/components/atletas/AvatarAtleta";

/** Foto de quem está conectado: aparece na barra do topo e, para quem também treina, no ranking e na reunião. */
export function FotoCard() {
  const { atleta } = useActiveSession();
  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-text">
        <Camera className="size-4 text-text-muted" />
        Sua foto
      </h3>
      <EditorFotoAtleta atleta={atleta} />
    </Card>
  );
}
