/**
 * Avisos automáticos pessoais (pontos, ranking, pedidos para o comitê):
 * regras puras, sem Firebase, usadas pelo servidor e testadas à parte.
 */

// ---------- preferências ----------

/** Tipos de aviso que cada pessoa pode ligar ou desligar. */
export type TipoAviso = "pontos" | "ranking" | "conquistas" | "comite_acesso" | "comite_justificativa" | "comite_senha";

export type PreferenciasAviso = Record<TipoAviso, boolean>;

export const PREFERENCIAS_PADRAO: PreferenciasAviso = {
  pontos: true,
  ranking: true,
  conquistas: true,
  comite_acesso: true,
  comite_justificativa: true,
  comite_senha: true,
};

export const TIPO_AVISO_INFO: Record<TipoAviso, { titulo: string; texto: string }> = {
  pontos: { titulo: "Pontos lançados", texto: "Quando o comitê lançar pontos para você." },
  ranking: { titulo: "Ultrapassagem no ranking", texto: "Quando alguém passar você no ranking do trimestre." },
  conquistas: { titulo: "Conquistas", texto: "Quando você ganhar uma medalha nova." },
  comite_acesso: { titulo: "Pedido de acesso", texto: "Quando alguém pedir para entrar no portal." },
  comite_justificativa: { titulo: "Justificativa de ausência", texto: "Quando um atleta enviar uma justificativa para analisar." },
  comite_senha: { titulo: "Pedido de nova senha", texto: "Quando alguém não conseguir entrar e pedir ajuda." },
};

export const TIPOS_ATLETA: TipoAviso[] = ["pontos", "ranking", "conquistas"];
export const TIPOS_COMITE: TipoAviso[] = ["comite_acesso", "comite_justificativa", "comite_senha"];

export function normalizarPreferencias(valor: unknown): PreferenciasAviso {
  const v = (valor && typeof valor === "object" ? valor : {}) as Partial<Record<TipoAviso, unknown>>;
  const out = { ...PREFERENCIAS_PADRAO };
  for (const tipo of Object.keys(PREFERENCIAS_PADRAO) as TipoAviso[]) {
    if (typeof v[tipo] === "boolean") out[tipo] = v[tipo] as boolean;
  }
  return out;
}

/** Quem do comitê recebe cada aviso: só quem consegue resolver o pedido. */
export function podeReceberAvisoComite(
  usuario: { role?: string; permissoes?: string[] },
  tipo: Extract<TipoAviso, `comite_${string}`>,
) {
  if (usuario.role === "administrador") return true;
  if (usuario.role !== "comite") return false;
  const p = usuario.permissoes ?? [];
  if (tipo === "comite_acesso") return false; // a aba de pedidos de acesso é só do administrador
  if (tipo === "comite_justificativa") return p.includes("registrar");
  return p.includes("atletas");
}

// ---------- pontos lançados ----------

export interface LancamentoParaAviso {
  atletaId: string;
  pontos: number;
  estornado?: boolean;
  tipoLancamento?: string;
  origemPresenca?: string;
  descricaoLote?: string;
  regraDesc?: string;
  dataTreino?: string;
}

/**
 * Agrupa os lançamentos novos por atleta. Ficam de fora: estornos, pontos
 * zerados ou negativos, importação de planilha antiga (seria uma avalanche de
 * avisos de pontos velhos) e a presença que o próprio atleta confirmou pelo QR
 * (ele acabou de ver a confirmação na tela).
 */
export function resumirPontosPorAtleta(lancamentos: readonly LancamentoParaAviso[]) {
  const porAtleta = new Map<string, { total: number; motivos: string[]; datas: string[] }>();
  for (const l of lancamentos) {
    if (!l.atletaId || l.estornado || !(l.pontos > 0)) continue;
    if (l.tipoLancamento === "importacao") continue;
    if (l.origemPresenca === "qrcode") continue;
    const atual = porAtleta.get(l.atletaId) ?? { total: 0, motivos: [], datas: [] };
    atual.total += l.pontos;
    const motivo = (l.descricaoLote || l.regraDesc || "").trim();
    if (motivo && !atual.motivos.includes(motivo)) atual.motivos.push(motivo);
    if (l.dataTreino && !atual.datas.includes(l.dataTreino)) atual.datas.push(l.dataTreino);
    porAtleta.set(l.atletaId, atual);
  }
  return porAtleta;
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function mensagemDePontos(resumo: { total: number; motivos: string[]; datas: string[] }) {
  const n = resumo.total;
  const motivos =
    resumo.motivos.length === 0
      ? "Confira no seu desempenho."
      : resumo.motivos.length === 1
        ? resumo.motivos[0]
        : `${resumo.motivos.slice(0, 2).join(", ")}${resumo.motivos.length > 2 ? ` e mais ${resumo.motivos.length - 2}` : ""}`;
  const quando = resumo.datas.length === 1 ? ` · ${dataCurta(resumo.datas[0])}` : "";
  return {
    titulo: `Você ganhou ${n} ${n === 1 ? "ponto" : "pontos"}`,
    corpo: `${motivos}${quando}`.slice(0, 180),
  };
}

// ---------- ultrapassagens no ranking ----------

export interface LinhaRankingAviso {
  atletaId: string;
  nome: string;
  pontos: number;
  /** false = perfil oculto nas listas: o nome não vai na mensagem. */
  visivel: boolean;
}

/** Posições com empate denso (1, 1, 2, 3), igual ao ranking do portal. */
export function posicoesDoRanking(linhas: readonly LinhaRankingAviso[]) {
  const ordenadas = [...linhas].filter((l) => l.pontos > 0).sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, "pt-BR"));
  const posicoes: Record<string, number> = {};
  let pos = 0;
  let anterior: number | undefined;
  for (const l of ordenadas) {
    if (l.pontos !== anterior) pos += 1;
    anterior = l.pontos;
    posicoes[l.atletaId] = pos;
  }
  return { ordenadas, posicoes };
}

