import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import {
  detectarUltrapassagens,
  INTERVALO_AVISO_RANKING_MS,
  mensagemDeConquista,
  mensagemDePedidos,
  mensagemDePontos,
  mensagemDeUltrapassagem,
  normalizarPreferencias,
  podeReceberAvisoComite,
  posicoesDoRanking,
  resumirPontosPorAtleta,
  type LancamentoParaAviso,
  type LinhaRankingAviso,
  type TipoAviso,
} from "@/lib/push/automaticos";
import type { OrigemPush } from "@/lib/push/regras";
import type { HistoricoPontoDoc, RegraPontuacaoDoc } from "@/lib/types";
import { idDoToken, registrarEnvio, type MensagemPush, type ResultadoPush } from "@/lib/server/push";

/**
 * Avisos pessoais automáticos: pontos lançados, ultrapassagem no ranking e
 * pedidos novos para o comitê. Roda no agendador (a cada 5 min) e logo depois
 * de cada lançamento de pontos. Cada lançamento/pedido é avisado uma vez só:
 * um cursor por tipo guarda até onde já foi lido, e uma trava impede duas
 * execuções ao mesmo tempo.
 */

const CONTROLE = "push_controle";
const TRAVA_MS = 90_000;
/** Margem para gravações com horário do servidor que chegam um pouco atrasadas. */
const MARGEM_MS = 3_000;

/** Para quem dispara logo após gravar: espera passar a margem antes de ler. */
export function aguardarMargem() {
  return new Promise((r) => setTimeout(r, MARGEM_MS + 1_000));
}

/** Depois de uma gravação (lançamento, pedido): processa sem travar a resposta. */
export async function processarEmSegundoPlano(db: Firestore, partes: { atletas?: boolean; comite?: boolean }) {
  try {
    await aguardarMargem();
    await processarAvisosAutomaticos(db, partes);
  } catch (error) {
    console.error("Falha nos avisos automáticos:", error);
  }
}

function diaBrasil() {
  return new Date(Date.now() - 3 * 60 * 60_000).toISOString().slice(0, 10);
}

async function travar(db: Firestore) {
  const ref = db.collection(CONTROLE).doc("_trava_automaticos");
  return db.runTransaction(async (tx) => {
    const ate = Number((await tx.get(ref)).data()?.ate ?? 0);
    if (ate > Date.now()) return false;
    tx.set(ref, { ate: Date.now() + TRAVA_MS });
    return true;
  });
}

async function destravar(db: Firestore) {
  await db.collection(CONTROLE).doc("_trava_automaticos").set({ ate: 0 });
}

/**
 * Janela nova de um tipo: de onde parou até agora. Na primeira vez só marca o
 * ponto de partida (não manda avisos de coisas antigas).
 */
async function janela(db: Firestore, nome: string) {
  const ref = db.collection(CONTROLE).doc(`cursor_${nome}`);
  const snap = await ref.get();
  const ate = Date.now() - MARGEM_MS;
  if (!snap.exists) {
    await ref.set({ ate });
    return null;
  }
  const de = Number(snap.data()?.ate ?? ate);
  if (ate <= de) return null;
  return { de, ate, confirmar: () => ref.set({ ate }) };
}

async function consultarJanela(db: Firestore, colecao: string, j: { de: number; ate: number }) {
  const { Timestamp } = await import("firebase-admin/firestore");
  return db
    .collection(colecao)
    .where("criadoEm", ">", Timestamp.fromMillis(j.de))
    .where("criadoEm", "<=", Timestamp.fromMillis(j.ate))
    .get();
}

const ERROS_TOKEN_MORTO = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/**
 * Uma mensagem por pessoa, respeitando o que cada uma escolheu receber.
 * Tudo sai num envio só (lotes de 500 aparelhos).
 */
