import {
  dataCivilValida,
  diasNoIntervalo,
  intervaloAusenciaValido,
  justificativasAusenciaSobrepostas,
  motivosAusenciaValidos,
} from "@/lib/justificativasAusencia";
import type {
  AtletaDoc,
  JustificativaAusenciaDoc,
  MotivoAusencia,
  PeriodicidadeAusencia,
  StatusJustificativaAusencia,
  UsuarioDoc,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_VALIDOS = new Set<StatusJustificativaAusencia>([
  "pendente",
  "aprovada",
  "recusada",
  "cancelada",
  "encerrada",
]);

const PERIODICIDADES_VALIDAS = new Set<PeriodicidadeAusencia>([
  "periodo",
  "semanal",
  "mensal",
]);

class JustificativaError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "JustificativaError";
  }
}

function dataIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate: () => Date }).toDate;
    return toDate.call(value).toISOString();
  }
  return typeof value === "string" ? value : null;
}

function itemApi(
  documento: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot,
): JustificativaAusenciaDoc {
  const dados = documento.data() ?? {};
  return {
    id: documento.id,
    atletaId: String(dados.atletaId || ""),
    atletaNome: String(dados.atletaNome || "Atleta"),
    equipe: dados.equipe,
    motivo: dados.motivo,
    descricao: String(dados.descricao || ""),
    inicio: String(dados.inicio || ""),
    fim: String(dados.fim || ""),
    periodicidade: PERIODICIDADES_VALIDAS.has(dados.periodicidade)
      ? dados.periodicidade
      : "periodo",
    diasSemana: Array.isArray(dados.diasSemana) ? dados.diasSemana : [],
    diasMes: Array.isArray(dados.diasMes) ? dados.diasMes : [],
    semDataFinal: dados.semDataFinal === true,
    status: dados.status,
    criadoPor: String(dados.criadoPor || ""),
    criadoEm: dataIso(dados.criadoEm),
    atualizadoEm: dataIso(dados.atualizadoEm),
    analisadoPor: dados.analisadoPor ? String(dados.analisadoPor) : undefined,
    analisadoPorNome: dados.analisadoPorNome ? String(dados.analisadoPorNome) : undefined,
    analisadoEm: dataIso(dados.analisadoEm),
    observacaoComite: dados.observacaoComite
      ? String(dados.observacaoComite)
      : undefined,
    canceladoEm: dataIso(dados.canceladoEm),
    encerradaAPartirDe: dados.encerradaAPartirDe
      ? String(dados.encerradaAPartirDe)
      : undefined,
    encerradoEm: dataIso(dados.encerradoEm),
    encerradoPor: dados.encerradoPor ? String(dados.encerradoPor) : undefined,
    encerradoPorNome: dados.encerradoPorNome
      ? String(dados.encerradoPorNome)
      : undefined,
  };
}

function numerosUnicosValidos(valor: unknown, minimo: number, maximo: number) {
  if (!Array.isArray(valor)) return [];
  return [...new Set(valor.filter(
    (item): item is number => Number.isInteger(item) && item >= minimo && item <= maximo,
  ))].sort((a, b) => a - b);
}

function dadosFormulario(body: Record<string, unknown>) {
  const motivo = typeof body.motivo === "string" ? body.motivo : "";
  const descricao = typeof body.descricao === "string" ? body.descricao.trim() : "";
  const inicio = typeof body.inicio === "string" ? body.inicio : "";
  const periodicidade = PERIODICIDADES_VALIDAS.has(body.periodicidade as PeriodicidadeAusencia)
    ? (body.periodicidade as PeriodicidadeAusencia)
    : "periodo";
  const semDataFinal = body.semDataFinal === true;
  const fim = semDataFinal ? "" : typeof body.fim === "string" ? body.fim : "";
  const diasSemana = periodicidade === "semanal"
    ? numerosUnicosValidos(body.diasSemana, 0, 6)
    : [];
  const diasMes = periodicidade === "mensal"
    ? numerosUnicosValidos(body.diasMes, 1, 31)
    : [];

  if (!motivosAusenciaValidos.has(motivo as MotivoAusencia)) {
    throw new JustificativaError("Selecione um motivo válido.", 400);
  }
  if (descricao.length < 3 || descricao.length > 1000) {
    throw new JustificativaError(
      "Descreva o motivo usando entre 3 e 1.000 caracteres.",
      400,
    );
  }
  if (!dataCivilValida(inicio) || (!semDataFinal && !intervaloAusenciaValido(inicio, fim))) {
    throw new JustificativaError("Informe um período válido para a ausência.", 400);
  }
  if (!semDataFinal && periodicidade === "periodo" && diasNoIntervalo(inicio, fim) > 366) {
    throw new JustificativaError("O período da solicitação deve ter no máximo 366 dias.", 400);
  }
  if (!semDataFinal && diasNoIntervalo(inicio, fim) > 3653) {
    throw new JustificativaError("A recorrência deve ter no máximo 10 anos.", 400);
  }
  if (periodicidade === "semanal" && diasSemana.length === 0) {
    throw new JustificativaError("Selecione pelo menos um dia da semana.", 400);
  }
  if (periodicidade === "mensal" && diasMes.length === 0) {
    throw new JustificativaError("Informe pelo menos um dia do mês.", 400);
  }

  return {
    motivo: motivo as MotivoAusencia,
    descricao,
    inicio,
    fim,
    periodicidade,
    diasSemana,
    diasMes,
    semDataFinal,
  };
}

