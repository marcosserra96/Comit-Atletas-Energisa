"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bike, CalendarDays, ChevronLeft, ChevronRight, Footprints, Medal, Trophy, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { RequireRole } from "@/components/session/RequireRole";
import { getStoredBranding, loginBackground } from "@/lib/branding";
import { normalizarInformativoConfig } from "@/lib/informativoConfig";
import { atletaEstaEmAlerta, calcularResumoRankingMensal, ordenarRankingMensal, type ResumoAtletaMensal } from "@/lib/rankingMensal";
import { formatShortDate } from "@/lib/format";
import type { AtletaDoc, BrandingDoc, EventoDoc, HistoricoPontoDoc, InformativoConfigDoc } from "@/lib/types";

const MEDAL_COR = ["#facc15", "#cbd5e1", "#d97706"];

function formatarNumero(valor: number, casas = 0) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function useDadosApresentacao() {
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [config, setConfig] = useState<InformativoConfigDoc | null>(null);

  useEffect(() => {
    const unsubAtletas = onSnapshot(collection(db, "atletas"), (snap) => {
      setAtletas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc));
    });
    getDocs(collection(db, "historico_pontos")).then((snap) => {
      setLancamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoricoPontoDoc));
    });
    const isoHoje = new Date().toISOString().slice(0, 10);
    const unsubEventos = onSnapshot(
      query(collection(db, "agenda_eventos"), where("data", ">=", isoHoje), orderBy("data", "asc")),
      (snap) => setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc)),
    );
    getDoc(doc(db, "configuracoes", "informativo")).then((snap) => {
      setConfig(normalizarInformativoConfig(snap.exists() ? (snap.data() as Partial<InformativoConfigDoc>) : undefined));
    });
    return () => {
      unsubAtletas();
      unsubEventos();
    };
  }, []);

  return { atletas, lancamentos, eventos, config };
}

function KpiTile({ label, value, cor }: { label: string; value: string; cor: string }) {
  return (
    <div
      className="rounded-3xl border p-6 backdrop-blur-md"
      style={{ background: "rgba(255,255,255,.07)", borderColor: "rgba(255,255,255,.14)" }}
    >
      <span className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: cor }}>
        {label}
      </span>
      <strong className="mt-2.5 block text-[42px] font-extrabold leading-none text-white">{value}</strong>
    </div>
  );
}

function SlideHero({
  mesLabel,
  totalPontos,
  totalTreinos,
  totalKm,
  totalAlertas,
  branding,
}: {
  mesLabel: string;
  totalPontos: number;
  totalTreinos: number;
  totalKm: number;
  totalAlertas: number;
  branding: BrandingDoc;
}) {
  return (
    <div className="flex h-full flex-col justify-center px-16 py-12 lg:px-24">
      <div className="mb-10 flex items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo estático, sem necessidade de otimização do next/image em tela cheia dinâmica */}
        <img src="/logos/logo-comite-branca-trim.png" alt="Atletas Energisa" className="h-14 w-auto object-contain" />
        <span className="text-sm font-extrabold uppercase tracking-[0.2em] text-white/60">
          Modo apresentação
        </span>
      </div>
      <h1 className="text-6xl font-extrabold leading-[1.05] text-white lg:text-7xl">Resumo do mês</h1>
      <p className="mt-3 text-2xl text-white/70">{mesLabel} · Comitê Atletas Energisa</p>

      <div className="mt-12 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <KpiTile label="Pontos" value={formatarNumero(totalPontos)} cor={branding.primary} />
        <KpiTile label="Treinos" value={formatarNumero(totalTreinos)} cor={branding.secondary} />
        <KpiTile label="KM" value={formatarNumero(totalKm, 1)} cor={branding.primary} />
        <KpiTile label="Alertas" value={formatarNumero(totalAlertas)} cor={branding.accent} />
      </div>
    </div>
  );
}