export async function enviarIndividuais(
  db: Firestore,
  envios: { atletaId: string; mensagem: MensagemPush }[],
  tipo: TipoAviso,
): Promise<ResultadoPush & { atletaIds: string[] }> {
  const vazio = { atletas: 0, aparelhos: 0, enviados: 0, falhas: 0, atletaIds: [] as string[] };
  if (envios.length === 0) return vazio;
  const ids = [...new Set(envios.map((e) => e.atletaId))];

  const prefs = await db.getAll(...ids.map((id) => db.collection("push_preferencias").doc(id)));
  const querem = new Set(prefs.filter((p) => normalizarPreferencias(p.data())[tipo]).map((p) => p.id));
  const tokens = await db.collection("push_tokens").get();
  const aparelhos = new Map<string, { id: string; token: string }[]>();
  for (const d of tokens.docs) {
    const { atletaId, token } = d.data() as { atletaId?: string; token?: string };
    if (!atletaId || !token || !querem.has(atletaId)) continue;
    aparelhos.set(atletaId, [...(aparelhos.get(atletaId) ?? []), { id: d.id || idDoToken(token), token }]);
  }

  const mensagens = envios.flatMap((e) => (aparelhos.get(e.atletaId) ?? []).map((a) => ({ ...a, mensagem: e.mensagem })));
  const resultado = { atletas: new Set(envios.filter((e) => aparelhos.has(e.atletaId)).map((e) => e.atletaId)).size, aparelhos: mensagens.length, enviados: 0, falhas: 0, atletaIds: [...aparelhos.keys()] };
  if (mensagens.length === 0) return resultado;

  const { getFirebaseMessaging } = await import("@/lib/firebaseAdmin");
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    for (const m of mensagens) console.info(`[push simulado] ${m.mensagem.titulo} · ${m.mensagem.corpo}`);
    resultado.enviados = mensagens.length;
    return resultado;
  }
  const mortos: string[] = [];
  for (let i = 0; i < mensagens.length; i += 500) {
    const lote = mensagens.slice(i, i + 500);
    const resposta = await messaging.sendEach(
      lote.map(({ token, mensagem }) => ({
        token,
        webpush: {
          headers: { Urgency: "high", TTL: String(24 * 60 * 60) },
          data: { titulo: mensagem.titulo, corpo: mensagem.corpo, link: mensagem.link, tag: mensagem.tag ?? "" },
        },
      })),
    );
    resposta.responses.forEach((r, j) => {
      if (r.success) resultado.enviados += 1;
      else {
        resultado.falhas += 1;
        if (r.error && ERROS_TOKEN_MORTO.has(r.error.code)) mortos.push(lote[j].id);
      }
    });
  }
  if (mortos.length) {
    const batch = db.batch();
    mortos.forEach((id) => batch.delete(db.collection("push_tokens").doc(id)));
    await batch.commit();
  }
  return resultado;
}

async function nomesDe(db: Firestore, ids: string[]) {
  if (ids.length === 0) return [];
  const docs = await db.getAll(...ids.slice(0, 50).map((id) => db.collection("atletas").doc(id)));
  return docs.map((d) => String(d.data()?.nome ?? "")).filter(Boolean);
}

async function registrar(db: Firestore, origem: OrigemPush, mensagem: MensagemPush, r: ResultadoPush & { atletaIds: string[] }) {
  if (r.atletas === 0) return;
  await registrarEnvio(db, { origem, mensagem, publico: "selecionados", resultado: r, destinatarios: await nomesDe(db, r.atletaIds) });
}

// ---------- conquistas ----------

/** Quantos atletas no máximo têm as medalhas recalculadas por execução (importações grandes ficam para depois). */
const LIMITE_CONQUISTAS = 80;

interface DocConquistas {
  medalhas?: Record<string, string>;
}

/**
 * Recalcula as medalhas de quem acabou de receber pontos e avisa as novas.
 * Lê só o histórico dessas pessoas. Na primeira vez de cada atleta, só guarda
 * o que ele já tinha (sem avisar medalhas antigas).
 */
