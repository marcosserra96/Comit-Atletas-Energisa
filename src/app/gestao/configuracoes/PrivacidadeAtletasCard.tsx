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
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
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
      const [snapshot, publicosSnapshot] = await Promise.all([
        getDocs(collection(db, "atletas")),
        getDocs(collection(db, "atletas_publicos")),
      ]);
      const atletas = snapshot.docs.map(
        (documento) => ({ id: documento.id, ...documento.data() }) as AtletaDoc,
      );
      const atletasVisiveis = atletas.filter(perfilAtletaVisivel);
      const idsVisiveis = new Set(atletasVisiveis.map((atleta) => atleta.id));
      const operacoes = [
        ...atletasVisiveis.map((atleta) => ({ tipo: "salvar" as const, atleta })),
        ...publicosSnapshot.docs
          .filter((documento) => !idsVisiveis.has(documento.id))
          .map((documento) => ({ tipo: "excluir" as const, id: documento.id })),
      ];

      for (let inicio = 0; inicio < operacoes.length; inicio += BATCH_SIZE) {
        const batch = writeBatch(db);
        for (const operacao of operacoes.slice(inicio, inicio + BATCH_SIZE)) {
          if (operacao.tipo === "salvar") {
            batch.set(
              doc(db, "atletas_publicos", operacao.atleta.id),
              dadosAtletaPublico(operacao.atleta),
            );
          } else {
            batch.delete(doc(db, "atletas_publicos", operacao.id));
          }
        }
        await batch.commit();
      }
      await setDoc(
        doc(db, "configuracoes", "privacidade_atletas"),
        {
          ativa: true,
          quantidadeSincronizada: atletasVisiveis.length,
          atualizadoEm: serverTimestamp(),
          atualizadoPor: uid,
        },
        { merge: true },
      );
      show(
        "success",
        `${atletasVisiveis.length} atletas visíveis sincronizados. Perfis ocultos ficaram fora da camada pública.`,
      );
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