function Top3Card({ titulo, icon: Icon, lista }: { titulo: string; icon: typeof Bike; lista: ResumoAtletaMensal[] }) {
  return (
    <div
      className="rounded-3xl border p-8"
      style={{ background: "rgba(255,255,255,.07)", borderColor: "rgba(255,255,255,.14)" }}
    >
      <h3 className="mb-6 flex items-center gap-3 text-3xl font-bold text-white">
        <Icon className="size-8" style={{ color: "var(--color-primary)" }} />
        {titulo}
      </h3>
      {lista.length === 0 ? (
        <p className="text-lg text-white/50">Sem dados neste mês.</p>
      ) : (
        <div className="flex flex-col">
          {lista.slice(0, 3).map((a, i) => (
            <div key={a.id} className="flex items-center gap-3.5 border-b border-white/10 py-3.5 text-xl last:border-0">
              <Medal className="size-6 shrink-0" style={{ color: MEDAL_COR[i] }} />
              <strong className="min-w-0 flex-1 truncate text-white">{a.nome}</strong>
              <em className="font-extrabold not-italic" style={{ color: "var(--color-primary)" }}>
                {formatarNumero(a.pontosMes)} pts
              </em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlideTop3({ bike, corrida }: { bike: ResumoAtletaMensal[]; corrida: ResumoAtletaMensal[] }) {
  return (
    <div className="flex h-full flex-col justify-center px-16 py-12 lg:px-24">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Top3Card titulo="Top 3 Bike" icon={Bike} lista={bike} />
        <Top3Card titulo="Top 3 Corrida" icon={Footprints} lista={corrida} />
      </div>
    </div>
  );
}

function SlideAlertas({ alertas }: { alertas: ResumoAtletaMensal[] }) {
  return (
    <div className="flex h-full flex-col justify-center px-16 py-12 lg:px-24">
      <div
        className="rounded-3xl border p-8"
        style={{ background: "rgba(255,255,255,.07)", borderColor: "rgba(255,255,255,.14)" }}
      >
        <h3 className="mb-6 flex items-center gap-3 text-3xl font-bold text-white">
          <AlertTriangle className="size-8" style={{ color: "var(--color-accent)" }} />
          Atletas em alerta
        </h3>
        {alertas.length === 0 ? (
          <p className="text-lg text-white/50">Nenhum atleta em alerta pelo critério atual.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {alertas.slice(0, 20).map((a) => (
              <div
                key={a.id}
                className="truncate rounded-2xl border px-4 py-3 text-lg font-bold"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 14%, transparent)",
                  borderColor: "color-mix(in srgb, var(--color-accent) 35%, transparent)",
                  color: "var(--color-accent)",
                }}
              >
                {a.nome} · {formatarNumero(a.treinosMes)} treino{a.treinosMes === 1 ? "" : "s"}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SlideEventos({ eventos }: { eventos: EventoDoc[] }) {
  return (
    <div className="flex h-full flex-col justify-center px-16 py-12 lg:px-24">
      <div
        className="rounded-3xl border p-8"
        style={{ background: "rgba(255,255,255,.07)", borderColor: "rgba(255,255,255,.14)" }}
      >
        <h3 className="mb-6 flex items-center gap-3 text-3xl font-bold text-white">
          <CalendarDays className="size-8" style={{ color: "var(--color-primary)" }} />
          Próximos eventos
        </h3>
        {eventos.length === 0 ? (
          <p className="text-lg text-white/50">Nenhum evento cadastrado.</p>
        ) : (
          eventos.slice(0, 5).map((e) => (
            <div key={e.id} className="border-b border-white/10 py-4 text-xl last:border-0">
              <strong className="text-white">{e.titulo}</strong>
              <br />
              <span className="text-white/60">
                {formatShortDate(e.data)} · {e.local || "Local não informado"}
              </span>
            </div>
          ))
        )}
        <p className="mt-6 text-sm text-white/40">Use as setas do teclado ou espaço para avançar · Esc para sair.</p>
      </div>
    </div>
  );
}

function ApresentacaoContent() {
  const router = useRouter();
  const { atletas, lancamentos, eventos, config } = useDadosApresentacao();
  const [branding] = useState<BrandingDoc>(() => getStoredBranding());
  const [slide, setSlide] = useState(0);
  const [direcao, setDirecao] = useState(1);

  const carregando = atletas === null || lancamentos === null || eventos === null || config === null;

  const dados = useMemo(() => {
    if (carregando) return null;
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    const mesLabel = hoje
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      .replace(/^./, (c) => c.toUpperCase());

    const resumo = calcularResumoRankingMensal({ atletas: atletas!, lancamentos: lancamentos!, ano, mes });
    const bike = resumo.filter((a) => a.equipe === "bicicleta").sort(ordenarRankingMensal);
    const corrida = resumo.filter((a) => a.equipe === "corrida").sort(ordenarRankingMensal);
    const todos = [...bike, ...corrida];
    const alertas = todos.filter((a) => atletaEstaEmAlerta(a, config!.alertaCriterio, config!.alertaValor));

    return {
      mesLabel,
      bike,
      corrida,
      alertas,
      totalPontos: todos.reduce((s, a) => s + a.pontosMes, 0),
      totalKm: todos.reduce((s, a) => s + a.kmMes, 0),
      totalTreinos: todos.reduce((s, a) => s + a.treinosMes, 0),
    };
  }, [carregando, atletas, lancamentos, config]);

  const totalSlides = 4;

  const irPara = useCallback(
    (proximo: number) => {
      const alvo = Math.max(0, Math.min(totalSlides - 1, proximo));
      setDirecao(alvo > slide ? 1 : -1);
      setSlide(alvo);
    },
    [slide],
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) {
        e.preventDefault();
        irPara(slide + 1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        irPara(slide - 1);
      } else if (e.key === "Escape") {
        router.push("/gestao");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [slide, irPara, router]);

  const variantes = {
    entra: (dir: number) => ({ opacity: 0, x: dir * 48 }),
    centro: { opacity: 1, x: 0 },
    sai: (dir: number) => ({ opacity: 0, x: dir * -48 }),
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden text-white"
      style={{ background: `radial-gradient(circle at 12% 8%, ${branding.primary}33, transparent 42%), ${loginBackground(branding)}` }}
    >
      <button
        onClick={() => router.push("/gestao")}
        aria-label="Sair do modo apresentação"
        className="fixed right-6 top-6 z-10 flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
      >
        <X className="size-5" />
      </button>

      {slide > 0 && (
        <button
          onClick={() => irPara(slide - 1)}
          aria-label="Slide anterior"
          className="fixed left-4 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {slide < totalSlides - 1 && (
        <button
          onClick={() => irPara(slide + 1)}
          aria-label="Próximo slide"
          className="fixed right-4 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
        >
          <ChevronRight className="size-5" />
        </button>
      )}

      <div className="fixed bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2.5">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            onClick={() => irPara(i)}
            aria-label={`Ir para slide ${i + 1}`}
            className="h-2 rounded-full transition-all"
            style={{
              width: i === slide ? 28 : 8,
              background: i === slide ? "#fff" : "rgba(255,255,255,.3)",
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait" custom={direcao}>
        {carregando || !dados ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full items-center justify-center"
          >
            <Trophy className="size-10 animate-pulse text-white/40" />
          </motion.div>
        ) : (
          <motion.div
            key={slide}
            custom={direcao}
            variants={variantes}
            initial="entra"
            animate="centro"
            exit="sai"
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="h-full"
          >
            {slide === 0 && (
              <SlideHero
                mesLabel={dados.mesLabel}
                totalPontos={dados.totalPontos}
                totalTreinos={dados.totalTreinos}
                totalKm={dados.totalKm}
                totalAlertas={dados.alertas.length}
                branding={branding}
              />
            )}
            {slide === 1 && <SlideTop3 bike={dados.bike} corrida={dados.corrida} />}
            {slide === 2 && <SlideAlertas alertas={dados.alertas} />}
            {slide === 3 && <SlideEventos eventos={eventos ?? []} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ApresentacaoPage() {
  return (
    <RequireRole roles={["administrador"]}>
      <ApresentacaoContent />
    </RequireRole>
  );
}
