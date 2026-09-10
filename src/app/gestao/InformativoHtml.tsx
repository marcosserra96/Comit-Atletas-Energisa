"use client";

import type { ReactNode } from "react";
import {
  Bike,
  CalendarCheck2,
  Footprints,
  Medal,
  Route,
  Sparkles,
  Trophy,
  UsersRound,
} from "lucide-react";
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
  cor,
}: {
  rotulo: string;
  valor: string;
  icon: ReactNode;
  compacto: boolean;
  cor: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-center rounded-2xl border border-white/80 bg-white/[.94] shadow-[0_10px_30px_rgba(0,80,97,.10)] ${
        compacto ? "gap-2.5 px-3 py-2" : "gap-3 px-4 py-3"
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${compacto ? "size-9" : "size-10"}`}
        style={{ backgroundColor: cor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[9px] font-black uppercase tracking-[.12em] text-[#64818A]">{rotulo}</div>
        <div className={`truncate font-black leading-tight text-[#005061] ${compacto ? "text-lg" : "text-xl"}`}>
          {valor}
        </div>
      </div>
    </div>
  );
}

function Podio({ dados, compacto }: { dados: ResumoAtletaMensal[]; compacto?: boolean }) {
  const [primeiro, segundo, terceiro] = dados;
  const ordem = [
    { atleta: segundo, pos: 2, altura: compacto ? 80 : 108, fundo: "linear-gradient(180deg,#E8F0F3,#F7FBFC)" },
    { atleta: primeiro, pos: 1, altura: compacto ? 108 : 140, fundo: "linear-gradient(180deg,#FFD48A,#FFF4DE)" },
    { atleta: terceiro, pos: 3, altura: compacto ? 70 : 94, fundo: "linear-gradient(180deg,#F4C6A5,#FFF2E8)" },
  ];

  return (
    <div className="flex h-full items-end justify-center gap-3">
      {ordem.map(({ atleta, pos, altura, fundo }) => (
        <div key={pos} className="flex min-w-0 flex-1 flex-col items-center justify-end">
          <div className="mb-1.5 max-w-full text-center">
            <div className="truncate text-[11px] font-extrabold text-[#005061]">{atleta?.nome ?? "—"}</div>
            <div className="text-[10px] font-black text-[#009FC2]">{atleta ? `${numero(atleta.pontosMes)} pts` : ""}</div>
          </div>
          <div
            className="flex w-full max-w-[150px] items-start justify-center rounded-t-2xl border border-white/80 pt-2.5 shadow-[0_10px_28px_rgba(0,80,97,.10)]"
            style={{ height: altura, background: fundo }}
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
    <div
      className={`grid ${horizontal ? "gap-2" : "gap-3"} ${
        qtdColunas === 3 ? "grid-cols-3" : qtdColunas === 2 ? "grid-cols-2" : "grid-cols-1"
      }`}
    >
      {colunas.map((grupo, indiceColuna) => {
        const inicio = colunas.slice(0, indiceColuna).reduce((soma, coluna) => soma + coluna.length, 0);
        return (
          <div key={indiceColuna} className="overflow-hidden rounded-xl border border-[#D7E8ED] bg-white/[.96]">
            <div
              className={`grid grid-cols-[32px_minmax(0,1fr)_62px_54px_64px] gap-1.5 bg-[#EAF6F9] px-2.5 font-black uppercase tracking-wide text-[#66838B] ${
                horizontal ? "py-1 text-[8px]" : "py-2 text-[9px]"
              }`}
            >
              <span>#</span>
              <span>Atleta</span>
              <span className="text-right">Pontos</span>
              <span className="text-right">Treinos</span>
              <span className="text-right">Km</span>
            </div>
            {grupo.map((a, i) => {
              const posicao = inicio + i + 1;
              return (
                <div
                  key={a.id}
                  className={`grid grid-cols-[32px_minmax(0,1fr)_62px_54px_64px] items-center gap-1.5 border-t border-[#E7F0F3] px-2.5 text-[#315E68] ${
                    horizontal ? "py-[3px] text-[9px] leading-[13px]" : "py-[7px] text-[11px]"
                  }`}
                >
                  <span className={`font-black ${posicao <= 3 ? "text-[#F37021]" : "text-[#007E9B]"}`}>{posicao}</span>
                  <span className="truncate font-semibold text-[#005061]">{a.nome}</span>
                  <span className="text-right font-black">{numero(a.pontosMes)}</span>
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
  const maiorPontuacao = dados[0];
  const horizontal = formato === "horizontal";
  const corrida = modalidade === "corrida";
  const nomeModalidade = corrida ? "Corrida" : "Bicicleta";
  const ModalidadeIcon = corrida ? Footprints : Bike;
  const fundo = `/informativo-novo/bg-${corrida ? "corrida" : "bike"}-${formato}.svg`;
  const hero = `/informativo-novo/hero-${corrida ? "corrida" : "bike"}.svg`;
  const corPrincipal = corrida ? "#F37021" : "#009FC2";
  const corSecundaria = corrida ? "#009FC2" : "#005061";
  const alturaVertical = Math.max(1120, 865 + dados.length * 38);

  return (
    <article
      id="novo-informativo-preview"
      className="relative isolate overflow-hidden bg-[#F4FAFB] text-[#005061] shadow-[0_24px_70px_rgba(0,80,97,.16)]"
      style={{
        width: horizontal ? 1200 : 560,
        height: horizontal ? 675 : undefined,
        minHeight: horizontal ? undefined : alturaVertical,
        backgroundImage: `url(${fundo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: horizontal ? 28 : 30,
      }}
    >
      <section
        className={`relative overflow-hidden ${horizontal ? "h-[168px]" : "h-[265px]"}`}
        style={{
          background: horizontal
            ? `linear-gradient(112deg, #FFFFFF 0%, #FFFFFF 36%, ${corrida ? "#E7F8FC" : "#EAF8FA"} 64%, #DDF4F8 100%)`
            : `linear-gradient(165deg, #FFFFFF 0%, #F3FBFC 54%, ${corrida ? "#FFF0E5" : "#E7F7FA"} 100%)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero}
          alt=""
          aria-hidden="true"
          className={`absolute object-cover ${horizontal ? "right-0 top-0 h-full w-[58%]" : "bottom-0 right-0 h-[66%] w-full"}`}
          style={{ objectPosition: corrida ? "72% center" : "76% center" }}
        />
        <div
          className={`absolute inset-y-0 left-0 ${horizontal ? "w-[58%]" : "w-full"}`}
          style={{
            background: horizontal
              ? "linear-gradient(90deg,#FFFFFF 0%,#FFFFFF 72%,rgba(255,255,255,.82) 86%,rgba(255,255,255,0) 100%)"
              : "linear-gradient(180deg,#FFFFFF 0%,rgba(255,255,255,.96) 46%,rgba(255,255,255,.30) 100%)",
          }}
        />

        <div className="relative z-10 px-6 pt-5">
          <div className={`flex items-start ${horizontal ? "gap-4" : "justify-between gap-3"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/logo-comite-colorida.png"
              alt="Atletas Energisa"
              className={horizontal ? "h-[48px] w-auto object-contain" : "h-[50px] w-auto object-contain"}
            />
            {horizontal && <div className="mt-1 h-10 w-px bg-[#BDD9E0]" />}
            <div className={horizontal ? "pt-0.5" : "pt-1 text-right"}>
              <div
                className="mb-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.18em]"
                style={{ color: corPrincipal }}
              >
                <ModalidadeIcon className="size-3.5" /> Ranking {nomeModalidade}
              </div>
              <h1 className={`${horizontal ? "text-[30px]" : "text-[25px]"} font-black leading-none tracking-tight text-[#005061]`}>
                {periodoLabel}
              </h1>
            </div>
          </div>
          <div className={`${horizontal ? "mt-3 max-w-[410px]" : "mt-3 max-w-[280px]"}`}>
            <div className="text-[10px] font-bold leading-relaxed text-[#527680]">
              {corrida ? "Cada passo movimenta o time." : "Cada pedal movimenta o time."}
              <br />Juntos, vamos mais longe.
            </div>
            <div className="mt-2 h-1 w-10 rounded-full" style={{ backgroundColor: corPrincipal }} />
          </div>
        </div>
      </section>

      <div className={horizontal ? "px-5 pb-4" : "px-5 pb-5"}>
        <section className={`relative z-20 grid ${horizontal ? "-mt-5 grid-cols-4 gap-2.5" : "-mt-3 grid-cols-2 gap-3"}`}>
          <Kpi compacto={horizontal} rotulo="Pontos" valor={numero(totalPontos)} cor={corPrincipal} icon={<Trophy className="size-5" />} />
          <Kpi compacto={horizontal} rotulo="Treinos" valor={numero(totalTreinos)} cor={corSecundaria} icon={<CalendarCheck2 className="size-5" />} />
          <Kpi compacto={horizontal} rotulo="Distância" valor={`${numero(totalKm, 1)} km`} cor="#009FC2" icon={<Route className="size-5" />} />
          <Kpi compacto={horizontal} rotulo="Atletas" valor={numero(dados.length)} cor="#005061" icon={<UsersRound className="size-5" />} />
        </section>

        <section className={`${horizontal ? "mt-3 grid grid-cols-[1.02fr_.98fr] gap-3" : "mt-4 flex flex-col gap-4"}`}>
          <div className={`rounded-2xl border border-[#D8E9ED] bg-white/[.94] shadow-[0_10px_34px_rgba(0,80,97,.07)] ${horizontal ? "p-3" : "p-4"}`}>
            <div className={`flex items-center gap-2 ${horizontal ? "mb-1.5" : "mb-3"}`}>
              <div className="flex size-7 items-center justify-center rounded-lg text-white" style={{ backgroundColor: corPrincipal }}>
                <Medal className="size-4" />
              </div>
              <div>
                <div className="text-[8px] font-black uppercase tracking-[.15em] text-[#7A9399]">Destaque principal</div>
                <h2 className="text-[11px] font-black uppercase tracking-[.08em] text-[#005061]">Pódio do período</h2>
              </div>
            </div>
            <div className={horizontal ? "h-[122px]" : "h-[176px]"}>
              <Podio dados={dados.slice(0, 3)} compacto={horizontal} />
            </div>
          </div>

          <div className={`rounded-2xl border border-[#D8E9ED] bg-white/[.94] shadow-[0_10px_34px_rgba(0,80,97,.07)] ${horizontal ? "p-3" : "p-4"}`}>
            <div className={`flex items-center gap-2 ${horizontal ? "mb-2" : "mb-3"}`}>
              <Sparkles className="size-4" style={{ color: corPrincipal }} />
              <h2 className="text-[10px] font-black uppercase tracking-[.12em] text-[#005061]">Destaques</h2>
            </div>
            <div className={`grid ${horizontal ? "grid-cols-3 gap-2" : "grid-cols-1 gap-2.5"}`}>
              <div className="rounded-xl bg-[#F1F8FA] p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[#009FC2]">
                  <Trophy className="size-3.5" />
                  <span className="text-[8px] font-black uppercase tracking-wide">Mais pontos</span>
                </div>
                <div className="truncate text-[10px] font-black text-[#005061]">{maiorPontuacao?.nome ?? "—"}</div>
                <div className="text-sm font-black" style={{ color: corPrincipal }}>{maiorPontuacao ? `${numero(maiorPontuacao.pontosMes)} pts` : "—"}</div>
              </div>
              <div className="rounded-xl bg-[#F1F8FA] p-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-[#009FC2]">
                  <Route className="size-3.5" />
                  <span className="text-[8px] font-black uppercase tracking-wide">Maior distância</span>
                </div>
                <div className="truncate text-[10px] font-black text-[#005061]">{maiorKm?.nome ?? "—"}</div>
                <div className="text-sm font-black text-[#009FC2]">{maiorKm ? `${numero(maiorKm.kmMes, 1)} km` : "—"}</div>
              </div>
              <div className="rounded-xl bg-[#FFF7F0] p-2.5">
                <div className="mb-1 flex items-center gap-1.5" style={{ color: corPrincipal }}>
                  <CalendarCheck2 className="size-3.5" />
                  <span className="text-[8px] font-black uppercase tracking-wide">Mais treinos</span>
                </div>
                <div className="truncate text-[10px] font-black text-[#005061]">{maisTreinos?.nome ?? "—"}</div>
                <div className="text-sm font-black" style={{ color: corPrincipal }}>{maisTreinos ? `${numero(maisTreinos.treinosMes)} treinos` : "—"}</div>
              </div>
            </div>
            <div
              className={`rounded-xl border font-semibold leading-relaxed text-[#6C625D] ${horizontal ? "mt-2 px-3 py-2 text-[9px]" : "mt-3 px-3 py-2.5 text-[10px]"}`}
              style={{ borderColor: `${corPrincipal}26`, backgroundColor: corrida ? "#FFF8F1" : "#F2FBFC" }}
            >
              {corrida ? "Disciplina transforma passos em conquistas." : "Constância transforma quilômetros em conquistas."}
            </div>
          </div>
        </section>

        <section className={`rounded-2xl border border-[#D8E9ED] bg-white/[.94] shadow-[0_10px_34px_rgba(0,80,97,.06)] ${horizontal ? "mt-3 p-3" : "mt-4 p-4"}`}>
          <div className={`flex items-center justify-between gap-4 ${horizontal ? "mb-2" : "mb-3"}`}>
            <div>
              <div className="text-[8px] font-black uppercase tracking-[.16em]" style={{ color: corPrincipal }}>Classificação</div>
              <h2 className={`${horizontal ? "text-sm" : "text-lg"} font-black text-[#005061]`}>Ranking completo · {nomeModalidade}</h2>
            </div>
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wide"
              style={{ color: corSecundaria, backgroundColor: corrida ? "#FFF1E7" : "#EAF8FA" }}
            >
              <ModalidadeIcon className="size-3.5" /> {dados.length} atletas
            </div>
          </div>
          <Ranking dados={dados} formato={formato} />
        </section>

        <footer className={`flex items-center justify-between px-1 font-semibold text-[#6B8990] ${horizontal ? "mt-2 text-[8px]" : "mt-4 text-[10px]"}`}>
          <span>Atletas Energisa · Saúde hoje. Mais energia amanhã.</span>
          <span className="flex items-center gap-1.5">
            <ModalidadeIcon className="size-3.5" style={{ color: corPrincipal }} /> Juntos vamos mais longe.
          </span>
        </footer>
      </div>
    </article>
  );
}
