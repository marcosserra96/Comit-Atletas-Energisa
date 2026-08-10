import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAudit } from "@/lib/audit";
import { TAMANHO_LOTE } from "@/lib/pontuacaoImportacao";
import type { AtletaDoc, HistoricoPontoDoc } from "@/lib/types";

/** Remove acentos, colapsa espaços e baixa a caixa — pra comparar nomes ignorando diferenças de digitação. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Chave estável pra um par de ids, independente da ordem. */
export function chavePar(idA: string, idB: string): string {
  return [idA, idB].sort().join("|");
}

export interface GrupoDuplicado {
  chave: string;
  membros: AtletaDoc[];
}

/** Todos os pares (combinação 2 a 2) dentro de um grupo — usado pra "ignorar" o grupo inteiro. */
export function paresDoGrupo(grupo: GrupoDuplicado): string[] {
  const pares: string[] = [];
  for (let i = 0; i < grupo.membros.length; i++) {
    for (let j = i + 1; j < grupo.membros.length; j++) {
      pares.push(chavePar(grupo.membros[i].id, grupo.membros[j].id));
    }
  }
  return pares;
}

/**
 * Agrupa atletas que parecem ser a mesma pessoa: mesmo nome normalizado ou
 * mesmo e-mail. Usa union-find pra juntar transitivamente (ex: A bate com B
 * pelo nome, B bate com C pelo e-mail — os três entram no mesmo grupo).
 * Pares presentes em `paresIgnorados` nunca são unidos.
 */
export function detectarGruposDuplicados(
  atletas: AtletaDoc[],
  paresIgnorados: Set<string>,
): GrupoDuplicado[] {
  const pai = new Map<string, string>();
  atletas.forEach((a) => pai.set(a.id, a.id));

  function encontrar(id: string): string {
    let raiz = id;
    while (pai.get(raiz) !== raiz) raiz = pai.get(raiz)!;
    return raiz;
  }

  function unir(a: string, b: string) {
    const ra = encontrar(a);
    const rb = encontrar(b);
    if (ra !== rb) pai.set(ra, rb);
  }

  function unirGrupo(lista: AtletaDoc[]) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        if (!paresIgnorados.has(chavePar(lista[i].id, lista[j].id))) {
          unir(lista[i].id, lista[j].id);
        }
      }
    }
  }

  const porNome = new Map<string, AtletaDoc[]>();
  const porEmail = new Map<string, AtletaDoc[]>();
  for (const a of atletas) {
    const chaveNome = normalizarNome(a.nome);
    if (chaveNome) {
      (porNome.get(chaveNome) ?? porNome.set(chaveNome, []).get(chaveNome)!).push(a);
    }
    if (a.email) {
      const chaveEmail = a.email.trim().toLowerCase();
      (porEmail.get(chaveEmail) ?? porEmail.set(chaveEmail, []).get(chaveEmail)!).push(a);
    }
  }
  porNome.forEach(unirGrupo);
  porEmail.forEach(unirGrupo);

  const grupos = new Map<string, AtletaDoc[]>();
  for (const a of atletas) {
    const raiz = encontrar(a.id);
    (grupos.get(raiz) ?? grupos.set(raiz, []).get(raiz)!).push(a);
  }

  return [...grupos.values()]
    .filter((membros) => membros.length >= 2)
    .map((membros) => ({
      chave: membros
        .map((m) => m.id)
        .sort()
        .join("|"),
      membros: [...membros].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    }));
}

const PARES_IGNORADOS_REF = () => doc(db, "configuracoes", "duplicados_ignorados");

export async function carregarParesIgnorados(): Promise<Set<string>> {
  const snap = await getDoc(PARES_IGNORADOS_REF());
  const pares = (snap.data()?.pares as string[] | undefined) ?? [];
  return new Set(pares);
}

export async function ignorarPares(novosPares: string[]) {
  if (novosPares.length === 0) return;
  await setDoc(PARES_IGNORADOS_REF(), { pares: arrayUnion(...novosPares) }, { merge: true });
}

export interface ResultadoFusao {
  lancamentosMigrados: number;
  comentariosMigrados: number;
  eventosAtualizados: number;
  nomesRemovidos: string[];
}

/**
 * Migra todo o histórico de pontos, comentários, inscrições em eventos e
 * (se houver) o login dos atletas "perdedores" pro atleta "canônico",
 * recalcula a pontuação total a partir do histórico real e só então apaga
 * os registros perdedores. Nada é apagado antes de ser migrado.
 */
