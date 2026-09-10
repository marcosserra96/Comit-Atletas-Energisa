"use client";

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
}: {
  rotulo: string;
  valor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#DCEBF0] bg-white/90 px-4 py-3 shadow-[0_8px_30px_rgba(0,80,97,.06)] backdrop-blur-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#009FC2]/10 text-[#009FC2]">{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-[10px] font-bold uppercase tracking-[.12em] text-[#5E7E86]">{rotulo}</div>
        <div className="truncate text-xl font-black leading-tight text-[#005061]">{valor}</div>
      </div>
    </div>
  );
}

function Podio({ dados, compacto }: { dados: ResumoAtletaMensal[]; compacto?: boolean }) {
  const [primeiro, segundo, terceiro] = dados;
  const ordem = [
    { atleta: segundo, pos: 2, altura: compacto ? 112 : 132, tom: "bg-[#E9F2F5]" },
    { atleta: primeiro, pos: 1, altura: compacto ? 142 : 168, tom: "bg-gradient-to-b from-[#FFE5C8] to-[#FFF7EE]" },
    { atleta: terceiro, pos: 3, altura: compacto ? 96 : 116, tom: "bg-[#F3ECE7]" },
  ];

  return (
    <div className="flex h-full items-end justify-center gap-3">
      {ordem.map(({ atleta, pos, altura, tom }) => (
        <div key={pos} className="flex min-w-0 flex-1 flex-col items-center justify-end">
          <div className="mb-2 max-w-full text-center">
            <div className="truncate text-xs font-extrabold text-[#005061]">{atleta?.nome ?? "—"}</div>
            <div className="text-[11px] font-bold text-[#009FC2]">{atleta ? `${numero(atleta.pontosMes)} pts` : ""}</div>
          </div>
          <div
            className={`flex w-full max-w-[150px] items-start justify-center rounded-t-2xl border border-white/70 pt-3 shadow-[0_10px_28px_rgba(0,80,97,.08)] ${tom}`}
            style={{ height: altura }}
          >
            <span className={`font-black ${pos === 1 ? "text-3xl text-[#F37021]" : "text-2xl text-[#005061]"}`}>{pos}º</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Ranking({ dados, formato }: { dados: ResumoAtletaMensal[]; formato: FormatoInformativo }) {
  const qtdColunas = formato === "vertical" ? 1 : dados.length > 24 ? 3 : 2;
  const colunas = dividir(dados, qtdColunas);
  let offset = 0;

  return (
    <div className={`grid gap-3 ${qtdColunas === 3 ? "grid-cols-3" : qtdColunas === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {colunas.map((grupo, indiceColuna) => {
        const inicio = offset;
        offset += grupo.length;
        return (
          <div key={indiceColuna} className="overflow-hidden rounded-2xl border border-[#DCEBF0] bg-white/92">
            <div className="grid grid-cols-[38px_minmax(0,1fr)_70px_64px_72px] gap-2 bg-[#F1F8FA] px-3 py-2 text-[9px] font-bold uppercase tracking-wide text-[#6E8990]">
              <span>#</span><span>Atleta</span><span className="text-right">Pontos</span><span className="text-right">Treinos</span><span className="text-right">Km</span>
            </div>
            {grupo.map((a, i) => {
              const posicao = inicio + i + 1;
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[38px_minmax(0,1fr)_70px_64px_72px] items-center gap-2 border-t border-[#E7F0F3] px-3 py-[7px] text-[11px] text-[#315E68]"
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
        minHeight: horizontal ? 675 : Math.max(996, 820 + dados.length * 38),
        backgroundImage: `url(${fundo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: horizontal ? 28 : 30,
      }}
    >
      <div className={horizontal ? "p-8" : "p-6"}>
        <header className={`flex items-start justify-between ${horizontal ? "mb-5" : "mb-4"}`}>
          <div className="flex items-start gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/logo-comite-colorida.png" alt="Atletas Energisa" className={horizontal ? "h-[62px] w-auto object-contain" : "h-[52px] w-auto object-contain"} />
            {horizontal && <div className="mt-1 h-12 w-px bg-[#BCD9E0]" />}
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#009FC2]">
                <ModalidadeIcon className="size-4" />
                Ranking {nomeModalidade}
              </div>
              <h1 className={`${horizontal ? "text-[34px]" : "text-[28px]"} font-black leading-none tracking-tight text-[#005061]`}>{periodoLabel}</h1>
            </div>
          </div>
          <div className="hidden max-w-[200px] pt-1 text-right text-xs font-semibold leading-relaxed text-[#527680] sm:block">
            Movimento que inspira.<br />Resultados que conectam.
            <div className="ml-auto mt-2 h-1 w-10 rounded-full bg-[#F37021]" />
          </div>
        </header>

        <section className={`grid ${horizontal ? "grid-cols-4 gap-3" : "grid-cols-2 gap-3"}`}>
          <Kpi rotulo="Pontos" valor={numero(totalPontos)} icon={<Trophy className="size-5" />} />
          <Kpi rotulo="Treinos" valor={numero(totalTreinos)} icon={<CalendarCheck2 className="size-5" />} />
          <Kpi rotulo="Distância" valor={`${numero(totalKm, 1)} km`} icon={<Route className="size-5" />} />
          <Kpi rotulo="Atletas" valor={numero(dados.length)} icon={<UsersRound className="size-5" />} />
        </section>

        <section className={`${horizontal ? "mt-4 grid grid-cols-[1.1fr_.9fr] gap-4" : "mt-4 flex flex-col gap-4"}`}>
          <div className="rounded-3xl border border-[#DCEBF0] bg-white/88 p-5 shadow-[0_10px_34px_rgba(0,80,97,.06)] backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2">
              <Medal className="size-4 text-[#F37021]" />
              <h2 className="text-xs font-black uppercase tracking-[.12em] text-[#005061]">Pódio do período</h2>
            </div>
            <div className={horizontal ? "h-[205px]" : "h-[180px]"}>
              <Podio dados={dados.slice(0, 3)} compacto={!horizontal} />
            </div>
          </div>

          <div className="rounded-3xl border border-[#DCEBF0] bg-white/88 p-5 shadow-[0_10px_34px_rgba(0,80,97,.06)] backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="size-4 text-[#F37021]" />
              <h2 className="text-xs font-black uppercase tracking-[.12em] text-[#005061]">Destaques</h2>
            </div>
            <div className={`grid ${horizontal ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
              <div className="rounded-2xl bg-[#F2F9FB] p-4">
                <div className="mb-2 flex items-center gap-2 text-[#009FC2]"><Route className="size-5" /><span className="text-[10px] font-bold uppercase tracking-wide">Maior distância</span></div>
                <div className="truncate text-sm font-black text-[#005061]">{maiorKm?.nome ?? "—"}</div>
                <div className="text-lg font-black text-[#009FC2]">{maiorKm ? `${numero(maiorKm.kmMes, 1)} km` : "—"}</div>
              </div>
              <div className="rounded-2xl bg-[#F2F9FB] p-4">
                <div className="mb-2 flex items-center gap-2 text-[#009FC2]"><CalendarCheck2 className="size-5" /><span className="text-[10px] font-bold uppercase tracking-wide">Mais treinos</span></div>
                <div className="truncate text-sm font-black text-[#005061]">{maisTreinos?.nome ?? "—"}</div>
                <div className="text-lg font-black text-[#009FC2]">{maisTreinos ? `${numero(maisTreinos.treinosMes)} treinos` : "—"}</div>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-[#F37021]/15 bg-[#FFF8F1] px-4 py-3 text-xs font-semibold leading-relaxed text-[#6C625D]">
              Cada treino soma. Cada quilômetro movimenta o time.
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-[#DCEBF0] bg-white/82 p-4 shadow-[0_10px_34px_rgba(0,80,97,.05)] backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.16em] text-[#009FC2]">Classificação</div>
              <h2 className="text-lg font-black text-[#005061]">Ranking completo · {nomeModalidade}</h2>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#009FC2]/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#007E9B]">
              <ModalidadeIcon className="size-3.5" /> {dados.length} atletas
            </div>
          </div>
          <Ranking dados={dados} formato={formato} />
        </section>

        <footer className="mt-4 flex items-center justify-between px-1 text-[10px] font-semibold text-[#6B8990]">
          <span>Atletas Energisa · Saúde hoje. Mais energia amanhã.</span>
          <span className="flex items-center gap-1.5"><ModalidadeIcon className="size-3.5 text-[#009FC2]" /> Juntos vamos mais longe.</span>
        </footer>
      </div>
    </article>
  );
}
