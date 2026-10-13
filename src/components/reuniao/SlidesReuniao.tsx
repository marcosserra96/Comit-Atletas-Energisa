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
      {extra ? (
        <div style={{ marginLeft: "auto", marginBottom: 6, padding: "10px 22px", borderRadius: 999, background: "#fff", border: "2px solid #d6e3f3", fontSize: 24, fontWeight: 700, color: COR.navy, whiteSpace: "nowrap" }}>
          {extra}
        </div>
      ) : null}
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

/** Km inteiro com milhar ("1.370"): o mesmo formato em pódio, tabela e totais. */
const kmInteiro = (km: number) => formatPontos(Math.round(km));

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
/** "Amanda Cristina de Almeida Prado" → "Amanda Prado"; nomes curtos ficam inteiros. */
export function nomeCurto(nome: string, limite = 22) {
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (limpo.length <= limite) return limpo;
  const partes = limpo.split(" ").filter((p) => !PARTICULAS.has(p.toLowerCase()));
  return partes.length >= 2 ? `${partes[0]} ${partes[partes.length - 1]}` : limpo;
}

const juntarExtra = (...partes: (string | undefined)[]) => partes.filter(Boolean).join("  ·  ") || undefined;

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

function Presenca({ evento, pontos, qr, semPermissao, presentes }: { evento: { titulo: string; horario: string } | null; pontos: number | null; qr: string | null; semPermissao: boolean; presentes?: number | null }) {
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
      {/* Ao vivo: sobe a cada presença registrada (só na apresentação, não no PDF). */}
      {typeof presentes === "number" ? (
        <div style={{ position: "absolute", left: 300, top: 640, width: 520, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 34px", borderRadius: 999, background: "rgba(255,255,255,.94)", boxShadow: "0 16px 40px rgba(7,29,64,.25)" }}>
            <span className="pulso-ao-vivo" style={{ width: 22, height: 22, borderRadius: "50%", background: COR.verde }} />
            <span key={presentes} className="numero-sobe" style={{ fontSize: 96, fontWeight: 900, color: COR.navy, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{presentes}</span>
            <span style={{ fontSize: 36, fontWeight: 800, color: COR.cinza }}>{presentes === 1 ? "presente" : "presentes"}</span>
          </div>
        </div>
      ) : null}
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
      <TituloConteudo extra={juntarExtra(`${atletas.length} ${atletas.length === 1 ? "atleta" : "atletas"}`, paginas > 1 ? `${pagina}/${paginas}` : undefined)}>Novos atletas</TituloConteudo>
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
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeCurto(a.nome, 18)}</div>
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
  // Texto para telão: grande quando há pouca coisa, menor só quando a lista é longa ou divide espaço com imagem.
  const fonte = linhas.length > 7 ? 30 : linhas.length > 5 || imagem ? 34 : 40;
  const selo = fonte >= 40 ? 64 : 54;
  return (
    <Base fundo="conteudo">
      <TituloConteudo>{titulo}</TituloConteudo>
      {soImagem ? (
        <div style={{ position: "absolute", left: 72, right: 72, top: 170, bottom: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagem} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 24, boxShadow: "0 20px 50px rgba(7,29,64,.25)" }} />
        </div>
      ) : (
        <div style={{ position: "absolute", left: 72, right: 72, top: 170, bottom: 130, display: "flex", gap: 56, alignItems: "center", justifyContent: "center" }}>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", flex: 1, maxWidth: imagem ? undefined : 1480, display: "flex", flexDirection: "column", gap: fonte >= 40 ? 26 : 18 }}>
            {linhas.map((l, i) => (
              <li
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 30, background: "#fff", borderRadius: 22, padding: fonte >= 40 ? "26px 40px 26px 28px" : "20px 32px 20px 24px", boxShadow: "0 12px 30px rgba(7,29,64,.12)", borderLeft: `8px solid ${COR.laranja}` }}
              >
                <span style={{ flexShrink: 0, width: selo, height: selo, borderRadius: "50%", background: `linear-gradient(160deg, ${COR.azul}, ${COR.navy})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: selo * 0.5, fontWeight: 900 }}>{i + 1}</span>
                <span style={{ fontSize: fonte, fontWeight: 700, color: COR.navy, lineHeight: 1.2 }}>{l}</span>
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

const cartao: CSSProperties = { background: "#fff", borderRadius: 28, border: `5px solid ${COR.azul}`, boxShadow: "0 18px 40px rgba(7,29,64,.14)" };

function Regras({ regras, periodos }: Extract<SlideDef, { tipo: "regras" }>) {
  const fonte = regras.length > 6 ? 30 : 36;
  return (
    <Base fundo="conteudo">
      <TituloConteudo>Regras do programa</TituloConteudo>
      <div style={{ position: "absolute", left: 72, right: 72, top: 128, bottom: 120, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 40, alignItems: "stretch" }}>
          <div style={{ ...cartao, flex: 1, padding: "36px 44px" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: COR.navy, paddingBottom: 18, borderBottom: `3px solid ${COR.azulClaro}` }}>Regras para pontuação</div>
            {regras.length === 0 ? <div style={{ marginTop: 24, fontSize: 30, color: COR.cinza }}>Nenhum critério cadastrado.</div> : null}
            {regras.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, minHeight: 100, borderTop: i > 0 ? "2px solid #e8eef6" : "none" }}>
                <span style={{ flex: 1, fontSize: fonte, fontWeight: 700, color: COR.navy, lineHeight: 1.2 }}>
                  {r.descricao}
                  {r.modalidade !== "ambas" ? <span style={{ color: COR.cinza, fontWeight: 600 }}> · {modalidadeLabel[r.modalidade]}</span> : null}
                </span>
                <span style={{ flexShrink: 0, width: 210, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, padding: "12px 0", borderRadius: 16, background: `linear-gradient(180deg, #ff8a2b, ${COR.laranja})`, color: "#fff", boxShadow: "0 8px 18px rgba(243,112,33,.3)" }}>
                  <span style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>{formatPontos(r.pontos)}</span>
                  <span style={{ fontSize: 24, fontWeight: 800 }}>{r.pontos === 1 ? "ponto" : "pontos"}</span>
                </span>
              </div>
            ))}
          </div>
          {periodos.length > 0 ? (
            <div style={{ ...cartao, width: 600, padding: "36px 40px" }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: COR.navy, paddingBottom: 18, borderBottom: `3px solid ${COR.azulClaro}` }}>Períodos de apuração</div>
              {periodos.map((p, i) => (
                <div key={p.nome} style={{ display: "flex", alignItems: "center", gap: 18, minHeight: 100, borderTop: i > 0 ? "2px solid #e8eef6" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: COR.navy, lineHeight: 1.15 }}>{p.nome}</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: COR.cinza }}>{p.intervalo}</div>
                  </div>
                  <span style={{ flexShrink: 0, width: 190, textAlign: "center", padding: "10px 0", borderRadius: 12, background: SITUACAO[p.situacao].cor, color: "#fff", fontSize: 22, fontWeight: 800, letterSpacing: "0.02em" }}>
                    {SITUACAO[p.situacao].texto}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <LogoCanto />
    </Base>
  );
}

function Metrica({ valor, unidade, rotulo, destaque = false }: { valor: string; unidade?: string; rotulo: string; destaque?: boolean }) {
  return (
    <div style={{ height: "100%", padding: "0 40px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: COR.cinza }}>{rotulo}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, color: destaque ? COR.laranja : COR.navy }}>
        <span style={{ fontSize: 92, fontWeight: 900, lineHeight: 0.95, letterSpacing: "-0.01em" }}>{valor}</span>
        {unidade ? <span style={{ fontSize: 34, fontWeight: 800 }}>{unidade}</span> : null}
      </div>
    </div>
  );
}

/** "▲ 12% vs 1º Trimestre" sob o número (verde sobe, vermelho cai). */
function Variacao({ atual, antes, nome }: { atual: number; antes: number; nome: string }) {
  if (!(antes > 0)) return null;
  const v = Math.round(((atual - antes) / antes) * 100);
  const cor = v > 0 ? COR.verde : v < 0 ? "#d63b3b" : COR.cinza;
  return (
    <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: COR.cinza, whiteSpace: "nowrap" }}>
      <span style={{ color: cor, fontWeight: 900 }}>
        {v > 0 ? "▲" : v < 0 ? "▼" : "="} {v === 0 ? "igual" : `${Math.abs(v)}%`}
      </span>{" "}
      vs {nome}
    </div>
  );
}

function Totais({ corrida, bicicleta, titulo, periodo, anterior }: Extract<SlideDef, { tipo: "totais" }>) {
  const geral = {
    atletas: corrida.atletas + bicicleta.atletas,
    treinos: corrida.treinos + bicicleta.treinos,
    pontos: corrida.pontos + bicicleta.pontos,
    km: corrida.km + bicicleta.km,
  };
  const linhaDivisoria = "2px solid #e8eef6";
  const equipe = (nome: string, t: typeof corrida) => (
    <div style={{ ...cartao, border: "none", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "26px 40px", background: `linear-gradient(180deg, ${COR.navy}, ${COR.navyEscuro})`, color: "#fff" }}>
        <span style={{ fontSize: 44, fontWeight: 900 }}>Time {nome}</span>
        <span style={{ marginLeft: "auto", fontSize: 30, fontWeight: 700, opacity: 0.9 }}>
          <b style={{ fontSize: 40, fontWeight: 900 }}>{t.atletas}</b> {t.atletas === 1 ? "atleta" : "atletas"}
        </span>
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
        <div style={{ borderRight: linhaDivisoria, borderBottom: linhaDivisoria }}>
          <Metrica rotulo="Treinos" valor={formatPontos(t.treinos)} />
        </div>
        <div style={{ borderBottom: linhaDivisoria }}>
          <Metrica rotulo="Pontos" valor={formatPontos(t.pontos)} destaque />
        </div>
        <div style={{ borderRight: linhaDivisoria }}>
          <Metrica rotulo="Distância" valor={kmInteiro(t.km)} unidade="km" />
        </div>
        <div>
          <Metrica rotulo="Média por treino" valor={formatDistancia(Math.round(t.kmPorTreino * 10) / 10)} unidade="km" />
        </div>
      </div>
    </div>
  );
  const resumo = [
    { valor: formatPontos(geral.atletas), rotulo: "atletas", atual: 0, antes: 0 },
    { valor: formatPontos(geral.treinos), rotulo: "treinos", atual: geral.treinos, antes: anterior?.treinos ?? 0 },
    { valor: formatPontos(geral.pontos), rotulo: "pontos", destaque: true, atual: geral.pontos, antes: anterior?.pontos ?? 0 },
    { valor: kmInteiro(geral.km), rotulo: "km", atual: geral.km, antes: anterior?.km ?? 0 },
  ];
  return (
    <Base fundo="conteudo">
      <TituloConteudo extra={periodo}>{titulo}</TituloConteudo>
      <div style={{ position: "absolute", left: 72, right: 72, top: 168, bottom: 130, display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Total do período: faixa neutra; o laranja fica reservado para pontos em todo o slide. */}
        <div style={{ display: "flex", alignItems: "stretch", borderRadius: 24, background: "#fff", border: "2px solid #dbe6f3", boxShadow: "0 14px 32px rgba(7,29,64,.12)" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "0 36px", borderRadius: "22px 0 0 22px", background: COR.azulClaro, fontSize: 24, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: COR.azul }}>No período</div>
          {resumo.map((r, i) => (
            <div key={r.rotulo} style={{ flex: 1, padding: "18px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderLeft: i > 0 ? "2px solid #e8eef6" : "none" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, color: r.destaque ? COR.laranja : COR.navy }}>
                <span style={{ fontSize: 66, fontWeight: 900, lineHeight: 1 }}>{r.valor}</span>
                <span style={{ fontSize: 26, fontWeight: 800, color: COR.cinza }}>{r.rotulo}</span>
              </div>
              {anterior ? <Variacao atual={r.atual} antes={r.antes} nome={anterior.nome} /> : null}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", gap: 36 }}>
          {equipe("Corrida", corrida)}
          {equipe("Bike", bicicleta)}
        </div>
      </div>
      <LogoCanto />
    </Base>
  );
}

const MEDALHA: Record<number, string> = { 1: COR.ouro, 2: COR.prata, 3: COR.bronze };
/** Versões mais claras das medalhas para texto sobre o azul-marinho (contraste no telão). */
const MEDALHA_TEXTO: Record<number, string> = { 1: "#f5bd2e", 2: "#d4dde8", 3: "#ef9a5e" };

function Podio({ modalidade, podio, fotos, periodo }: Extract<SlideDef, { tipo: "podio" }> & { fotos: Record<string, string> }) {
  const ordem = [2, 1, 3].map((p) => podio.find((d) => d.posicao === p)).filter((d): d is NonNullable<typeof d> => !!d);
  const nome = modalidade === "corrida" ? "Corrida" : "Bike";
  // Degraus baixos e cheios: o conteúdo ocupa o degrau, e a altura ainda mostra quem ganhou.
  const altura: Record<number, number> = { 1: 300, 2: 255, 3: 225 };
  return (
    <Base fundo="claro">
      <div style={{ position: "absolute", left: 72, top: 50 }}>
        <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1, ...laranja }}>Time de</div>
        <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1, ...marinho }}>{nome}</div>
        <div style={{ marginTop: 18, display: "inline-block", padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,.9)", border: "2px solid #d6e3f3", fontSize: 24, fontWeight: 700, color: COR.navy }}>{periodo}</div>
      </div>
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 0, top: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 28 }}>
        {ordem.map((d) => {
          const cor = MEDALHA[d.posicao] ?? COR.bronze;
          const dupla = d.atletas.length > 1;
          const primeiro = d.posicao === 1;
          const foto = dupla ? (primeiro ? 250 : 220) : primeiro ? 340 : 270;
          const largura = dupla ? (primeiro ? 640 : 580) : primeiro ? 540 : 440;
          const fontePontos = dupla ? 52 : primeiro ? 76 : 62;
          const fonteNome = dupla ? 28 : primeiro ? 38 : 32;
          return (
            <div key={d.posicao} style={{ position: "relative", flex: `0 1 ${largura}px`, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", gap: dupla ? 40 : 0, marginBottom: 40 }}>
                {d.atletas.map((a) => (
                  <div key={a.id} style={{ position: "relative" }}>
                    <Avatar nome={a.nome} foto={fotos[a.id]} tamanho={foto} anel={cor} />
                    <span style={{ position: "absolute", left: "50%", bottom: -30, transform: "translateX(-50%)", width: 76, height: 76, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, #ffffff99, ${cor} 62%)`, border: "5px solid #fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: 900, textShadow: "0 2px 3px rgba(0,0,0,.3)", boxShadow: "0 6px 14px rgba(0,0,0,.25)" }}>
                      {d.posicao}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  width: "100%",
                  height: altura[d.posicao] ?? 240,
                  borderRadius: "26px 26px 0 0",
                  background: `linear-gradient(180deg, ${COR.navy}, ${COR.navyEscuro})`,
                  borderTop: `12px solid ${cor}`,
                  boxShadow: "0 -10px 30px rgba(7,29,64,.25)",
                  padding: "26px 24px 0",
                  display: "flex",
                  gap: 24,
                  color: "#fff",
                }}
              >
                {d.atletas.map((a, i) => (
                  <div key={a.id} style={{ flex: 1, minWidth: 0, textAlign: "center", borderLeft: i > 0 ? "2px solid rgba(255,255,255,.14)" : "none", paddingLeft: i > 0 ? 24 : 0 }}>
                    <div style={{ fontSize: fonteNome, fontWeight: 900, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeCurto(a.nome, dupla ? 16 : 22)}</div>
                    {/* Pontos decidem a posição: são o número grande. Treinos e km vêm de apoio. */}
                    <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, color: MEDALHA_TEXTO[d.posicao] ?? cor }}>
                      <span style={{ fontSize: fontePontos, fontWeight: 900, lineHeight: 1 }}>{formatPontos(a.pontos)}</span>
                      <span style={{ fontSize: dupla ? 22 : 26, fontWeight: 800 }}>pontos</span>
                    </div>
                    <div style={{ marginTop: 14, fontSize: dupla ? 23 : 27, fontWeight: 700, color: "rgba(255,255,255,.8)", whiteSpace: "nowrap" }}>
                      {a.treinos} {a.treinos === 1 ? "treino" : "treinos"} · {kmInteiro(a.km)} km
                    </div>
                  </div>
                ))}
              </div>
              {d.total > d.atletas.length ? (
                <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", fontSize: 22, fontWeight: 700, color: "#ffffffcc" }}>e mais {d.total - d.atletas.length} empatados</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Base>
  );
}

function Classificacao({ modalidade, colunas, pagina, paginas, temNovos, periodo }: Extract<SlideDef, { tipo: "classificacao" }>) {
  const nome = modalidade === "corrida" ? "Corrida" : "Bike";
  const linhasMax = Math.max(...colunas.map((c) => c.length));
  const alturaLinha = Math.min(68, Math.floor(790 / (linhasMax + 1)));
  const estreita = colunas.length >= 3;
  const fonte = Math.min(estreita ? 28 : 30, Math.round(alturaLinha * 0.5));
  const grade = "68px minmax(0,1fr) 68px 92px 84px";
  const corPos = (l: LinhaResultado) => (l.posicao === 1 ? COR.ouro : l.posicao === 2 ? COR.prata : l.posicao === 3 ? COR.bronze : undefined);
  // Zero vira "–": a linha de quem não treinou não compete visualmente com as outras.
  const numero = (n: number, texto: string) => (n > 0 ? texto : <span style={{ color: "#b3c0d1" }}>–</span>);
  return (
    <Base fundo="conteudo">
      <TituloConteudo extra={juntarExtra(periodo, paginas > 1 ? `${pagina}/${paginas}` : undefined)}>Resultados equipe de {nome}</TituloConteudo>
      <div style={{ position: "absolute", left: 60, right: 60, top: 165, display: "flex", gap: 26, alignItems: "flex-start" }}>
        {colunas.map((coluna, ci) => (
          <div key={ci} style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 12px 30px rgba(7,29,64,.12)", border: "2px solid #dbe6f3" }}>
            <div style={{ display: "grid", gridTemplateColumns: grade, background: COR.navy, color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.06em", height: alturaLinha, alignItems: "center", padding: "0 16px" }}>
              <span>POS</span>
              <span>ATLETA</span>
              <span style={{ textAlign: "right" }}>PTS</span>
              <span style={{ textAlign: "right" }}>TREINOS</span>
              <span style={{ textAlign: "right" }}>KM</span>
            </div>
            {coluna.map((l, i) => {
              const medalha = corPos(l);
              return (
                <div
                  key={l.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: grade,
                    height: alturaLinha,
                    alignItems: "center",
                    padding: "0 16px",
                    fontSize: fonte,
                    fontVariantNumeric: "tabular-nums",
                    color: COR.navy,
                    background: medalha ? "#fff6e2" : i % 2 ? "#f5f8fc" : "#fff",
                    borderTop: "1px solid #e6edf6",
                    boxShadow: medalha ? `inset 6px 0 0 ${medalha}` : undefined,
                  }}
                >
                  <span style={{ fontWeight: 900, color: medalha ?? COR.cinza }}>{l.posicao}º</span>
                  <span style={{ fontWeight: medalha ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: estreita && nomeCurto(l.nome).length + (l.novo ? 2 : 0) > 15 ? Math.round(fonte * 0.86) : undefined }}>
                    {l.novo ? <span style={{ color: COR.laranja }}>★ </span> : null}
                    {nomeCurto(l.nome)}
                  </span>
                  <span style={{ textAlign: "right", fontWeight: 900 }}>{numero(l.pontos, formatPontos(l.pontos))}</span>
                  <span style={{ textAlign: "right", fontWeight: 600 }}>{numero(l.treinos, String(l.treinos))}</span>
                  <span style={{ textAlign: "right", fontWeight: 600 }}>{numero(Math.round(l.km), kmInteiro(l.km))}</span>
                </div>
              );
            })}
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
      {colunas.some((c) => c.eventos.some((e) => e.feito)) ? (
        <div style={{ position: "absolute", left: 72, bottom: 44, display: "flex", alignItems: "center", gap: 12, fontSize: 24, fontWeight: 700, color: COR.navy }}>
          <span style={{ width: 32, height: 32, borderRadius: "50%", background: COR.verde, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900 }}>✓</span>
          Já realizado
        </div>
      ) : null}
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

function Destaques({ itens, desafios, periodo, fotos }: Extract<SlideDef, { tipo: "destaques" }> & { fotos: Record<string, string> }) {
  const largura = itens.length <= 2 ? 560 : itens.length === 3 ? 500 : 400;
  return (
    <Base fundo="conteudo">
      <TituloConteudo extra={periodo}>Destaques do período</TituloConteudo>
      <div style={{ position: "absolute", left: 72, right: 72, top: 175, bottom: desafios.length ? 250 : 130, display: "flex", gap: 32, justifyContent: "center", alignItems: "center" }}>
        {itens.map((d) => (
          <div key={d.id} style={{ ...cartao, width: largura, height: desafios.length ? 600 : 680, border: "none", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ alignSelf: "stretch", padding: "18px 24px", background: `linear-gradient(180deg, ${COR.navy}, ${COR.navyEscuro})`, color: "#ffb37a", fontSize: 28, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase" }}>{d.titulo}</div>
            <div style={{ marginTop: 34 }}>
              <Avatar nome={d.atleta.nome} foto={fotos[d.atleta.id]} tamanho={190} anel={COR.laranja} />
            </div>
            <div style={{ marginTop: 26, padding: "0 24px", fontSize: 40, fontWeight: 900, color: COR.navy, lineHeight: 1.05 }}>{nomeCurto(d.atleta.nome, 20)}</div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, letterSpacing: "0.12em", color: COR.cinza }}>{modalidadeLabel[d.atleta.modalidade].toUpperCase()}</div>
            <div style={{ marginTop: "auto", paddingBottom: 30, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, color: COR.laranja }}>
                <span style={{ fontSize: 104, fontWeight: 900, lineHeight: 1 }}>{d.valor}</span>
                <span style={{ fontSize: 30, fontWeight: 800, color: COR.navy }}>{d.unidade}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 26, fontWeight: 700, color: COR.cinza }}>{d.detalhe}</div>
            </div>
          </div>
        ))}
      </div>
      {desafios.length ? (
        <div style={{ position: "absolute", left: 72, right: 72, bottom: 120, height: 104, display: "flex", alignItems: "center", gap: 28, padding: "0 36px", borderRadius: 24, background: "#fff", border: "2px solid #dbe6f3", boxShadow: "0 14px 32px rgba(7,29,64,.12)" }}>
          <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: COR.azul, whiteSpace: "nowrap" }}>Desafios do comitê</span>
          {desafios.slice(0, 3).map((d) => (
            <span key={d.titulo} style={{ display: "flex", alignItems: "baseline", gap: 10, paddingLeft: 28, borderLeft: "2px solid #e8eef6", minWidth: 0 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: COR.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 380 }}>{d.titulo}</span>
              <span style={{ fontSize: 44, fontWeight: 900, color: COR.laranja }}>{d.concluidos}</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: COR.cinza, whiteSpace: "nowrap" }}>de {d.participantes} concluíram</span>
            </span>
          ))}
        </div>
      ) : null}
      <LogoCanto />
    </Base>
  );
}

function Aniversariantes({ atletas, pagina, paginas, fotos }: Extract<SlideDef, { tipo: "aniversariantes" }> & { fotos: Record<string, string> }) {
  const colunas = atletas.length <= 4 ? atletas.length : 5;
  const tamanho = colunas <= 4 ? 220 : 180;
  return (
    <Base fundo="conteudo">
      <TituloConteudo extra={juntarExtra(`${atletas.length} ${atletas.length === 1 ? "aniversariante" : "aniversariantes"}`, paginas > 1 ? `${pagina}/${paginas}` : undefined)}>
        Aniversariantes
      </TituloConteudo>
      <div style={{ position: "absolute", left: 72, right: 72, top: 180, bottom: 140, display: "flex", flexWrap: "wrap", justifyContent: "center", alignContent: "center", columnGap: 56, rowGap: 44 }}>
        {atletas.map((a) => (
          <div key={a.id} style={{ width: tamanho + 60, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ position: "relative" }}>
              <Avatar nome={a.nome} foto={fotos[a.id]} tamanho={tamanho} anel="#fff" />
              <span style={{ position: "absolute", right: -18, bottom: -6, padding: "8px 18px", borderRadius: 999, background: `linear-gradient(180deg, #ff9a3c, ${COR.laranja})`, color: "#fff", fontSize: 28, fontWeight: 900, boxShadow: "0 8px 20px rgba(243,112,33,.4)" }}>{a.dia}</span>
            </div>
            <div style={{ marginTop: 22, fontSize: 32, fontWeight: 900, color: COR.navy, lineHeight: 1.1 }}>{nomeCurto(a.nome, 18)}</div>
            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, letterSpacing: "0.12em", color: COR.cinza }}>{modalidadeLabel[a.modalidade].toUpperCase()}</div>
          </div>
        ))}
      </div>
      <LogoCanto />
    </Base>
  );
}

export interface EstadoSorteio {
  presentes: readonly { id: string; nome: string; equipe: string }[];
  /** Ids sorteados, em ordem. */
  ganhadores: string[];
  /** Nome que está passando na tela durante o sorteio. */
  girando: string | null;
  /** Último sorteado, em destaque. */
  revelado: string | null;
}

function Sorteio({ estado, fotos }: { estado?: EstadoSorteio; fotos: Record<string, string> }) {
  const presentes = estado?.presentes ?? [];
  const porId = new Map(presentes.map((p) => [p.id, p]));
  const revelado = estado?.revelado ? porId.get(estado.revelado) : undefined;
  const anteriores = (estado?.ganhadores ?? []).filter((id) => id !== estado?.revelado).map((id) => porId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
  const modalidade = (e: string) => (e === "bicicleta" ? "Bike" : e === "corrida" ? "Corrida" : "");
  return (
    <Base fundo="premiacao">
      <div style={{ position: "absolute", left: 700, right: 60, top: 70, textAlign: "center" }}>
        <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1, ...laranja }}>Sorteio</div>
        <div style={{ marginTop: 10, fontSize: 40, fontWeight: 800, color: COR.navy }}>
          {presentes.length === 0 ? "Registre sua presença para participar" : `Entre os ${presentes.length} ${presentes.length === 1 ? "presente" : "presentes"}`}
        </div>
      </div>
      <div style={{ position: "absolute", left: 760, right: 120, top: 310, height: 520, borderRadius: 40, background: "rgba(255,255,255,.95)", boxShadow: "0 30px 70px rgba(7,29,64,.3)", border: `8px solid ${COR.ouro}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40 }}>
        {estado?.girando ? (
          <div key={estado.girando} style={{ fontSize: 104, fontWeight: 900, color: COR.navy, lineHeight: 1.05 }}>{nomeCurto(estado.girando, 22)}</div>
        ) : revelado ? (
          <>
            <div className="numero-sobe">
              <Avatar nome={revelado.nome} foto={fotos[revelado.id]} tamanho={230} anel={COR.ouro} />
            </div>
            <div style={{ marginTop: 26, fontSize: 84, fontWeight: 900, color: COR.navy, lineHeight: 1 }}>{nomeCurto(revelado.nome, 24)}</div>
            <div style={{ marginTop: 10, fontSize: 34, fontWeight: 800, color: COR.laranja }}>
              Parabéns!{modalidade(revelado.equipe) ? ` · ${modalidade(revelado.equipe)}` : ""}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 96, fontWeight: 900, color: COR.navy }}>Quem será?</div>
            <div style={{ marginTop: 14, fontSize: 32, fontWeight: 700, color: COR.cinza }}>
              {presentes.length === 0 ? "Escaneie o QR code da reunião e confirme sua presença." : "Só concorre quem registrou presença nesta reunião."}
            </div>
          </>
        )}
      </div>
      {anteriores.length ? (
        <div style={{ position: "absolute", left: 760, right: 120, top: 860, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
          {anteriores.map((p, i) => (
            <span key={p.id} style={{ padding: "10px 24px", borderRadius: 999, background: "#fff", boxShadow: "0 8px 20px rgba(7,29,64,.15)", fontSize: 28, fontWeight: 800, color: COR.navy }}>
              {i + 1}º · {nomeCurto(p.nome, 20)}
            </span>
          ))}
        </div>
      ) : null}
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
  presentes,
  sorteio,
}: {
  slide: SlideDef;
  fotos: Record<string, string>;
  imagens: Record<string, string>;
  qrPresenca: string | null;
  presencaSemPermissao?: boolean;
  qrApp: string | null;
  urlApp: string;
  /** Presenças registradas até agora (apresentação ao vivo); sem isso, o contador não aparece. */
  presentes?: number | null;
  sorteio?: EstadoSorteio;
}) {
  switch (slide.tipo) {
    case "capa":
      return <Capa ano={slide.ano} meses={slide.meses} />;
    case "presenca":
      return <Presenca evento={slide.evento} pontos={slide.pontos} qr={qrPresenca} semPermissao={presencaSemPermissao} presentes={presentes} />;
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
    case "destaques":
      return <Destaques {...slide} fotos={fotos} />;
    case "aniversariantes":
      return <Aniversariantes {...slide} fotos={fotos} />;
    case "sorteio":
      return <Sorteio estado={sorteio} fotos={fotos} />;
  }
}
