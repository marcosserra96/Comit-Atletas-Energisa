"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Search, Trophy } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SportBadge } from "@/components/ui/SportBadge";
import { RankingPosition } from "@/components/ui/RankingPosition";
import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { AtletaDoc, Modalidade } from "@/lib/types";

interface RankedAtleta extends AtletaDoc {
  rank: number;
  kmTotal?: number;
}

export default function RankingPage() {
  const { atleta: myAtleta } = useActiveSession();
  
  const initialModality = (myAtleta.equipe === "corrida" || myAtleta.equipe === "bicicleta") 
    ? myAtleta.equipe 
    : "corrida";

  const [modalidade, setModalidade] = useState<Modalidade>(initialModality);
  const [corredores, setCorredores] = useState<AtletaDoc[] | null>(null);
  const [ciclistas, setCiclistas] = useState<AtletaDoc[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "atletas"),
      where("equipe", "==", "corrida"),
      orderBy("pontuacaoTotal", "desc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => setCorredores(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
      () => setCorredores([])
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "atletas"),
      where("equipe", "==", "bicicleta"),
      orderBy("pontuacaoTotal", "desc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => setCiclistas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
      () => setCiclistas([])
    );
    return unsubscribe;
  }, []);

  const atletasAtuais = modalidade === "corrida" ? corredores : ciclistas;

  const atletasComRank = useMemo(() => {
    if (!atletasAtuais) return null;
    return atletasAtuais.map((a, i) => {
      return { 
        ...a, 
        rank: i + 1,
        kmTotal: (a as any).kmTotal || 0
      } as RankedAtleta;
    });
  }, [atletasAtuais]);

  const filteredAtletas = useMemo(() => {
    if (!atletasComRank) return null;
    if (!search.trim()) return atletasComRank;
    const s = search.toLowerCase();
    return atletasComRank.filter((a) => a.nome.toLowerCase().includes(s));
  }, [atletasComRank, search]);

  const top3 = useMemo(() => {
    if (!atletasComRank) return [];
    return atletasComRank.slice(0, 3);
  }, [atletasComRank]);

  const myRankAtleta = atletasComRank?.find((a) => a.id === myAtleta.id);

  const renderPodium = () => {
    if (top3.length === 0) return null;
    const [primeiro, segundo, terceiro] = top3;

    return (
      <div className="flex items-end justify-center gap-2 sm:gap-4 mt-12 mb-12 h-56 sm:h-64 px-2">
        {/* 2º Lugar */}
        <div className="flex flex-col items-center justify-end w-1/3 max-w-[120px] h-[75%] relative">
          {segundo ? (
            <>
              <div className="text-center mb-2 flex flex-col items-center w-full px-1">
                <RankingPosition position={2} size="md" className="mb-2 sm:hidden" />
                <RankingPosition position={2} size="lg" className="mb-2 hidden sm:flex" />
                <span className="font-bold text-text text-xs sm:text-sm line-clamp-2 leading-tight w-full truncate">{segundo.nome}</span>
                <span className="text-[var(--color-ranking-silver)] text-xs sm:text-sm font-extrabold">{segundo.pontuacaoTotal} pts</span>
              </div>
              <div className="w-full h-full bg-[var(--color-ranking-silver-bg)] border-2 border-[var(--color-ranking-silver)] rounded-t-[var(--radius-lg)] shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent"></div>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-bg-inset border-2 border-border border-dashed rounded-t-[var(--radius-lg)] opacity-50" />
          )}
        </div>

        {/* 1º Lugar */}
        <div className="flex flex-col items-center justify-end w-1/3 max-w-[140px] h-full z-10 relative">
          {primeiro ? (
            <>
              <div className="text-center mb-2 flex flex-col items-center w-full px-1">
                <RankingPosition position={1} size="lg" className="mb-2 shadow-md transform scale-110 sm:scale-125 transition-transform" />
                <span className="font-bold text-text text-sm sm:text-base line-clamp-2 leading-tight w-full truncate">{primeiro.nome}</span>
                <span className="text-[var(--color-ranking-gold)] text-xs sm:text-sm font-extrabold">{primeiro.pontuacaoTotal} pts</span>
              </div>
              <div className="w-full h-full bg-[var(--color-ranking-gold-bg)] border-2 border-[var(--color-ranking-gold)] rounded-t-[var(--radius-lg)] shadow-md relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
              </div>
            </>
          ) : (
             <div className="w-full h-full bg-bg-inset border-2 border-border border-dashed rounded-t-[var(--radius-lg)] opacity-50" />
          )}
        </div>

        {/* 3º Lugar */}
        <div className="flex flex-col items-center justify-end w-1/3 max-w-[120px] h-[60%] relative">
          {terceiro ? (
            <>
              <div className="text-center mb-2 flex flex-col items-center w-full px-1">
                <RankingPosition position={3} size="md" className="mb-2 sm:hidden" />
                <RankingPosition position={3} size="lg" className="mb-2 hidden sm:flex" />
                <span className="font-bold text-text text-xs sm:text-sm line-clamp-2 leading-tight w-full truncate">{terceiro.nome}</span>
                <span className="text-[var(--color-ranking-bronze)] text-xs sm:text-sm font-extrabold">{terceiro.pontuacaoTotal} pts</span>
              </div>
              <div className="w-full h-full bg-[var(--color-ranking-bronze-bg)] border-2 border-[var(--color-ranking-bronze)] rounded-t-[var(--radius-lg)] shadow-sm relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent"></div>
              </div>
            </>
          ) : (
             <div className="w-full h-full bg-bg-inset border-2 border-border border-dashed rounded-t-[var(--radius-lg)] opacity-50" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Ranking"
        subtitle="Classificação atual dos atletas por modalidade."
        icon={Trophy}
        badge={<SportBadge modalidade={modalidade} size="md" />}
        actions={
          <SegmentedControl
            value={modalidade}
            onChange={(val) => setModalidade(val as Modalidade)}
            options={[
              { value: "corrida", label: "Corrida" },
              { value: "bicicleta", label: "Ciclismo" },
            ]}
          />
        }
      />

      {atletasAtuais === null ? (
        <div className="space-y-8">
          <div className="flex items-end justify-center gap-2 sm:gap-4 h-56 sm:h-64 px-2">
            <Skeleton className="w-1/3 max-w-[120px] h-[75%] rounded-t-[var(--radius-lg)] rounded-b-none" />
            <Skeleton className="w-1/3 max-w-[140px] h-full rounded-t-[var(--radius-lg)] rounded-b-none" />
            <Skeleton className="w-1/3 max-w-[120px] h-[60%] rounded-t-[var(--radius-lg)] rounded-b-none" />
          </div>
          <Card className="p-0">
            <div className="p-4 space-y-4">
              <SkeletonLine className="h-10" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-4 items-center">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <SkeletonLine />
                    <SkeletonLine className="w-1/2" />
                  </div>
                  <Skeleton className="w-16 h-8" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : atletasAtuais.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Sem ranking ainda"
          description="Assim que houver pontuação, o ranking aparecerá aqui."
        />
      ) : (
        <div className="flex flex-col">
          {!search.trim() && renderPodium()}

          <Card className="flex flex-col p-0 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border bg-bg/50">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="size-4 text-text-muted" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar atleta por nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 sm:py-2 border border-border rounded-[var(--radius)] bg-bg text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm sm:text-base transition-colors"
                />
              </div>
            </div>

            {filteredAtletas?.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Search}
                  title="Nenhum atleta encontrado"
                  description={`Ninguém com o nome "${search}" nesta modalidade.`}
                />
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {filteredAtletas?.map((a) => {
                  const isMe = a.id === myAtleta.id;
                  const isTop3 = a.rank <= 3;
                  
                  return (
                    <li
                      key={a.id}
                      className={cn(
                        "flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 transition-colors hover:bg-bg-inset",
                        isMe ? "bg-[var(--color-primary-subtle)] border-l-4 border-l-primary" : "border-l-4 border-l-transparent",
                      )}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <RankingPosition 
                          position={a.rank} 
                          size={isTop3 ? "md" : "sm"} 
                          className={cn(!isTop3 && "bg-bg text-text-muted")} 
                        />
                        
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className={cn("font-medium text-text truncate text-sm sm:text-base", isMe && "font-bold text-primary")}>
                            {a.nome} {isMe && <span className="text-xs font-normal opacity-80">(você)</span>}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end shrink-0 ml-2">
                        <span className="font-bold text-text text-sm sm:text-base">
                          {a.pontuacaoTotal} pts
                        </span>
                        <span className="text-[10px] sm:text-xs text-text-light font-medium mt-0.5">
                          {a.kmTotal?.toFixed(1) || "0.0"} km
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            
            {myRankAtleta && !search && (myRankAtleta.rank > 3) && (
              <div className="p-3 bg-bg-inset border-t border-border flex justify-center">
                <p className="text-xs sm:text-sm text-text-muted text-center">
                  Sua posição atual é <strong className="text-text">{myRankAtleta.rank}º lugar</strong> com {myRankAtleta.pontuacaoTotal} pontos.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