async function avisarConquistasDe(db: Firestore, atletaIds: string[]) {
  if (atletaIds.length === 0) return 0;
  const ids = atletaIds.slice(0, LIMITE_CONQUISTAS);
  const [{ calcularMedalhas }, { regrasDeTreino }] = await Promise.all([import("@/lib/conquistas"), import("@/lib/activityConsolidation")]);
  const regras = await db.collection("regras_pontuacao").get();
  const regrasTreino = regrasDeTreino(regras.docs.map((d) => ({ ...(d.data() as RegraPontuacaoDoc), id: d.id })));
  const atletas = await db.getAll(...ids.map((id) => db.collection("atletas").doc(id)));
  const docs = await db.getAll(...ids.map((id) => db.collection("conquistas").doc(id)));
  const envios: { atletaId: string; mensagem: MensagemPush }[] = [];
  const hoje = diaBrasil();
  for (const [i, id] of ids.entries()) {
    const equipe = String(atletas[i].data()?.equipe ?? "");
    const modalidade = equipe.includes("bicicleta") ? "bicicleta" : equipe.includes("corrida") ? "corrida" : null;
    if (!modalidade) continue;
    const historico = await db.collection("historico_pontos").where("atletaId", "==", id).get();
    const atual = (docs[i].data() as DocConquistas | undefined)?.medalhas ?? {};
    const { medalhas } = calcularMedalhas({
      lancamentos: historico.docs.map((d) => ({ ...d.data(), id: d.id }) as HistoricoPontoDoc),
      regrasTreino,
      modalidade,
      hoje,
      doServidor: atual,
    });
    const ganhas = medalhas.filter((m) => m.conquistada && !m.doServidor);
    const novas = ganhas.filter((m) => !atual[m.id]);
    if (novas.length === 0 && docs[i].exists) continue;
    const registro = { ...atual, ...Object.fromEntries(novas.map((m) => [m.id, m.em || hoje])) };
    await db.collection("conquistas").doc(id).set({ medalhas: registro, atualizadoEm: Date.now() }, { merge: true });
    if (docs[i].exists && novas.length) {
      envios.push({ atletaId: id, mensagem: { ...mensagemDeConquista(novas.map((m) => m.titulo)), link: "/desempenho#conquistas", tag: `conquista-${id}` } });
    }
  }
  if (envios.length) {
    const r = await enviarIndividuais(db, envios, "conquistas");
    await registrar(db, "conquistas", { titulo: "Conquistas", corpo: `${envios.length} atleta(s) ganharam medalha nova.`, link: "/desempenho" }, r);
  }
  return envios.length;
}

/** Pódio e liderança: medalhas que só existem no momento do ranking. */
async function registrarMedalhasDeRanking(db: Firestore, linhas: LinhaRankingAviso[], posicoes: Record<string, number>) {
  const candidatos = linhas.filter((l) => l.pontos > 0 && posicoes[l.atletaId] && posicoes[l.atletaId] <= 3);
  if (candidatos.length === 0) return 0;
  const { medalhasDaModalidade } = await import("@/lib/conquistas");
  const titulo = Object.fromEntries(medalhasDaModalidade("corrida").map((m) => [m.id, m.titulo]));
  const docs = await db.getAll(...candidatos.map((c) => db.collection("conquistas").doc(c.atletaId)));
  const hoje = diaBrasil();
  const envios: { atletaId: string; mensagem: MensagemPush }[] = [];
  for (const [i, c] of candidatos.entries()) {
    const atual = (docs[i].data() as DocConquistas | undefined)?.medalhas ?? {};
    const novas = [...(posicoes[c.atletaId] === 1 ? ["lider"] : []), "podio"].filter((id) => !atual[id]);
    if (novas.length === 0) continue;
    await db.collection("conquistas").doc(c.atletaId).set({ medalhas: { ...atual, ...Object.fromEntries(novas.map((id) => [id, hoje])) }, atualizadoEm: Date.now() }, { merge: true });
    envios.push({ atletaId: c.atletaId, mensagem: { ...mensagemDeConquista(novas.map((id) => titulo[id])), link: "/desempenho#conquistas", tag: `conquista-${c.atletaId}` } });
  }
  if (envios.length) {
    const r = await enviarIndividuais(db, envios, "conquistas");
    await registrar(db, "conquistas", { titulo: "Conquistas", corpo: `${envios.length} atleta(s) chegaram ao pódio ou à liderança.`, link: "/ranking" }, r);
  }
  return envios.length;
}