export async function mesclarAtletas(params: {
  canonicalId: string;
  perdedoresIds: string[];
  uid: string;
  autorNome: string;
}): Promise<ResultadoFusao> {
  const { canonicalId, perdedoresIds, uid, autorNome } = params;

  const canonicalSnap = await getDoc(doc(db, "atletas", canonicalId));
  if (!canonicalSnap.exists()) throw new Error("O registro escolhido como correto não existe mais.");
  const canonical = { id: canonicalSnap.id, ...canonicalSnap.data() } as AtletaDoc;

  let lancamentosMigrados = 0;
  let comentariosMigrados = 0;
  let eventosAtualizados = 0;
  const nomesRemovidos: string[] = [];

  for (const perdedorId of perdedoresIds) {
    if (perdedorId === canonicalId) continue;
    const perdedorSnap = await getDoc(doc(db, "atletas", perdedorId));
    if (!perdedorSnap.exists()) continue;
    const perdedor = { id: perdedorSnap.id, ...perdedorSnap.data() } as AtletaDoc;

    if (perdedor.authUid && canonical.authUid && perdedor.authUid !== canonical.authUid) {
      throw new Error(
        `${perdedor.nome} e ${canonical.nome} têm logins diferentes — corrija o vínculo de um deles em "Corrigir vínculo" antes de mesclar.`,
      );
    }

    const lancSnap = await getDocs(
      query(collection(db, "historico_pontos"), where("atletaId", "==", perdedorId)),
    );
    for (let i = 0; i < lancSnap.docs.length; i += TAMANHO_LOTE) {
      const grupo = lancSnap.docs.slice(i, i + TAMANHO_LOTE);
      const batch = writeBatch(db);
      grupo.forEach((d) => {
        batch.update(d.ref, { atletaId: canonicalId, atletaNome: canonical.nome, equipe: canonical.equipe });
      });
      await batch.commit();
    }
    lancamentosMigrados += lancSnap.docs.length;

    const comSnap = await getDocs(
      query(collection(db, "comentarios_atletas"), where("atletaId", "==", perdedorId)),
    );
    for (let i = 0; i < comSnap.docs.length; i += TAMANHO_LOTE) {
      const grupo = comSnap.docs.slice(i, i + TAMANHO_LOTE);
      const batch = writeBatch(db);
      grupo.forEach((d) => batch.update(d.ref, { atletaId: canonicalId }));
      await batch.commit();
    }
    comentariosMigrados += comSnap.docs.length;

    const evSnap = await getDocs(
      query(collection(db, "agenda_eventos"), where("inscritos", "array-contains", perdedorId)),
    );
    for (let i = 0; i < evSnap.docs.length; i += TAMANHO_LOTE) {
      const grupo = evSnap.docs.slice(i, i + TAMANHO_LOTE);
      const batch = writeBatch(db);
      grupo.forEach((d) => {
        batch.update(d.ref, { inscritos: arrayRemove(perdedorId) });
      });
      await batch.commit();
    }
    for (let i = 0; i < evSnap.docs.length; i += TAMANHO_LOTE) {
      const grupo = evSnap.docs.slice(i, i + TAMANHO_LOTE);
      const batch = writeBatch(db);
      grupo.forEach((d) => batch.update(d.ref, { inscritos: arrayUnion(canonicalId) }));
      await batch.commit();
    }
    eventosAtualizados += evSnap.docs.length;

    if (perdedor.authUid) {
      const batch = writeBatch(db);
      batch.update(doc(db, "usuarios", perdedor.authUid), { atletaId: canonicalId });
      if (!canonical.authUid) {
        batch.update(doc(db, "atletas", canonicalId), {
          authUid: perdedor.authUid,
          email: perdedor.email,
          role: perdedor.role,
        });
      }
      await batch.commit();
    }

    await deleteDoc(doc(db, "atletas", perdedorId));
    nomesRemovidos.push(perdedor.nome);
  }

  const finalSnap = await getDocs(
    query(collection(db, "historico_pontos"), where("atletaId", "==", canonicalId)),
  );
  const totalReal = finalSnap.docs.reduce((soma, d) => {
    const dados = d.data() as HistoricoPontoDoc;
    return dados.estornado ? soma : soma + dados.pontos;
  }, 0);
  await updateDoc(doc(db, "atletas", canonicalId), {
    pontuacaoTotal: totalReal,
    atualizadoEm: serverTimestamp(),
  });

  await logAudit({
    acao: "mesclar_atletas",
    entidade: "atletas",
    entidadeId: canonicalId,
    dados: { nomesRemovidos, lancamentosMigrados, comentariosMigrados, eventosAtualizados },
    criadoPor: uid,
    criadoPorNome: autorNome,
  });

  return { lancamentosMigrados, comentariosMigrados, eventosAtualizados, nomesRemovidos };
}
