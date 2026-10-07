"use client";

import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow/800.css";
import "@fontsource/barlow/900.css";
import type { CSSProperties, ReactNode } from "react";
import { iniciais } from "@/lib/fotoRegras";
import { formatDistancia, formatPontos } from "@/lib/format";
import { modalidadeLabel } from "@/lib/labels";
import type { FundoDivisoria, LinhaResultado, SlideDef } from "@/lib/reuniaoResultados";

/** Tamanho nativo de cada slide; a tela escala para caber. */
export const SLIDE_L = 1920;
export const SLIDE_A = 1080;

const F = "'Barlow', 'Helvetica Neue', Arial, sans-serif";
const COR = {
  navy: "#0b2c5f",
  navyEscuro: "#071d40",
  azul: "#1462c4",
  azulClaro: "#e8f1fc",
  laranja: "#f37021",
  laranjaEscuro: "#d9530a",
  verde: "#2fa84f",
  cinza: "#5b6b80",
  ouro: "#e7a913",
  prata: "#9aa9bc",
  bronze: "#c56a2b",
  branco: "#ffffff",
};

const FUNDO: Record<FundoDivisoria | "capa" | "conteudo" | "claro" | "app", string> = {
  capa: "/reuniao/fundo-capa.webp",
  divisoria: "/reuniao/fundo-divisoria.webp",
  resultados: "/reuniao/fundo-resultados.webp",
  premiacao: "/reuniao/fundo-premiacao.webp",
  agenda: "/reuniao/fundo-agenda.webp",
  conteudo: "/reuniao/fundo-conteudo.webp",
  claro: "/reuniao/fundo-claro.webp",
  app: "/reuniao/fundo-app.webp",
};

/** Texto laranja em degradê, como "Registre sua" e "Premiação". */
const laranja: CSSProperties = {
  background: `linear-gradient(180deg, #ff9a3c 0%, ${COR.laranja} 55%, ${COR.laranjaEscuro} 100%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};
/** Título azul-marinho com contorno claro (legível sobre o céu do fundo). */
const marinho: CSSProperties = { color: COR.navy, textShadow: "0 3px 0 rgba(255,255,255,.75), 0 10px 30px rgba(7,29,64,.18)" };

function Base({ fundo, children }: { fundo: keyof typeof FUNDO; children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        width: SLIDE_L,
        height: SLIDE_A,
        overflow: "hidden",
        fontFamily: F,
        backgroundColor: "#dfeaf7",
        backgroundImage: `url(${FUNDO[fundo]})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {children}
    </div>
  );
}

function LogoCanto({ claro = false }: { claro?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/reuniao/logo-atletas.webp"
      alt=""
      style={{ position: "absolute", right: 48, bottom: 36, width: 190, filter: claro ? "none" : "drop-shadow(0 2px 6px rgba(0,0,0,.15))" }}
    />
  );
}

/** Título dos slides de conteúdo: barra no alto à esquerda, como na apresentação. */
function TituloConteudo({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 128, display: "flex", alignItems: "flex-end", padding: "0 72px 18px" }}>
      <h2 style={{ margin: 0, fontSize: 56, fontWeight: 900, letterSpacing: "0.02em", textTransform: "uppercase", color: COR.navy }}>{children}</h2>
      {extra ? <div style={{ marginLeft: "auto", fontSize: 26, fontWeight: 700, color: COR.cinza }}>{extra}</div> : null}
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 0, height: 5, borderRadius: 3, background: `linear-gradient(90deg, ${COR.azul}, ${COR.azul} 70%, rgba(20,98,196,0))` }} />
    </div>
  );
}

function Avatar({ nome, foto, tamanho, anel }: { nome: string; foto?: string; tamanho: number; anel?: string }) {
  return (
    <div
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        background: foto ? "#fff" : `linear-gradient(160deg, ${COR.azul}, ${COR.navy})`,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        fontSize: tamanho * 0.36,
        boxShadow: anel ? `0 0 0 ${Math.round(tamanho * 0.06)}px ${anel}, 0 18px 40px rgba(7,29,64,.35)` : "0 10px 24px rgba(7,29,64,.25)",
      }}
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        iniciais(nome)
      )}
    </div>
  );
}

const formatarDataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// ---------------- slides ----------------

function Capa({ ano, meses }: { ano: string; meses: string }) {
  return (
    <Base fundo="capa">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/reuniao/logo-atletas.webp" alt="" style={{ position: "absolute", right: 56, top: 40, width: 230 }} />
      <div style={{ position: "absolute", left: 980, top: 250, width: 860, textAlign: "center" }}>
        <div style={{ fontSize: 176, fontWeight: 900, lineHeight: 0.95, color: "#fff", textShadow: "0 8px 30px rgba(0,0,0,.35)" }}>Resultados</div>
        <div
          style={{
            fontSize: 196,
            fontWeight: 900,
            lineHeight: 0.95,
            background: "linear-gradient(180deg, #8fd0ff 0%, #2f8df0 60%, #1462c4 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {ano}
        </div>
        <div style={{ marginTop: 18, fontSize: 52, fontWeight: 600, color: "rgba(255,255,255,.92)" }}>{meses}</div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/reuniao/logo-energisa.webp" alt="" style={{ position: "absolute", right: 56, bottom: 44, width: 190, opacity: 0.95 }} />
    </Base>
  );
}

function Divisoria({ sobretitulo, titulo, subtitulo, fundo }: { sobretitulo: string; titulo: string; subtitulo: string; fundo: FundoDivisoria }) {
  const longo = titulo.length > 16;
  return (
    <Base fundo={fundo}>
      <div style={{ position: "absolute", left: 760, right: 70, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        {sobretitulo ? <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1, ...laranja }}>{sobretitulo}</div> : null}
        <div style={{ fontSize: longo ? 112 : 150, fontWeight: 900, lineHeight: 1.02, ...marinho }}>{titulo}</div>
        {subtitulo ? <div style={{ marginTop: 18, fontSize: 46, fontWeight: 700, color: COR.navy, whiteSpace: "pre-line" }}>{subtitulo}</div> : null}
      </div>
      <LogoCanto />
    </Base>
  );
}

function Presenca({ evento, pontos, qr, semPermissao }: { evento: { titulo: string; horario: string } | null; pontos: number | null; qr: string | null; semPermissao: boolean }) {
  return (
    <Base fundo="divisoria">
      <div style={{ position: "absolute", left: 700, right: 60, top: 70, textAlign: "center" }}>
        <div style={{ fontSize: 104, fontWeight: 900, lineHeight: 1, ...laranja }}>Registre sua</div>
        <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 1, ...marinho }}>Presença</div>
      </div>
      <div style={{ position: "absolute", left: 900, top: 350, width: 540, height: 540, borderRadius: 40, background: "#fff", boxShadow: "0 30px 60px rgba(7,29,64,.28)", display: "flex", alignItems: "center", justifyContent: "center", border: `10px solid ${COR.azul}` }}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="" style={{ width: 480, height: 480 }} />
        ) : (
          <div style={{ padding: 40, textAlign: "center", fontSize: 34, fontWeight: 700, color: COR.cinza, lineHeight: 1.25 }}>
            {evento
              ? semPermissao
                ? "Para mostrar o QR ao vivo, apresente com um acesso que tenha a permissão Eventos."
                : "Preparando o QR code…"
              : "Escolha a reunião da agenda para mostrar o QR code."}
          </div>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/reuniao/mao-celular.webp" alt="" style={{ position: "absolute", left: 1475, top: 470, width: 420 }} />
      {pontos ? (
        <div style={{ position: "absolute", left: 900, width: 540, top: 925, display: "flex", justifyContent: "center" }}>
          <span style={{ padding: "16px 48px", borderRadius: 999, background: `linear-gradient(180deg, #4cc46b, ${COR.verde})`, color: "#fff", fontSize: 46, fontWeight: 900, boxShadow: "0 12px 30px rgba(47,168,79,.45), inset 0 -4px 0 rgba(0,0,0,.15)" }}>
            Vale {formatPontos(pontos)} {pontos === 1 ? "ponto" : "pontos"} ★
          </span>
        </div>
      ) : null}
      {evento ? (
        <div style={{ position: "absolute", left: 60, bottom: 44, fontSize: 28, fontWeight: 700, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,.4)" }}>
          {evento.titulo} · {evento.horario}
        </div>
      ) : null}
      <LogoCanto />
    </Base>
  );
}

function Novos({ atletas, fotos, pagina, paginas }: { atletas: { id: string; nome: string; modalidade: "corrida" | "bicicleta" }[]; fotos: Record<string, string>; pagina: number; paginas: number }) {
  const colunas = atletas.length <= 4 ? atletas.length : atletas.length <= 8 ? 4 : 5;
  const card = colunas <= 4 ? 330 : 300;
  return (
    <Base fundo="conteudo">
      <TituloConteudo extra={paginas > 1 ? `${pagina}/${paginas}` : undefined}>Novos atletas</TituloConteudo>
      <div style={{ position: "absolute", left: 72, right: 72, top: 170, bottom: 130, display: "flex", flexWrap: "wrap", justifyContent: "center", alignContent: "center", gap: 36 }}>
        {atletas.map((a) => (
          <div key={a.id} style={{ width: card, borderRadius: 22, overflow: "hidden", background: "#fff", boxShadow: "0 18px 40px rgba(7,29,64,.18)", border: `4px solid ${COR.navy}` }}>
            <div style={{ height: card * 0.92, background: `linear-gradient(160deg, ${COR.azul}, ${COR.navy})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: card * 0.3, fontWeight: 900 }}>
              {fotos[a.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotos[a.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                iniciais(a.nome)
              )}
            </div>
            <div style={{ background: COR.navy, color: "#fff", padding: "14px 18px 16px" }}>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, letterSpacing: "0.12em", color: "#ffb37a" }}>{modalidadeLabel[a.modalidade].toUpperCase()}</div>
            </div>
          </div>
        ))}
      </div>
      <LogoCanto />
    </Base>
  );
}

function Conteudo({ titulo, texto, imagem }: { titulo: string; texto: string; imagem?: string }) {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const soImagem = !!imagem && linhas.length === 0;
  return (
    <Base fundo="conteudo">
      <TituloConteudo>{titulo}</TituloConteudo>
      {soImagem ? (
        <div style={{ position: "absolute", left: 72, right: 72, top: 170, bottom: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagem} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 24, boxShadow: "0 20px 50px rgba(7,29,64,.25)" }} />
        </div>
      ) : (
        <div style={{ position: "absolute", left: 72, right: 72, top: 180, bottom: 130, display: "flex", gap: 56, alignItems: "center" }}>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", flex: 1, display: "flex", flexDirection: "column", gap: 22 }}>
            {linhas.map((l, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 24, background: "#fff", borderRadius: 20, padding: "22px 30px", boxShadow: "0 10px 28px rgba(7,29,64,.12)" }}>
                <span style={{ flexShrink: 0, width: 58, height: 58, borderRadius: "50%", background: COR.azul, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900 }}>{i + 1}</span>
                <span style={{ fontSize: linhas.length > 6 ? 30 : 36, fontWeight: 700, color: COR.navy, lineHeight: 1.2 }}>{l}</span>
              </li>
            ))}
          </ol>
          {imagem ? (
            <div style={{ width: 720, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagem} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 24, boxShadow: "0 20px 50px rgba(7,29,64,.25)" }} />
            </div>
          ) : null}
        </div>
      )}
      <LogoCanto />
    </Base>
  );
}

const SITUACAO = {
  fechado: { texto: "Fechado", cor: COR.verde },
  andamento: { texto: "Em andamento", cor: COR.laranja },
  proximo: { texto: "Próximo", cor: COR.azul },
} as const;

function Regras({ regras, periodos }: Extract<SlideDef, { tipo: "regras" }>) {
  return (
    <Base fundo="conteudo">
      <TituloConteudo>Regras do programa</TituloConteudo>
      <div style={{ position: "absolute", left: 72, right: 72, top: 175, bottom: 120, display: "flex", gap: 40 }}>
        <div style={{ flex: 1, alignSelf: "flex-start", background: "#fff", borderRadius: 28, border: `5px solid ${COR.azul}`, padding: "28px 36px", boxShadow: "0 18px 40px rgba(7,29,64,.14)" }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: COR.navy, marginBottom: 18 }}>Regras para pontuação</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {regras.length === 0 ? <div style={{ fontSize: 30, color: COR.cinza }}>Nenhum critério cadastrado.</div> : null}
            {regras.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, borderBottom: i < regras.length - 1 ? "2px solid #e3ebf5" : "none", paddingBottom: 14 }}>
                <span style={{ flex: 1, fontSize: regras.length > 6 ? 30 : 34, fontWeight: 700, color: COR.navy, lineHeight: 1.2 }}>
                  {r.descricao}
                  {r.modalidade !== "ambas" ? <span style={{ color: COR.cinza, fontWeight: 600 }}> · {modalidadeLabel[r.modalidade]}</span> : null}
                </span>
                <span style={{ flexShrink: 0, minWidth: 170, textAlign: "center", padding: "10px 22px", borderRadius: 14, background: `linear-gradient(180deg, #ff8a2b, ${COR.laranja})`, color: "#fff", fontSize: 32, fontWeight: 900 }}>
                  {formatPontos(r.pontos)} {r.pontos === 1 ? "ponto" : "pontos"}
                </span>
              </div>
            ))}
          </div>
        </div>
        {periodos.length > 0 ? (
          <div style={{ width: 520, background: "#fff", borderRadius: 28, border: `5px solid ${COR.azul}`, padding: "28px 32px", boxShadow: "0 18px 40px rgba(7,29,64,.14)", alignSelf: "flex-start" }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: COR.navy, marginBottom: 18 }}>Períodos de apuração</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {periodos.map((p) => (
                <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color: COR.navy }}>{p.nome}</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: COR.cinza }}>{p.intervalo}</div>
                  </div>
                  <span style={{ padding: "8px 16px", borderRadius: 10, background: SITUACAO[p.situacao].cor, color: "#fff", fontSize: 22, fontWeight: 800 }}>{SITUACAO[p.situacao].texto}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <LogoCanto />
    </Base>
  );
}

function Tile({ valor, rotulo, destaque = true }: { valor: string; rotulo: string; destaque?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 24,
        padding: "22px 20px",
        textAlign: "center",
        background: destaque ? `linear-gradient(180deg, #ff8a2b, ${COR.laranja})` : "#fff",
        color: destaque ? "#fff" : COR.navy,
        boxShadow: destaque ? "0 14px 30px rgba(243,112,33,.35)" : "0 14px 30px rgba(7,29,64,.14)",
        border: destaque ? "none" : "3px solid #dbe6f3",
      }}
    >
      <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1 }}>{valor}</div>
      <div style={{ marginTop: 8, fontSize: 26, fontWeight: 700, opacity: destaque ? 0.95 : 0.8 }}>{rotulo}</div>
    </div>
  );
}

