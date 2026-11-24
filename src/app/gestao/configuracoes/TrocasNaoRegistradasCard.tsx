"use client";

import { useState } from "react";
import { ArrowRight, Repeat, Search } from "lucide-react";
import { carregarTodosLancamentos } from "@/lib/lancamentosCache";
import { formatDataTreino, plural } from "@/lib/format";
import { modalidadeLabel } from "@/lib/labels";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { sugerirTroca, type TrocaDeModalidade } from "@/lib/modalidade";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { salvarTrocas } from "../atletas/ficha/TrocasModalidade";
import type { AtletaDoc, HistoricoPontoDoc } from "@/lib/types";

interface Achado {
  atleta: AtletaDoc;
  troca: TrocaDeModalidade;
}

/**
 * Quem trocou de modalidade antes do registro de trocas existir: os
 * lançamentos guardam a equipe do dia. Procura só quando pedem (lê o
 * histórico inteiro) e registra uma a uma ou todas de uma vez.
 */
export function TrocasNaoRegistradasCard({ atletas }: { atletas: AtletaDoc[] | null }) {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [procurando, setProcurando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  async function procurar() {
    if (!atletas) return;
    setProcurando(true);
    try {
      const porAtleta = new Map<string, HistoricoPontoDoc[]>();
      for (const l of await carregarTodosLancamentos()) {
        const lista = porAtleta.get(l.atletaId);
        if (lista) lista.push(l);
        else porAtleta.set(l.atletaId, [l]);
      }
      setAchados(
        atletas
          .filter(perfilAtletaVisivel)
          .flatMap((a) => {
            const troca = sugerirTroca(a, porAtleta.get(a.id) ?? []);
            return troca ? [{ atleta: a, troca }] : [];
          })
          .sort((a, b) => a.atleta.nome.localeCompare(b.atleta.nome, "pt-BR")),
      );
    } catch {
      show("error", "Não foi possível ler os lançamentos agora. Tente novamente.");
    } finally {
      setProcurando(false);
    }
  }

  async function registrar(lista: Achado[]) {
    setSalvando(lista.length === 1 ? lista[0].atleta.id : "todas");
    let feitas = 0;
    try {
      for (const { atleta, troca } of lista) {
        await salvarTrocas({
          atleta,
          trocas: [{ ...troca, registradoPor: uid, registradoPorNome: autor.nome, registradoEm: new Date().toISOString() }],
          autor: { uid, nome: autor.nome },
          acao: "trocas_modalidade",
        });
        feitas += 1;
      }
      const ids = new Set(lista.map((x) => x.atleta.id));
      setAchados((atual) => atual?.filter((x) => !ids.has(x.atleta.id)) ?? null);
      show("success", feitas === 1 ? "Troca registrada." : `${feitas} trocas registradas.`);
    } catch {
      show("error", feitas > 0 ? `${plural(feitas, "troca registrada", "trocas registradas")}; as outras não. Tente de novo.` : "Não foi possível registrar agora. Tente novamente.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <Repeat className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-text">Trocas de modalidade sem registro</h3>
          <p className="text-xs text-text-light [text-wrap:pretty]">
            Quem passou da Bike para a Corrida (ou o contrário) antes do registro de trocas leva os pontos antigos para a modalidade nova. Os lançamentos mostram quem trocou e quando; confira e registre.
          </p>
        </div>
      </div>

      {achados === null ? (
        <Button size="sm" variant="secondary" className="w-fit" onClick={() => void procurar()} loading={procurando} disabled={!atletas}>
          <Search className="size-4" aria-hidden="true" />
          Procurar nos lançamentos
        </Button>
      ) : achados.length === 0 ? (
        <p className="rounded-[var(--radius)] bg-bg-inset/60 px-3 py-2.5 text-sm text-text-light">Nenhuma troca sem registro. Os pontos de todos estão na modalidade certa.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border-subtle rounded-[var(--radius)] border border-border">
            {achados.map(({ atleta, troca }) => (
              <li key={atleta.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{atleta.nome}</p>
                  <p className="flex items-center gap-1 text-xs text-text-light">
                    {modalidadeLabel[troca.de]}
                    <ArrowRight className="size-3 shrink-0" aria-label="para" />
                    {modalidadeLabel[troca.para]} desde {formatDataTreino(troca.data)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" loading={salvando === atleta.id} disabled={!!salvando} onClick={() => void registrar([{ atleta, troca }])}>
                  Registrar
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-text-muted">A data é o primeiro lançamento na modalidade nova. Para ajustar, abra a ficha do atleta.</p>
            {achados.length > 1 ? (
              <Button size="sm" loading={salvando === "todas"} disabled={!!salvando} onClick={() => void registrar(achados)}>
                Registrar as {achados.length}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}