export interface Ultrapassagem {
  atletaId: string;
  posicaoAntes: number;
  posicaoAgora: number;
  /** Quem passou, na ordem do ranking (nomes já protegidos). */
  quem: string[];
  /** Pontos que faltam para alcançar quem está logo à frente. */
  faltam: number;
}

/** "Amanda Cristina de Almeida Prado" → "Amanda Prado". */
export function nomeParaAviso(nome: string) {
  const partes = nome.trim().split(/\s+/).filter((p) => !["de", "da", "do", "das", "dos", "e"].includes(p.toLowerCase()));
  return partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : partes.join(" ");
}

/**
 * Quem caiu de posição porque alguém que estava atrás (ou empatado, ou fora
 * do ranking) agora está à frente. Empatar não é ultrapassar.
 */
export function detectarUltrapassagens(anterior: Record<string, number>, linhas: readonly LinhaRankingAviso[]): Ultrapassagem[] {
  const { ordenadas, posicoes } = posicoesDoRanking(linhas);
  const out: Ultrapassagem[] = [];
  for (const eu of ordenadas) {
    const antes = anterior[eu.atletaId];
    const agora = posicoes[eu.atletaId];
    if (!antes || agora <= antes) continue;
    const passaram = ordenadas.filter((o) => {
      if (o.atletaId === eu.atletaId || posicoes[o.atletaId] >= agora) return false;
      const oAntes = anterior[o.atletaId];
      return oAntes === undefined || oAntes >= antes;
    });
    if (passaram.length === 0) continue;
    const logoAFrente = ordenadas.filter((o) => posicoes[o.atletaId] === agora - 1)[0];
    out.push({
      atletaId: eu.atletaId,
      posicaoAntes: antes,
      posicaoAgora: agora,
      quem: passaram.map((o) => (o.visivel ? nomeParaAviso(o.nome) : "um colega")),
      faltam: logoAFrente ? logoAFrente.pontos - eu.pontos : 0,
    });
  }
  return out;
}

export function mensagemDeUltrapassagem(u: Ultrapassagem) {
  const nomes = [...new Set(u.quem)];
  const titulo =
    nomes.length === 1
      ? nomes[0] === "um colega"
        ? "Alguém passou você no ranking"
        : `${nomes[0]} passou você no ranking`
      : `${nomes.length} atletas passaram você no ranking`;
  const faltam = u.faltam > 0 ? ` Faltam ${u.faltam} ${u.faltam === 1 ? "ponto" : "pontos"} para subir.` : "";
  return { titulo: titulo.slice(0, 60), corpo: `Agora você está em ${u.posicaoAgora}º.${faltam} Bora treinar!` };
}

/** Intervalo mínimo entre dois avisos de ultrapassagem para a mesma pessoa. */
export const INTERVALO_AVISO_RANKING_MS = 12 * 60 * 60_000;

// ---------- pedidos para o comitê ----------

export function mensagemDePedidos(tipo: "comite_acesso" | "comite_justificativa" | "comite_senha", nomes: string[]) {
  const n = nomes.length;
  const primeiro = nomes[0] ?? "";
  if (tipo === "comite_acesso") {
    return {
      titulo: n === 1 ? "Novo pedido de acesso" : `${n} pedidos de acesso novos`,
      corpo: n === 1 ? `${primeiro} quer entrar no portal. Toque para aprovar ou recusar.` : `${nomes.slice(0, 3).join(", ")}${n > 3 ? " e mais" : ""} querem entrar no portal.`,
      link: "/gestao/atletas?tab=pendentes",
    };
  }
  if (tipo === "comite_justificativa") {
    return {
      titulo: n === 1 ? "Nova justificativa de ausência" : `${n} justificativas novas`,
      corpo: n === 1 ? `${primeiro} enviou uma justificativa para analisar.` : `${nomes.slice(0, 3).join(", ")}${n > 3 ? " e mais" : ""} enviaram justificativas.`,
      link: "/gestao/pontuacao?tab=justificativas",
    };
  }
  return {
    titulo: n === 1 ? "Pedido de nova senha" : `${n} pedidos de nova senha`,
    corpo: n === 1 ? `${primeiro} não consegue entrar e pediu ajuda.` : `${nomes.slice(0, 3).join(", ")}${n > 3 ? " e mais" : ""} pediram ajuda para entrar.`,
    link: "/gestao",
  };
}

// ---------- conquistas ----------

export function mensagemDeConquista(titulos: string[]) {
  if (titulos.length === 1) return { titulo: "Nova conquista!", corpo: `Você ganhou a medalha "${titulos[0]}". Veja no seu desempenho.` };
  return { titulo: `${titulos.length} conquistas novas!`, corpo: `Você ganhou: ${titulos.slice(0, 3).join(", ")}${titulos.length > 3 ? " e mais" : ""}.`.slice(0, 180) };
}
