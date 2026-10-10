"use client";

import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import { forwardRef } from "react";
import { iniciais } from "@/lib/fotoRegras";
import { formatDistancia, formatPontos } from "@/lib/format";
import { Pista, Roda } from "@/components/informativo/ArteInformativo";
import type { MedalhaDoAtleta } from "@/lib/conquistas";
import type { Modalidade } from "@/lib/types";
import { Medalha } from "./Medalha";

export const CARTAO_L = 1080;
export const CARTAO_A = 1920;

const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const TEXTO = "'Barlow', 'Helvetica Neue', Arial, sans-serif";

export interface DadosCartaoDoMes {
  nome: string;
  foto?: string;
  modalidade: Modalidade;
  mes: string;
  ano: string;
  treinos: number;
  km: number;
  pontos: number;
  semanas: number;
  posicaoTrimestre: number | null;
  medalhas: MedalhaDoAtleta[];
  cor: string;
}

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 200, lineHeight: 0.88, letterSpacing: "-0.01em", color: "#fff" }}>{valor}</div>
      <div style={{ marginTop: 14, fontFamily: TEXTO, fontWeight: 600, fontSize: 38, color: "rgba(255,255,255,0.66)" }}>{rotulo}</div>
    </div>
  );
}

/**
 * Story 1080 × 1920 do atleta: o mês em letras grandes, foto, os três números,
 * a sequência e as medalhas. Estilos inline para a imagem sair igual em
 * qualquer aparelho.
 */
export const CartaoDoMes = forwardRef<HTMLDivElement, { dados: DadosCartaoDoMes }>(function CartaoDoMes({ dados }, ref) {
  const { cor } = dados;
  const nomeTam = dados.nome.length > 22 ? 58 : 72;
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: CARTAO_L,
        height: CARTAO_A,
        overflow: "hidden",
        background: `radial-gradient(ellipse at 90% 6%, ${cor}55 0%, transparent 52%), linear-gradient(165deg, #0a2140 0%, #061426 62%)`,
        color: "#fff",
        fontFamily: TEXTO,
      }}
    >
      {dados.modalidade === "corrida" ? (
        <Pista cor={cor} estilo={{ width: 1600, right: -820, top: -420 }} />
      ) : (
        <Roda cor={cor} estilo={{ width: 1080, right: -520, top: -460 }} />
      )}

      <div style={{ position: "absolute", left: 88, right: 88, top: 96, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo-comite-branca-trim.png" alt="" style={{ height: 104 }} />
        <span style={{ padding: "12px 26px", borderRadius: 999, border: `3px solid ${cor}`, fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, color: "#fff" }}>
          {dados.modalidade === "corrida" ? "Corrida" : "Bike"}
        </span>
      </div>

      {/* O mês é o título da peça. */}
      <div style={{ position: "absolute", left: 80, top: 300 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 230, lineHeight: 0.84, letterSpacing: "-0.02em", textTransform: "uppercase" }}>{dados.mes}</div>
        <div style={{ marginTop: 18, fontFamily: DISPLAY, fontWeight: 700, fontSize: 72, color: cor }}>{dados.ano}</div>
      </div>

      <div style={{ position: "absolute", left: 88, right: 88, top: 720, display: "flex", alignItems: "center", gap: 40 }}>
        <div
          style={{
            width: 220,
            height: 220,
            flexShrink: 0,
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: `0 0 0 10px ${cor}, 0 24px 60px rgba(0,0,0,0.45)`,
            background: "linear-gradient(160deg, #1462c4, #0b2c5f)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: 96,
          }}
        >
          {dados.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dados.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            iniciais(dados.nome)
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: nomeTam, lineHeight: 1 }}>{dados.nome}</div>
          {dados.posicaoTrimestre ? (
            <div style={{ marginTop: 16, fontSize: 38, fontWeight: 600, color: "rgba(255,255,255,0.74)" }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, color: "#f5c542" }}>{dados.posicaoTrimestre}º</span> no ranking do trimestre
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ position: "absolute", left: 88, right: 88, top: 1040, display: "flex", gap: 32, paddingBottom: 56, borderBottom: "2px solid rgba(255,255,255,0.12)" }}>
        <Numero valor={String(dados.treinos)} rotulo={dados.treinos === 1 ? "treino" : "treinos"} />
        <Numero valor={formatDistancia(Math.round(dados.km))} rotulo="km" />
        <Numero valor={formatPontos(dados.pontos)} rotulo={dados.pontos === 1 ? "ponto" : "pontos"} />
      </div>

      {dados.semanas > 0 ? (
        <div style={{ position: "absolute", left: 88, right: 88, top: 1400, display: "flex", alignItems: "center", gap: 26 }}>
          <svg width="84" height="84" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2c1.5 3.6 5.5 5.8 5.5 11a5.5 5.5 0 0 1-11 0c0-2.4 1.1-4 2.3-5.4.3 1.6 1.2 2.7 2.4 3.1C10.6 7.6 11 4.6 12 2Z"
              fill="#f37021"
            />
          </svg>
          <div style={{ fontSize: 46, fontWeight: 700 }}>
            <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 84 }}>{dados.semanas}</span>{" "}
            {dados.semanas === 1 ? "semana treinando" : "semanas seguidas treinando"}
          </div>
        </div>
      ) : null}

      {dados.medalhas.length ? (
        <div style={{ position: "absolute", left: 88, right: 88, top: 1570, display: "flex", gap: 36 }}>
          {dados.medalhas.slice(0, 3).map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0, flex: 1 }}>
              <Medalha icone={m.icone} nivel={m.nivel} conquistada tamanho={128} />
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 34, lineHeight: 1.05 }}>{m.titulo}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ position: "absolute", left: 88, right: 88, bottom: 86, fontSize: 32, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
        Programa Atletas Energisa
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 14, background: `linear-gradient(90deg, #0b2c5f, ${cor} 55%, #f37021)` }} />
    </div>
  );
});
