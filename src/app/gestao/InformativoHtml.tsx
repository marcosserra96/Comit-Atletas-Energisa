"use client";

import type { ReactNode } from "react";
import { Bike, CalendarCheck2, Footprints, Medal, Route, Sparkles, Trophy, UsersRound } from "lucide-react";
import type { Modalidade } from "@/lib/types";
import type { ResumoAtletaMensal } from "@/lib/rankingMensal";

export type FormatoInformativo = "horizontal" | "vertical";

function numero(valor: number, casas = 0) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function dividir<T>(lista: T[], quantidade: number) {
  if (!lista.length) return [[]] as T[][];
  const tamanho = Math.ceil(lista.length / quantidade);
  return Array.from({ length: quantidade }, (_, i) => lista.slice(i * tamanho, (i + 1) * tamanho)).filter(
    (grupo) => grupo.length,
  );
}

function Kpi({
  rotulo,
  valor,
  icon,
  compacto,
}: {
  rotulo: string;
  valor: string;
  icon: ReactNode;
  compacto: boolean;
}) {
  return (
    <div className={`flex min-w-0 items-center rounded-2xl border border-[#DCEBF0] bg-white/90 shadow-[0_8px_30px_rgba(0,80,97,.06)] backdrop-blur-sm ${compacto ? "gap-2.5 px-3 py-2" : "gap-3 px-4 py-3"}`}>
      <div className={`flex shrink-0 items-center justify-center rounded-xl bg-[#009FC2]/10 text-[#009FC2] ${compacto ? "size-9" : "size-10"}`}>{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-[9px] font-bold uppercase tracking-[.12em] text-[#5E7E86]">{rotulo}</div>
        <div className={`truncate font-black leading-tight text-[#005061] ${compacto ? "text-lg" : "text-xl"}`}>{valor}</div>
      </div>
    </div>
  );
}

function Podio({ dados, compacto }: { dados: ResumoAtletaMensal[]; compacto?: boolean }) {
  const [primeiro, segundo, terceiro] = dados;
  const ordem = [
    { atleta: segundo, pos: 2, altura: compacto ? 82 : 112, tom: "bg-[#E9F2F5]" },
    { atleta: primeiro, pos: 1, altura: compacto ? 108 : 142, tom: "bg-gradient-to-b from-[#FFE5C8] to-[#FFF7EE]" },
    { atleta: terceiro, pos: 3, altura: compacto ? 70 : 96, tom: "bg-[#F3ECE7]" },
  ];

  return (
    <div className="flex h-full items-end justify-center gap-3">
      {ordem.map(({ atleta, pos, altura, tom }) => (
        <div key={pos} className="flex min-w-0 flex-1 flex-col items-center justify-end">
          <div className="mb-1.5 max-w-full text-center">
            <div className="truncate text-[11px] font-extrabold text-[#005061]">{atleta?.nome ?? "—"}</div>
            <div className="text-[10px] font-bold text-[#009FC2]">{atleta ? `${numero(atleta.pontosMes)} pts` : ""}</div>
          </div>
          <div
            className={`flex w-full max-w-[150px] items-start justify-center rounded-t-2xl border border-white/70 pt-2.5 shadow-[0_10px_28px_rgba(0,80,97,.08)] ${tom}`}
            style={{ height: altura }}
          >
            <span className={`font-black ${pos === 1 ? "text-2xl text-[#F37021]" : "text-xl text-[#005061]"}`}>{pos}º</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Ranking({ dados, formato }: { dados: ResumoAtletaMensal[]; formato: FormatoInformativo }) {
  const horizontal = formato === "horizontal";
  const qtdColunas = horizontal ? (dados.length > 24 ? 3 : 2) : 1;
  const colunas = dividir(dados, qtdColunas);

  return (
    <div className={`grid ${horizontal ? "gap-2" : "gap-3"} ${qtdColunas === 3 ? "grid-cols-3" : qtdColunas === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {colunas.map((grupo, indiceColuna) => {
        const inicio = colunas.slice(0, indiceColuna).reduce((soma, coluna) => soma + coluna.length, 0);
        return (
          <div key={indiceColuna} className="overflow-hidden rounded-xl border border-[#DCEBF0] bg-white/[.92]">
            <div className={`grid grid-cols-[32px_minmax(0,1fr)_62px_54px_64px] gap-1.5 bg-[#F1F8FA] px-2.5 font-bold uppercase tracking-wide text-[#6E8990] ${horizontal ? "py-1 text-[8px]" : "py-2 text-[9px]"}`}>
              <span>#</span><span>Atleta</span><span className="text-right">Pontos</span><span className="text-right">Treinos</span><span className="text-right">Km</span>
            </div>
            {grupo.map((a, i) => {
              const posicao = inicio + i + 1;
              return (
                <div
                  key={a.id}
                  className={`grid grid-cols-[32px_minmax(0,1fr)_62px_54px_64px] items-center gap-1.5 border-t border-[#E7F0F3] px-2.5 text-[#315E68] ${horizontal ? "py-[3px] text-[9px] leading-[13px]" : "py-[7px] text-[11px]"}`}
                >
                  <span className={`font-black ${posicao <= 3 ? "text-[#F37021]" : "text-[#007E9B]"}`}>{posicao}</span>
                  <span className="truncate font-semibold text-[#005061]">{a.nome}</span>
                  <span className="text-right font-bold">{numero(a.pontosMes)}</span>
                  <span className="text-right">{numero(a.treinosMes)}</span>
                  <span className="text-right">{numero(a.kmMes, 1)}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function InformativoHtml({
  dados,
  periodoLabel,
  modalidade,
  formato,
}: {
  dados: ResumoAtletaMensal[];
  periodoLabel: string;
  modalidade: Modalidade;
  formato: FormatoInformativo;
}) {
  const totalPontos = dados.reduce((s, a) => s + a.pontosMes, 0);
  const totalTreinos = dados.reduce((s, a) => s + a.treinosMes, 0);
  const totalKm = dados.reduce((s, a) => s + a.kmMes, 0);
  const maiorKm = [...dados].sort((a, b) => b.kmMes - a.kmMes)[0];
  const maisTreinos = [...dados].sort((a, b) => b.treinosMes - a.treinosMes)[0];
  const horizontal = formato === "horizontal";
  const nomeModalidade = modalidade === "corrida" ? "Corrida" : "Bicicleta";
  const fundo = `/informativo-novo/bg-${modalidade === "corrida" ? "corrida" : "bike"}-${formato}.svg`;
  const ModalidadeIcon = modalidade === "corrida" ? Footprints : Bike;

  return (
    <article
      id="novo-informativo-preview"
      className="relative isolate overflow-hidden bg-[#F7FBFC] text-[#005061] shadow-[0_24px_70px_rgba(0,80,97,.16)]"
      style={{
        width: horizontal ? 1200 : 560,
        height: horizontal ? 675 : undefined,
        minHeight: horizontal ? undefined : Math.max(996, 820 + dados.length * 38),
        backgroundImage: `url(${fundo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: horizontal ? 28 : 30,
      }}
    >
      <div className={horizontal ? "p-5" : "p-6"}>
        <header className={`flex items-start justify-between ${horizontal ? "mb-3" : "mb-4"}`}>
          <div className={`flex items-start ${horizontal ? "gap-4" : "gap-5"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/logo-comite-colorida.png" alt="Atletas Energisa" className={horizontal ? "h-[48px] w-auto object-contain" : "h-[52px] w-auto object-contain"} />
            {horizontal && <div className="mt-1 h-10 w-px bg-[#BCD9E0]" />}
            <div>
              <div className="mb-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-[.18em] text-[#009FC2]">
                <ModalidadeIcon className="size-3.5" />
                Ranking {nomeModalidade}
              </div>
              <h1 className={`${horizontal ? "text-[28px]" : "text-[28px]"} font-black leading-none tracking-tight text-[#005061]`}>{periodoLabel}</h1>
            </div>
          </div>
          <div className="hidden max-w-[190px] pt-1 text-right text-[10px] font-semibold leading-relaxed text-[#527680] sm:block">
            Movimento que inspira.<br />Resultados que conectam.
            <div className="ml-auto mt-1.5 h-1 w-9 rounded-full bg-[#F37021]" />
          </div>
        </header>

        <section className={`grid ${horizontal ? "grid-cols-4 gap-2.5" : "grid-cols-2 gap-3"}`}>
          <Kpi compacto={horizontal} rotulo="Pontos" valor={numero(totalPontos)} icon={<Trophy className="size-5" />} />
          <Kpi compacto={horizontal} rotulo="Treinos" valor={numero(totalTreinos)} icon={<CalendarCheck2 className="size-5" />} />
          <Kpi compacto={horizontal} rotulo="Distância" valor={`${numero(totalKm, 1)} km`} icon={<Route className="size-5" />} />
          <Kpi compacto={horizontal} rotulo="Atletas" valor={numero(dados.length)} icon={<UsersRound className="size-5" />} />
        </section>

        <section className={`${horizontal ? "mt-3 grid grid-cols-[1.08fr_.92fr] gap-3" : "mt-4 flex flex-col gap-4"}`}>
          <div className={`rounded-2xl border border-[#DCEBF0] bg-white/[.88] shadow-[0_10px_34px_rgba(0,80,97,.06)] backdrop-blur-sm ${horizontal ? "p-3" : "p-5"}`}>
            <div className={`flex items-center gap-2 ${horizontal ? "mb-1.5" : "mb-3"}`}>
              <Medal className="size-4 text-[#F37021]" />
              <h2 className="text-[10px] font-black uppercase tracking-[.12em] text-[#005061]">Pódio do período</h2>
            </div>
            <div className={horizontal ? "h-[126px]" : "h-[180px]"}>
              <Podio dados={dados.slice(0, 3)} compacto={horizontal} />
            </div>
          </div>

          <div className={`rounded-2xl border border-[#DCEBF0] bg-white/[.88] shadow-[0_10px_34px_rgba(0,80,97,.06)] backdrop-blur-sm ${horizontal ? "p-3" : "p-5"}`}>
            <div className={`flex items-center gap-2 ${horizontal ? "mb-2" : "mb-4"}`}>
              <Sparkles className="size-4 text-[#F37021]" />
              <h2 className="text-[10px] font-black uppercase tracking-[.12em] text-[#005061]">Destaques</h2>
            </div>
            <div className={`grid ${horizontal ? "grid-cols-2 gap-2" : "grid-cols-1 gap-3"}`}>
              <div className={`rounded-xl bg-[#F2F9FB] ${horizontal ? "p-2.5" : "p-4"}`}>
                <div className="mb-1 flex items-center gap-2 text-[#009FC2]"><Route className="size-4" /><span className="text-[8px] font-bold uppercase tracking-wide">Maior distância</span></div>
                <div className="truncate text-[11px] font-black text-[#005061]">{maiorKm?.nome ?? "—"}</div>
                <div className={`${horizontal ? "text-sm" : "text-lg"} font-black text-[#009FC2]`}>{maiorKm ? `${numero(maiorKm.kmMes, 1)} km` : "—"}</div>
              </div>
              <div className={`rounded-xl bg-[#F2F9FB] ${horizontal ? "p-2.5" : "p-4"}`}>
                <div className="mb-1 flex items-center gap-2 text-[#009FC2]"><CalendarCheck2 className="size-4" /><span className="text-[8px] font-bold uppercase tracking-wide">Mais treinos</span></div>
                <div className="truncate text-[11px] font-black text-[#005061]">{maisTreinos?.nome ?? "—"}</div>
                <div className={`${horizontal ? "text-sm" : "text-lg"} font-black text-[#009FC2]`}>{maisTreinos ? `${numero(maisTreinos.treinosMes)} treinos` : "—"}</div>
              </div>
            </div>
            <div className={`rounded-xl border border-[#F37021]/[.15] bg-[#FFF8F1] font-semibold leading-relaxed text-[#6C625D] ${horizontal ? "mt-2 px-3 py-2 text-[9px]" : "mt-3 px-4 py-3 text-xs"}`}>
              Cada treino soma. Cada quilômetro movimenta o time.
            </div>
          </div>
        </section>

        <section className={`rounded-2xl border border-[#DCEBF0] bg-white/[.82] shadow-[0_10px_34px_rgba(0,80,97,.05)] backdrop-blur-sm ${horizontal ? "mt-3 p-3" : "mt-4 p-4"}`}>
          <div className={`flex items-center justify-between gap-4 ${horizontal ? "mb-2" : "mb-3"}`}>
            <div>
              <div className="text-[8px] font-black uppercase tracking-[.16em] text-[#009FC2]">Classificação</div>
              <h2 className={`${horizontal ? "text-sm" : "text-lg"} font-black text-[#005061]`}>Ranking completo · {nomeModalidade}</h2>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#009FC2]/[.08] px-3 py-1 text-[9px] font-black uppercase tracking-wide text-[#007E9B]">
              <ModalidadeIcon className="size-3.5" /> {dados.length} atletas
            </div>
          </div>
          <Ranking dados={dados} formato={formato} />
        </section>

        <footer className={`flex items-center justify-between px-1 font-semibold text-[#6B8990] ${horizontal ? "mt-2 text-[8px]" : "mt-4 text-[10px]"}`}>
          <span>Atletas Energisa · Saúde hoje. Mais energia amanhã.</span>
          <span className="flex items-center gap-1.5"><ModalidadeIcon className="size-3.5 text-[#009FC2]" /> Juntos vamos mais longe.</span>
        </footer>
      </div>
    </article>
  );
}