// ---------- pontos ----------

async function avisarPontos(db: Firestore) {
  const j = await janela(db, "pontos");
  if (!j) return 0;
  const snap = await consultarJanela(db, "historico_pontos", j);
  const resumo = resumirPontosPorAtleta(snap.docs.map((d) => d.data() as LancamentoParaAviso));
  const envios = [...resumo.entries()].map(([atletaId, r]) => {
    const m = mensagemDePontos(r);
    return { atletaId, mensagem: { ...m, link: "/desempenho", tag: `pontos-${atletaId}` } };
  });
  const r = await enviarIndividuais(db, envios, "pontos");
  await j.confirmar();
  if (envios.length) {
    await registrar(db, "pontos", { titulo: "Pontos lançados", corpo: `${envios.length} atleta(s) avisados dos próprios pontos.`, link: "/desempenho" }, r);
  }
  // Quem recebeu pontos pode ter ganhado medalha (inclusive pela importação, que não gera aviso de pontos).
  const comPontos = [...new Set(snap.docs.map((d) => String(d.data().atletaId ?? "")).filter(Boolean))];
  try {
    await avisarConquistasDe(db, comPontos);
  } catch (error) {
    console.error("Falha ao calcular conquistas:", error);
  }
  return envios.length;
}

// ---------- ranking ----------

interface FotoRanking {
  chave: string;
  posicoes: Record<string, number>;
  ultimos: Record<string, number>;
}

async function avisarUltrapassagens(db: Firestore, silencioso = false) {
  const [periodosSnap, visibilidadeSnap] = await Promise.all([
    db.collection("configuracoes").doc("ranking_periodos").get(),
    db.collection("configuracoes").doc("ranking_visibilidade").get(),
  ]);
  const { normalizarRankingPeriods } = await import("@/lib/rankingPeriods");
  const { normalizarRankingVisibility, rankingOcultoAgora } = await import("@/lib/rankingVisibility");
  const config = normalizarRankingPeriods(periodosSnap.data() as never);
  const visibilidade = normalizarRankingVisibility(visibilidadeSnap.data() as never);
  if (!config.geracaoPublicada) return 0;
  const periodoId = config.trimestre.ativo ? "trimestre" : "geral";
  const chave = periodoId === "trimestre" ? `trimestre:${config.trimestre.inicio}:${config.trimestre.fim}` : "geral";

  let total = 0;
  for (const equipe of ["corrida", "bicicleta"] as const) {
    const snap = await db
      .collection("ranking_resultados")
      .where("geracaoId", "==", config.geracaoPublicada)
      .where("periodoId", "==", periodoId)
      .where("equipe", "==", equipe)
      .get();
    const linhas: LinhaRankingAviso[] = snap.docs
      .map((d) => d.data() as { atletaId?: string; nome?: string; pontuacaoTotal?: number; visivelNasListas?: boolean; ativo?: boolean })
      .filter((d) => d.atletaId && d.ativo !== false)
      .map((d) => ({ atletaId: String(d.atletaId), nome: String(d.nome ?? ""), pontos: Number(d.pontuacaoTotal ?? 0), visivel: d.visivelNasListas !== false }));

    const ref = db.collection(CONTROLE).doc(`ranking_${equipe}`);
    const anterior = (await ref.get()).data() as FotoRanking | undefined;
    const { posicoes } = posicoesDoRanking(linhas);
    const ultimos = { ...(anterior?.ultimos ?? {}) };
    // Período novo, ranking oculto (fechamento da premiação) ou recálculo de critérios:
    // só atualiza a fotografia, sem avisar.
    const avisar =
      !silencioso &&
      anterior?.chave === chave &&
      visibilidade.exibirParaAtletas &&
      !rankingOcultoAgora(visibilidade, equipe, diaBrasil());
    if (avisar && anterior) {
      const agora = Date.now();
      const envios = detectarUltrapassagens(anterior.posicoes, linhas)
        .filter((u) => agora - (ultimos[u.atletaId] ?? 0) >= INTERVALO_AVISO_RANKING_MS)
        .map((u) => ({ atletaId: u.atletaId, mensagem: { ...mensagemDeUltrapassagem(u), link: "/ranking", tag: `ranking-${u.atletaId}` } }));
      if (envios.length) {
        const r = await enviarIndividuais(db, envios, "ranking");
        envios.forEach((e) => (ultimos[e.atletaId] = agora));
        await registrar(db, "ranking", { titulo: "Ultrapassagem no ranking", corpo: `${envios.length} atleta(s) avisados de que foram passados.`, link: "/ranking" }, r);
        total += envios.length;
      }
      await registrarMedalhasDeRanking(db, linhas, posicoes).catch((error) => console.error("Falha nas medalhas de ranking:", error));
    }
    await ref.set({ chave, posicoes, ultimos } satisfies FotoRanking);
  }
  return total;
}

