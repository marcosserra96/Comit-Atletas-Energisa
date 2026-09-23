import { FieldValue } from "firebase-admin/firestore";
import {
  FirebaseAdminConfigError,
  getFirebaseAdmin,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResultadoSincronizacao {
  total: number;
  adicionadas: number;
  jaVinculadas: number;
  jaSolicitadas: number;
  semEmail: number;
  desativadas: number;
}

function tokenDaRequisicao(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
}

function gruposDe<T>(itens: T[], tamanho: number) {
  const grupos: T[][] = [];
  for (let indice = 0; indice < itens.length; indice += tamanho) {
    grupos.push(itens.slice(indice, indice + tamanho));
  }
  return grupos;
}

export async function POST(request: Request) {
  try {
    const token = tokenDaRequisicao(request);
    if (!token) {
      return Response.json({ error: "Sessão não informada." }, { status: 401 });
    }

    const { auth, db } = getFirebaseAdmin();
    const decodedToken = await auth.verifyIdToken(token);
    const administradorSnap = await db.collection("usuarios").doc(decodedToken.uid).get();

    if (!administradorSnap.exists || administradorSnap.data()?.role !== "administrador") {
      return Response.json(
        { error: "Apenas administradores podem sincronizar contas." },
        { status: 403 },
      );
    }

    const resultado: ResultadoSincronizacao = {
      total: 0,
      adicionadas: 0,
      jaVinculadas: 0,
      jaSolicitadas: 0,
      semEmail: 0,
      desativadas: 0,
    };

    let pageToken: string | undefined;
    do {
      const pagina = await auth.listUsers(1000, pageToken);
      resultado.total += pagina.users.length;

      for (const grupo of gruposDe(pagina.users, 200)) {
        const referencias = grupo.flatMap((user) => [
          db.collection("usuarios").doc(user.uid),
          db.collection("solicitacoes_acesso").doc(user.uid),
        ]);
        const documentos = await db.getAll(...referencias);
        const batch = db.batch();
        let escritas = 0;

        grupo.forEach((user, indice) => {
          const usuarioSnap = documentos[indice * 2];
          const solicitacaoSnap = documentos[indice * 2 + 1];

          if (usuarioSnap.exists) {
            resultado.jaVinculadas += 1;
            return;
          }
          if (solicitacaoSnap.exists) {
            resultado.jaSolicitadas += 1;
            return;
          }
          if (user.disabled) {
            resultado.desativadas += 1;
            return;
          }
          if (!user.email) {
            resultado.semEmail += 1;
            return;
          }

          const email = user.email.trim().toLowerCase();
          batch.set(solicitacaoSnap.ref, {
            uid: user.uid,
            nome: user.displayName?.trim() || email.split("@")[0],
            email,
            status: "pendente",
            criadoEm: FieldValue.serverTimestamp(),
          });
          escritas += 1;
          resultado.adicionadas += 1;
        });

        if (escritas > 0) await batch.commit();
      }

      pageToken = pagina.pageToken;
    } while (pageToken);

    await db.collection("auditoria").add({
      acao: "sincronizar_contas_auth",
      entidade: "solicitacoes_acesso",
      entidadeId: "firebase_auth",
      dados: resultado,
      criadoPor: decodedToken.uid,
      criadoPorNome: decodedToken.name || decodedToken.email || "Administrador",
      criadoEm: FieldValue.serverTimestamp(),
    });

    return Response.json(resultado);
  } catch (error) {
    if (error instanceof FirebaseAdminConfigError) {
      return Response.json({ error: error.message }, { status: 503 });
    }

    console.error("Falha ao sincronizar contas do Firebase Auth:", error);
    return Response.json(
      { error: "Não foi possível sincronizar as contas agora." },
      { status: 500 },
    );
  }
}
