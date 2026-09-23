"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  RANKING_VISIBILITY_DEFAULT,
  normalizarRankingVisibility,
} from "@/lib/rankingVisibility";
import type { RankingVisibilityConfigDoc } from "@/lib/types";
import { useActiveSession } from "@/lib/session/SessionProvider";

export function useRankingAvailability() {
  const { usuario } = useActiveSession();
  const isStaff = usuario.role === "administrador" || usuario.role === "comite";
  const [config, setConfig] = useState<RankingVisibilityConfigDoc>();

  useEffect(() => {
    return onSnapshot(
      doc(db, "configuracoes", "ranking_visibilidade"),
      (snapshot) => {
        setConfig(
          snapshot.exists()
            ? normalizarRankingVisibility(
                snapshot.data() as Partial<RankingVisibilityConfigDoc>,
              )
            : RANKING_VISIBILITY_DEFAULT,
        );
      },
      () => setConfig(RANKING_VISIBILITY_DEFAULT),
    );
  }, []);

  return {
    rankingDisponivel: isStaff || config?.exibirParaAtletas === true,
    carregandoRanking: !isStaff && config === undefined,
  };
}