function Totais({ corrida, bicicleta, titulo }: Extract<SlideDef, { tipo: "totais" }>) {
  const linha = (nome: string, t: typeof corrida) => (
    <div style={{ display: "flex", gap: 28, alignItems: "stretch" }}>
      <div style={{ width: 210, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 80, fontWeight: 900, color: COR.navy, lineHeight: 1 }}>{t.atletas}</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: COR.azul }}>{nome}</div>
      </div>
      <Tile valor={formatPontos(t.treinos)} rotulo="Treinos realizados" />
      <Tile valor={formatPontos(t.pontos)} rotulo="Pontos" />
      <Tile valor={formatPontos(Math.round(t.km))} rotulo="Km percorridos" />
      <Tile valor={formatDistancia(Math.round(t.kmPorTreino * 100) / 100)} rotulo="km em média por treino" destaque={false} />
    </div>
  );
  return (
    <Base fundo="conteudo">
      <TituloConteudo>{titulo}</TituloConteudo>
      <div style={{ position: "absolute", left: 72, right: 72, top: 190, display: "flex", gap: 44 }}>
        <div style={{ width: 330, background: "#fff", borderRadius: 28, border: `5px solid ${COR.azul}`, padding: "36px 28px", textAlign: "center", boxShadow: "0 18px 40px rgba(7,29,64,.14)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 132, fontWeight: 900, color: COR.navy, lineHeight: 1 }}>{corrida.atletas + bicicleta.atletas}</div>
          <div style={{ fontSize: 44, fontWeight: 900, color: COR.navy }}>atletas</div>
          <div style={{ marginTop: 20, fontSize: 30, fontWeight: 700, color: COR.cinza, lineHeight: 1.4 }}>
            {corrida.atletas} na corrida
            <br />
            {bicicleta.atletas} na bike
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 44, justifyContent: "center" }}>
          {linha("corrida", corrida)}
          {linha("bike", bicicleta)}
        </div>
      </div>
      <LogoCanto />
    </Base>
  );
}

