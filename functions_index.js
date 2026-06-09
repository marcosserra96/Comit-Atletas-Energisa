const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

async function assertAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado.");
  }

  const uid = context.auth.uid;
  const snap = await db.collection("atletas").doc(uid).get();

  if (!snap.exists || snap.data().role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Apenas usuários admin podem executar esta ação.");
  }

  return uid;
}

exports.excluirCadastrosCompletos = functions.https.onCall(async (data, context) => {
  const meuUid = await assertAdmin(context);

  const uids = Array.isArray(data?.uids) ? data.uids : [];
  const alvo = [...new Set(uids)]
    .filter(uid => typeof uid === "string" && uid.trim())
    .filter(uid => uid !== meuUid);

  if (!alvo.length) {
    throw new functions.https.HttpsError("invalid-argument", "Nenhum UID válido informado.");
  }

  const resultado = {
    firestoreRemovidos: 0,
    authRemovidos: 0,
    naoEncontradosAuth: [],
    erros: []
  };

  for (const uid of alvo) {
    try {
      await db.collection("atletas").doc(uid).delete();
      resultado.firestoreRemovidos += 1;
    } catch (e) {
      resultado.erros.push({ uid, etapa: "firestore", erro: e.code || e.message });
      continue;
    }

    try {
      await auth.deleteUser(uid);
      resultado.authRemovidos += 1;
    } catch (e) {
      if (e.code === "auth/user-not-found") {
        resultado.naoEncontradosAuth.push(uid);
      } else {
        resultado.erros.push({ uid, etapa: "auth", erro: e.code || e.message });
      }
    }
  }

  return resultado;
});

exports.auditarAcessosAdmin = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const atletasSnap = await db.collection("atletas").get();
  const docs = atletasSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const uidDocs = new Set(docs.map(d => d.uid));

  const adminsFirestore = docs
    .filter(d => d.role === "admin")
    .map(d => ({ uid: d.uid, nome: d.nome || null, email: d.email || null, equipe: d.equipe || null }));

  const authUsers = [];
  let nextPageToken;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    authUsers.push(...page.users);
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  const uidAuth = new Set(authUsers.map(u => u.uid));

  const adminsSemAuth = adminsFirestore.filter(a => !uidAuth.has(a.uid));

  const authSemDocumento = authUsers
    .filter(u => !uidDocs.has(u.uid))
    .map(u => ({ uid: u.uid, email: u.email || null, displayName: u.displayName || null }));

  return {
    adminsFirestore,
    adminsSemAuth,
    authSemDocumento,
    totalAuth: authUsers.length,
    totalFirestore: docs.length
  };
});