/** Depois de recalcular por critério ou trocar o período: guarda o ranking novo sem avisar ninguém. */
export async function reiniciarFotografiaDoRanking(db: Firestore) {
  await avisarUltrapassagens(db, true);
}

// ---------- comitê ----------

const PEDIDOS = [
  { tipo: "comite_acesso", colecao: "solicitacoes_acesso", nome: (d: Record<string, unknown>) => String(d.nome ?? d.email ?? "") },
  { tipo: "comite_justificativa", colecao: "justificativas_ausencia", nome: (d: Record<string, unknown>) => String(d.atletaNome ?? "") },
  { tipo: "comite_senha", colecao: "pedidos_senha", nome: (d: Record<string, unknown>) => String(d.nome ?? d.email ?? "") },
] as const;

async function avisarComite(db: Firestore) {
  let total = 0;
  let equipe: { atletaId: string; role?: string; permissoes?: string[] }[] | null = null;
  for (const p of PEDIDOS) {
    const j = await janela(db, p.tipo);
    if (!j) continue;
    const snap = await consultarJanela(db, p.colecao, j);
    const nomes = snap.docs
      .map((d) => d.data() as Record<string, unknown>)
      .filter((d) => (d.status ?? "pendente") === "pendente")
      .map(p.nome)
      .filter(Boolean);
    if (nomes.length) {
      equipe ??= (await db.collection("usuarios").where("role", "in", ["administrador", "comite"]).get()).docs
        .map((d) => d.data() as { atletaId?: string; role?: string; permissoes?: string[] })
        .filter((u): u is { atletaId: string; role?: string; permissoes?: string[] } => !!u.atletaId);
      const mensagem = { ...mensagemDePedidos(p.tipo, nomes), tag: p.tipo };
      const destinos = equipe.filter((u) => podeReceberAvisoComite(u, p.tipo));
      const r = await enviarIndividuais(db, destinos.map((u) => ({ atletaId: u.atletaId, mensagem })), p.tipo);
      await registrar(db, "comite", mensagem, r);
      total += nomes.length;
    }
    await j.confirmar();
  }
  return total;
}

/** Tudo de uma vez, com trava. Devolve o que saiu (para o log da rota). */
export async function processarAvisosAutomaticos(db: Firestore, partes: { atletas?: boolean; comite?: boolean } = { atletas: true, comite: true }) {
  if (!(await travar(db))) return { pulado: true as const };
  try {
    const pontos = partes.atletas ? await avisarPontos(db) : 0;
    const ranking = partes.atletas ? await avisarUltrapassagens(db) : 0;
    const comite = partes.comite ? await avisarComite(db) : 0;
    return { pontos, ranking, comite };
  } finally {
    await destravar(db);
  }
}
