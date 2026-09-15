"use client";

import { useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { dadosAtletaPublico } from "@/lib/publicAthletes";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { AtletaDoc } from "@/lib/types";

const BATCH_SIZE = 400;

export function PrivacidadeAtletasCard() {
  const { uid } = useActiveSession();
  const { show } = useToast();
  const [sincronizando, setSincronizando] = useState(false);

  async function handleSincronizar() {
    setSincronizando(true);
    try {
      const snapshot = await getDocs(collection(db, "atletas"));
      for (let inicio = 0; inicio < snapshot.docs.length; inicio += BATCH_SIZE) {
        const batch = writeBatch(db);
        for (const documento of snapshot.docs.slice(inicio, inicio + BATCH_SIZE)) {
          const atleta = { id: documento.id, ...documento.data() } as AtletaDoc;
          batch.set(doc(db, "atletas_publicos", atleta.id), dadosAtletaPublico(atleta));
        }
        await batch.commit();
      }
      await setDoc(
        doc(db, "configuracoes", "privacidade_atletas"),
        {
          ativa: true,
          quantidadeSincronizada: snapshot.size,
          atualizadoEm: serverTimestamp(),
          atualizadoPor: uid,
        },
        { merge: true },
      );
      show("success", `${snapshot.size} atletas sincronizados. O ranking agora usa somente dados públicos.`);
    } catch {
      show("error", "Não foi possível preparar a camada pública dos atletas.");
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <Card className="border-secondary/20 bg-secondary/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" />
          <div>
            <h3 className="text-sm font-bold text-text">Privacidade dos atletas</h3>
            <p className="mt-0.5 max-w-2xl text-xs text-text-light">
              Sincroniza nome, equipe, status e pontuação numa coleção pública separada.
              E-mail, nascimento, localidade e vínculo de login permanecem no cadastro privado.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={handleSincronizar} loading={sincronizando}>
          Sincronizar dados públicos
        </Button>
      </div>
    </Card>
  );
}