function dataCivilBrasilia() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((item) => item.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

function podeRegistrar(usuario: UsuarioDoc) {
  return (
    usuario.role === "administrador" ||
    (usuario.role === "comite" && (usuario.permissoes ?? []).includes("registrar"))
  );
}

async function contexto(request: Request) {
  const { authenticatedFirebaseRequest, ApiAuthError } = await import(
    "@/lib/server/firebaseRequest"
  );
  const authContext = await authenticatedFirebaseRequest(request);
  const usuarioSnap = await authContext.db
    .collection("usuarios")
    .doc(authContext.decodedToken.uid)
    .get();
  if (!usuarioSnap.exists) {
    throw new ApiAuthError("Seu acesso ainda não foi liberado.", 403);
  }
  return {
    ...authContext,
    usuario: usuarioSnap.data() as UsuarioDoc,
  };
}

async function verificarSobreposicao(params: {
  db: FirebaseFirestore.Firestore;
  atletaId: string;
  dados: ReturnType<typeof dadosFormulario>;
  ignorarId?: string;
}) {
  const snap = await params.db
    .collection("justificativas_ausencia")
    .where("atletaId", "==", params.atletaId)
    .get();
  const existe = snap.docs.some((documento) => {
    if (documento.id === params.ignorarId) return false;
    const item = documento.data();
    if (
      item.status !== "pendente" &&
      item.status !== "aprovada" &&
      item.status !== "encerrada"
    ) return false;
    return justificativasAusenciaSobrepostas(params.dados, {
      inicio: String(item.inicio || ""),
      fim: String(item.fim || ""),
      periodicidade: PERIODICIDADES_VALIDAS.has(item.periodicidade)
        ? item.periodicidade
        : "periodo",
      diasSemana: Array.isArray(item.diasSemana) ? item.diasSemana : [],
      diasMes: Array.isArray(item.diasMes) ? item.diasMes : [],
      semDataFinal: item.semDataFinal === true,
      encerradaAPartirDe: item.encerradaAPartirDe
        ? String(item.encerradaAPartirDe)
        : undefined,
    });
  });
  if (existe) {
    throw new JustificativaError(
      "Já existe uma justificativa pendente ou aprovada nesse período.",
      409,
    );
  }
}

async function responderErro(error: unknown, fallback: string) {
  if (error instanceof JustificativaError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return Response.json({ error: "Os dados enviados são inválidos." }, { status: 400 });
  }
  const { apiErrorResponse } = await import("@/lib/server/firebaseRequest");
  return apiErrorResponse(error, fallback);
}

export async function GET(request: Request) {
  try {
    const { decodedToken, db, usuario } = await contexto(request);
    const url = new URL(request.url);
    const escopoGestao = url.searchParams.get("escopo") === "gestao";
    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && STATUS_VALIDOS.has(statusParam as StatusJustificativaAusencia)
        ? (statusParam as StatusJustificativaAusencia)
        : null;

    let documentos: FirebaseFirestore.QueryDocumentSnapshot[];
    if (escopoGestao) {
      if (!podeRegistrar(usuario)) {
        throw new JustificativaError(
          "Você não tem permissão para analisar justificativas.",
          403,
        );
      }
      let consulta: FirebaseFirestore.Query = db.collection("justificativas_ausencia");
      if (status) consulta = consulta.where("status", "==", status);
      const [justificativasSnap, atletasSnap] = await Promise.all([
        consulta.limit(1000).get(),
        db.collection("atletas").get(),
      ]);
      const atletasVisiveis = new Set(
        atletasSnap.docs
          .filter((documento) => documento.data().visivelNasListas !== false)
          .map((documento) => documento.id),
      );
      documentos = justificativasSnap.docs.filter((documento) =>
        atletasVisiveis.has(String(documento.data().atletaId || "")),
      );
    } else {
      const atletaIdSolicitado = url.searchParams.get("atletaId")?.trim();
      const atletaId = atletaIdSolicitado || usuario.atletaId;
      if (!atletaId) {
        throw new JustificativaError("Seu vínculo de atleta não foi encontrado.", 409);
      }
      if (atletaId !== usuario.atletaId && usuario.role !== "administrador") {
        throw new JustificativaError("Você não pode consultar outro atleta.", 403);
      }
      const snap = await db
        .collection("justificativas_ausencia")
        .where("atletaId", "==", atletaId)
        .limit(300)
        .get();
      documentos = snap.docs;
    }

    const items = documentos
      .map(itemApi)
      .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
    return Response.json({ items, consultadoPor: decodedToken.uid });
  } catch (error) {
    return responderErro(error, "Não foi possível carregar as justificativas.");
  }
}

export async function POST(request: Request) {
  try {
    const [{ FieldValue }, { decodedToken, db, usuario }] = await Promise.all([
      import("firebase-admin/firestore"),
      contexto(request),
    ]);
    const body = (await request.json()) as Record<string, unknown>;
    const dados = dadosFormulario(body);
    if (!usuario.atletaId) {
      throw new JustificativaError("Seu vínculo de atleta não foi encontrado.", 409);
    }

    const atletaRef = db.collection("atletas").doc(usuario.atletaId);
    const atletaSnap = await atletaRef.get();
    if (!atletaSnap.exists) {
      throw new JustificativaError("Seu perfil de atleta não foi encontrado.", 404);
    }
    const atleta = { id: atletaSnap.id, ...atletaSnap.data() } as AtletaDoc;
    if (atleta.visivelNasListas === false) {
      throw new JustificativaError(
        "Este perfil está reservado e não participa do fluxo de justificativas.",
        403,
      );
    }
    await verificarSobreposicao({
      db,
      atletaId: atleta.id,
      dados,
    });

    const ref = db.collection("justificativas_ausencia").doc();
    const batch = db.batch();
    batch.set(ref, {
      id: ref.id,
      atletaId: atleta.id,
      atletaNome: atleta.nome,
      equipe: atleta.equipe,
      ...dados,
      status: "pendente",
      criadoPor: decodedToken.uid,
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("auditoria").doc(), {
      acao: "solicitar_justificativa_ausencia",
      entidade: "justificativas_ausencia",
      entidadeId: ref.id,
      dados: { atletaId: atleta.id, motivo: dados.motivo, inicio: dados.inicio, fim: dados.fim },
      criadoPor: decodedToken.uid,
      criadoPorNome: atleta.nome,
      criadoEm: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    const criado = await ref.get();
    return Response.json({ item: itemApi(criado) }, { status: 201 });
  } catch (error) {
    return responderErro(error, "Não foi possível enviar a justificativa.");
  }
}

export async function PUT(request: Request) {
  try {
    const [{ FieldValue }, { decodedToken, db, usuario }] = await Promise.all([
      import("firebase-admin/firestore"),
      contexto(request),
    ]);
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const dados = dadosFormulario(body);
    if (!id || id.length > 200) {
      throw new JustificativaError("A justificativa informada é inválida.", 400);
    }

    const ref = db.collection("justificativas_ausencia").doc(id);
    const atual = await ref.get();
    const item = atual.data();
    if (!atual.exists) throw new JustificativaError("Justificativa não encontrada.", 404);
    if (item?.atletaId !== usuario.atletaId) {
      throw new JustificativaError("Você não pode alterar esta justificativa.", 403);
    }
    if (item?.status !== "pendente") {
      throw new JustificativaError("Somente justificativas pendentes podem ser editadas.", 409);
    }
    await verificarSobreposicao({
      db,
      atletaId: usuario.atletaId,
      dados,
      ignorarId: id,
    });

    const batch = db.batch();
    batch.update(ref, { ...dados, atualizadoEm: FieldValue.serverTimestamp() });
    batch.set(db.collection("auditoria").doc(), {
      acao: "editar_justificativa_ausencia",
      entidade: "justificativas_ausencia",
      entidadeId: id,
      dados: { atletaId: usuario.atletaId, motivo: dados.motivo, inicio: dados.inicio, fim: dados.fim },
      criadoPor: decodedToken.uid,
      criadoPorNome: item.atletaNome || decodedToken.name || "Atleta",
      criadoEm: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return Response.json({ item: itemApi(await ref.get()) });
  } catch (error) {
    return responderErro(error, "Não foi possível atualizar a justificativa.");
  }
}

export async function PATCH(request: Request) {
  try {
    const [{ FieldValue }, { decodedToken, db, usuario }] = await Promise.all([
      import("firebase-admin/firestore"),
      contexto(request),
    ]);
    const body = (await request.json()) as Record<string, unknown>;
    const acao = typeof body.acao === "string" ? body.acao : "";
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id || id.length > 200) {
      throw new JustificativaError("A justificativa informada é inválida.", 400);
    }

    const ref = db.collection("justificativas_ausencia").doc(id);
    const atual = await ref.get();
    const item = atual.data();
    if (!atual.exists) throw new JustificativaError("Justificativa não encontrada.", 404);
    const batch = db.batch();
    if (acao === "cancelar") {
      if (item?.status !== "pendente") {
        throw new JustificativaError("Somente solicitações pendentes podem ser canceladas.", 409);
      }
      if (item.atletaId !== usuario.atletaId) {
        throw new JustificativaError("Você não pode cancelar esta justificativa.", 403);
      }
      batch.update(ref, {
        status: "cancelada",
        canceladoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      batch.set(db.collection("auditoria").doc(), {
        acao: "cancelar_justificativa_ausencia",
        entidade: "justificativas_ausencia",
        entidadeId: id,
        dados: { atletaId: usuario.atletaId },
        criadoPor: decodedToken.uid,
        criadoPorNome: item.atletaNome || decodedToken.name || "Atleta",
        criadoEm: FieldValue.serverTimestamp(),
      });
    } else if (acao === "encerrar") {
      if (item?.status !== "aprovada") {
        throw new JustificativaError("Somente justificativas aprovadas podem ser encerradas.", 409);
      }
      if (item.atletaId !== usuario.atletaId && !podeRegistrar(usuario)) {
        throw new JustificativaError("Você não pode encerrar esta justificativa.", 403);
      }
      const encerradaAPartirDe = dataCivilBrasilia();
      if (!item.semDataFinal && String(item.fim || "") < encerradaAPartirDe) {
        throw new JustificativaError("Esta justificativa já terminou.", 409);
      }
      const autorNome = decodedToken.name || decodedToken.email || "Equipe do programa";
      batch.update(ref, {
        status: "encerrada",
        encerradaAPartirDe,
        encerradoEm: FieldValue.serverTimestamp(),
        encerradoPor: decodedToken.uid,
        encerradoPorNome: autorNome,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      batch.set(db.collection("auditoria").doc(), {
        acao: "encerrar_justificativa_ausencia",
        entidade: "justificativas_ausencia",
        entidadeId: id,
        dados: { atletaId: item.atletaId, encerradaAPartirDe },
        criadoPor: decodedToken.uid,
        criadoPorNome: autorNome,
        criadoEm: FieldValue.serverTimestamp(),
      });
    } else if (acao === "analisar") {
      if (item?.status !== "pendente") {
        throw new JustificativaError("Esta justificativa já foi analisada ou cancelada.", 409);
      }
      if (!podeRegistrar(usuario)) {
        throw new JustificativaError(
          "Você não tem permissão para analisar justificativas.",
          403,
        );
      }
      const status = body.status;
      if (status !== "aprovada" && status !== "recusada") {
        throw new JustificativaError("Selecione uma decisão válida.", 400);
      }
      const observacaoComite =
        typeof body.observacaoComite === "string" ? body.observacaoComite.trim() : "";
      if (observacaoComite.length > 1000) {
        throw new JustificativaError(
          "A observação do Comitê deve ter no máximo 1.000 caracteres.",
          400,
        );
      }
      if (status === "recusada" && observacaoComite.length < 3) {
        throw new JustificativaError("Informe o motivo da recusa.", 400);
      }
      const atletaSnap = await db.collection("atletas").doc(String(item.atletaId || "")).get();
      if (!atletaSnap.exists || atletaSnap.data()?.visivelNasListas === false) {
        throw new JustificativaError("O perfil deste atleta não está disponível.", 409);
      }
      const autorNome = decodedToken.name || decodedToken.email || "Equipe do programa";
      batch.update(ref, {
        status,
        observacaoComite,
        analisadoPor: decodedToken.uid,
        analisadoPorNome: autorNome,
        analisadoEm: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      batch.set(db.collection("auditoria").doc(), {
        acao: status === "aprovada" ? "aprovar_justificativa_ausencia" : "recusar_justificativa_ausencia",
        entidade: "justificativas_ausencia",
        entidadeId: id,
        dados: { atletaId: item.atletaId, status, observacaoComite },
        criadoPor: decodedToken.uid,
        criadoPorNome: autorNome,
        criadoEm: FieldValue.serverTimestamp(),
      });
    } else {
      throw new JustificativaError("A ação informada é inválida.", 400);
    }

    await batch.commit();
    return Response.json({ item: itemApi(await ref.get()) });
  } catch (error) {
    return responderErro(error, "Não foi possível atualizar a justificativa.");
  }
}