const MEDALHA: Record<number, string> = { 1: COR.ouro, 2: COR.prata, 3: COR.bronze };

function Podio({ modalidade, podio, fotos }: Extract<SlideDef, { tipo: "podio" }> & { fotos: Record<string, string> }) {
  const ordem = [2, 1, 3].map((p) => podio.find((d) => d.posicao === p)).filter((d): d is NonNullable<typeof d> => !!d);
  const altura: Record<number, number> = { 1: 330, 2: 270, 3: 235 };
  const nome = modalidade === "corrida" ? "Corrida" : "Bike";
  return (
    <Base fundo="claro">
      <div style={{ position: "absolute", left: 72, top: 50 }}>
        <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1, ...laranja }}>Time de</div>
        <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1, ...marinho }}>{nome}</div>
      </div>
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 0, top: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 34 }}>
        {ordem.map((d) => {
          const cor = MEDALHA[d.posicao] ?? COR.bronze;
          const dupla = d.atletas.length > 1;
          const foto = dupla ? (d.posicao === 1 ? 230 : 200) : d.posicao === 1 ? 290 : 235;
          const fonteNome = dupla ? 25 : 30;
          const fonteDado = dupla ? 24 : 28;
          return (
            <div key={d.posicao} style={{ position: "relative", width: dupla ? 580 : d.posicao === 1 ? 480 : 410, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 28, marginBottom: 30 }}>
                {d.atletas.map((a) => (
                  <div key={a.id} style={{ position: "relative" }}>
                    <Avatar nome={a.nome} foto={fotos[a.id]} tamanho={foto} anel={cor} />
                    <span style={{ position: "absolute", left: "50%", bottom: -26, transform: "translateX(-50%)", width: 70, height: 70, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, #ffffff99, ${cor} 62%)`, border: "4px solid #fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 900, textShadow: "0 2px 3px rgba(0,0,0,.3)", boxShadow: "0 6px 14px rgba(0,0,0,.25)" }}>
                      {d.posicao}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  width: "100%",
                  minHeight: altura[d.posicao] ?? 235,
                  borderRadius: "22px 22px 0 0",
                  background: `linear-gradient(180deg, ${COR.navy}, ${COR.navyEscuro})`,
                  borderTop: `10px solid ${cor}`,
                  boxShadow: "0 -10px 30px rgba(7,29,64,.25)",
                  padding: "20px 20px 24px",
                  display: "flex",
                  gap: 18,
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                {d.atletas.map((a) => (
                  <div key={a.id} style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                    <div style={{ background: "#fff", color: COR.navy, borderRadius: 10, padding: "6px 10px", fontSize: fonteNome, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</div>
                    <div style={{ marginTop: 12, fontSize: fonteDado, fontWeight: 700, lineHeight: 1.4, textAlign: "left", display: "inline-block" }}>
                      <div><span style={{ color: cor }}>●</span> Pontos: <b>{formatPontos(a.pontos)}</b></div>
                      <div><span style={{ color: cor }}>●</span> Treinos: <b>{a.treinos}</b></div>
                      <div><span style={{ color: cor }}>●</span> Km: <b>{formatDistancia(Math.round(a.km * 100) / 100)}</b></div>
                    </div>
                  </div>
                ))}
              </div>
              {d.total > d.atletas.length ? (
                <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, textAlign: "center", fontSize: 22, fontWeight: 700, color: "#ffffffcc" }}>e mais {d.total - d.atletas.length} empatados</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Base>
  );
}

function Classificacao({ modalidade, colunas, pagina, paginas, temNovos }: Extract<SlideDef, { tipo: "classificacao" }>) {
  const nome = modalidade === "corrida" ? "Corrida" : "Bike";
  const linhasMax = Math.max(...colunas.map((c) => c.length));
  const alturaLinha = Math.min(66, Math.floor(800 / (linhasMax + 1)));
  const fonte = Math.min(30, Math.round(alturaLinha * 0.52));
  const corPos = (l: LinhaResultado) => (l.posicao === 1 ? COR.ouro : l.posicao === 2 ? COR.prata : l.posicao === 3 ? COR.bronze : undefined);
  return (
    <Base fundo="conteudo">
      <TituloConteudo extra={paginas > 1 ? `${pagina}/${paginas}` : undefined}>Resultados equipe de {nome}</TituloConteudo>
      <div style={{ position: "absolute", left: 60, right: 60, top: 165, display: "flex", gap: 26 }}>
        {colunas.map((coluna, ci) => (
          <div key={ci} style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 12px 30px rgba(7,29,64,.12)", border: "2px solid #dbe6f3" }}>
            <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 64px 64px 84px", background: COR.navy, color: "#fff", fontSize: 18, fontWeight: 800, letterSpacing: "0.06em", height: alturaLinha, alignItems: "center", padding: "0 12px" }}>
              <span>POS</span>
              <span>ATLETA</span>
              <span style={{ textAlign: "right" }}>PTS</span>
              <span style={{ textAlign: "right" }}>TR.</span>
              <span style={{ textAlign: "right" }}>KM</span>
            </div>
            {coluna.map((l, i) => (
              <div
                key={l.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 1fr 64px 64px 84px",
                  height: alturaLinha,
                  alignItems: "center",
                  padding: "0 12px",
                  fontSize: fonte,
                  color: COR.navy,
                  background: l.posicao <= 3 ? "#fff6e2" : i % 2 ? "#f4f8fd" : "#fff",
                  borderTop: "1px solid #e6edf6",
                }}
              >
                <span style={{ fontWeight: 900, color: corPos(l) ?? COR.cinza }}>{l.posicao}º</span>
                <span style={{ fontWeight: l.posicao <= 3 ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l.novo ? <span style={{ color: COR.laranja }}>★ </span> : null}
                  {l.nome}
                </span>
                <span style={{ textAlign: "right", fontWeight: 900 }}>{formatPontos(l.pontos)}</span>
                <span style={{ textAlign: "right", fontWeight: 600 }}>{l.treinos}</span>
                <span style={{ textAlign: "right", fontWeight: 600 }}>{formatPontos(Math.round(l.km))}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {temNovos ? (
        <div style={{ position: "absolute", left: 72, bottom: 44, fontSize: 24, fontWeight: 700, color: COR.navy }}>
          <span style={{ color: COR.laranja }}>★</span> Novo atleta da {nome.toLowerCase()}
        </div>
      ) : null}
      <LogoCanto />
    </Base>
  );
}

function Agenda({ colunas }: Extract<SlideDef, { tipo: "agenda" }>) {
  const max = Math.max(...colunas.map((c) => c.eventos.length));
  const alt = Math.min(110, Math.floor(760 / Math.max(max, 1)) - 12);
  return (
    <Base fundo="conteudo">
      <TituloConteudo>Programação</TituloConteudo>
      <div style={{ position: "absolute", left: 72, right: 72, top: 170, display: "flex", gap: 36 }}>
        {colunas.map((c) => (
          <div key={c.titulo} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ background: COR.navy, color: "#fff", borderRadius: 14, padding: "14px 20px", fontSize: 30, fontWeight: 900, textAlign: "center", letterSpacing: "0.06em", textTransform: "uppercase" }}>{c.titulo}</div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {c.eventos.map((e) => (
                <div key={e.id} style={{ height: alt, display: "flex", alignItems: "center", gap: 18, background: "#fff", borderRadius: 14, padding: "0 18px", boxShadow: "0 8px 20px rgba(7,29,64,.10)", opacity: e.feito ? 0.75 : 1 }}>
                  <span style={{ flexShrink: 0, width: 108, textAlign: "center", padding: "8px 0", borderRadius: 10, background: COR.navy, color: "#fff", fontSize: 32, fontWeight: 900 }}>{formatarDataCurta(e.data)}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: 28, fontWeight: 800, color: COR.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.titulo}</span>
                    <span style={{ display: "block", fontSize: 22, fontWeight: 600, color: COR.cinza, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.local}</span>
                  </span>
                  {e.feito ? (
                    <span style={{ flexShrink: 0, width: 46, height: 46, borderRadius: "50%", background: COR.verde, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900 }}>✓</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <LogoCanto />
    </Base>
  );
}

function App({ qr, url }: { qr: string | null; url: string }) {
  return (
    <Base fundo="app">
      <div style={{ position: "absolute", left: 760, right: 60, top: 70, textAlign: "center" }}>
        <div style={{ fontSize: 104, fontWeight: 900, lineHeight: 1, ...laranja }}>Aplicativo</div>
        <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1.02, ...marinho }}>Atletas Energisa</div>
      </div>
      <div style={{ position: "absolute", left: 1010, top: 360, width: 460, height: 460, borderRadius: 36, background: "#fff", border: `10px solid ${COR.azul}`, boxShadow: "0 30px 60px rgba(7,29,64,.28)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt="" style={{ width: 410, height: 410 }} /> : null}
      </div>
      <div style={{ position: "absolute", left: 860, width: 770, top: 880, textAlign: "center", fontSize: 36, fontWeight: 800, color: COR.navy, textShadow: "0 2px 0 rgba(255,255,255,.7)" }}>{url}</div>
      <LogoCanto />
    </Base>
  );
}

function Obrigado() {
  return (
    <Base fundo="agenda">
      <div style={{ position: "absolute", left: 760, right: 60, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 140, fontWeight: 900, lineHeight: 1, ...laranja }}>Obrigado!</div>
        <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 1.02, ...marinho }}>BORA TREINAR!</div>
      </div>
      <LogoCanto />
    </Base>
  );
}

/** Um slide do roteiro, no tamanho nativo (1920×1080). */
export function SlideReuniao({
  slide,
  fotos,
  imagens,
  qrPresenca,
  presencaSemPermissao = false,
  qrApp,
  urlApp,
}: {
  slide: SlideDef;
  fotos: Record<string, string>;
  imagens: Record<string, string>;
  qrPresenca: string | null;
  presencaSemPermissao?: boolean;
  qrApp: string | null;
  urlApp: string;
}) {
  switch (slide.tipo) {
    case "capa":
      return <Capa ano={slide.ano} meses={slide.meses} />;
    case "presenca":
      return <Presenca evento={slide.evento} pontos={slide.pontos} qr={qrPresenca} semPermissao={presencaSemPermissao} />;
    case "divisoria":
      return <Divisoria sobretitulo={slide.sobretitulo} titulo={slide.titulo} subtitulo={slide.subtitulo} fundo={slide.fundo} />;
    case "novos":
      return <Novos atletas={slide.atletas} fotos={fotos} pagina={slide.pagina} paginas={slide.paginas} />;
    case "conteudo":
      return <Conteudo titulo={slide.titulo} texto={slide.texto} imagem={slide.imagemId ? imagens[slide.imagemId] : undefined} />;
    case "regras":
      return <Regras {...slide} />;
    case "totais":
      return <Totais {...slide} />;
    case "podio":
      return <Podio {...slide} fotos={fotos} />;
    case "classificacao":
      return <Classificacao {...slide} />;
    case "agenda":
      return <Agenda {...slide} />;
    case "app":
      return <App qr={qrApp} url={urlApp} />;
    case "obrigado":
      return <Obrigado />;
  }
}
