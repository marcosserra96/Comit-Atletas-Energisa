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

// ── auditarUsuarios ──────────────────────────────────────────────────────────
// Retorna: { authSemFirestore: [...], firestoreSemAuth: [...] }
exports.auditarUsuarios = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const atletasSnap = await db.collection("atletas").get();
  const fsDocs = atletasSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const fsUids = new Set(fsDocs.map(d => d.uid));

  const authUsers = [];
  let nextPageToken;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    authUsers.push(...page.users);
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  const authUids = new Set(authUsers.map(u => u.uid));

  const authSemFirestore = authUsers
    .filter(u => !fsUids.has(u.uid))
    .map(u => ({ uid: u.uid, email: u.email || null, displayName: u.displayName || null }));

  const firestoreSemAuth = fsDocs
    .filter(d => !authUids.has(d.uid))
    .map(d => ({ uid: d.uid, nome: d.nome || null, email: d.email || null, role: d.role || null, status: d.status || null }));

  return { authSemFirestore, firestoreSemAuth };
});

// ── listarFirestoreUsuarios ───────────────────────────────────────────────────
// Retorna: { usuarios: [...] }
exports.listarFirestoreUsuarios = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const snap = await db.collection("atletas").get();
  const usuarios = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  return { usuarios };
});

// ── alterarPerfilUsuario ──────────────────────────────────────────────────────
// Recebe: { uid, role, nome, equipe }
exports.alterarPerfilUsuario = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const { uid, role, nome, equipe } = data || {};
  if (!uid) throw new functions.https.HttpsError("invalid-argument", "UID obrigatório.");

  const update = {};
  if (role) update.role = role;
  if (nome) update.nome = nome;
  if (equipe) update.equipe = equipe;

  await db.collection("atletas").doc(uid).update(update);
  return { ok: true };
});

// ── reconstruirCadastro ───────────────────────────────────────────────────────
// Recebe: { uid, email, nome, role, equipe }
exports.reconstruirCadastro = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const { uid, email, nome, role = "comite", equipe = "" } = data || {};
  if (!uid) throw new functions.https.HttpsError("invalid-argument", "UID obrigatório.");

  await db.collection("atletas").doc(uid).set({
    uid,
    email: email || "",
    nome: nome || "",
    role,
    equipe,
    status: "Aprovado",
    ativo: true,
    criadoEm: admin.firestore.FieldValue.serverTimestamp()
  });

  return { ok: true };
});

// ── excluirFirestoreUsuario ───────────────────────────────────────────────────
// Recebe: { uid }
exports.excluirFirestoreUsuario = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const { uid } = data || {};
  if (!uid) throw new functions.https.HttpsError("invalid-argument", "UID obrigatório.");

  await db.collection("atletas").doc(uid).delete();
  return { ok: true };
});

// ── excluirAuthUsuario ────────────────────────────────────────────────────────
// Recebe: { uid }
exports.excluirAuthUsuario = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);

  const { uid } = data || {};
  if (!uid) throw new functions.https.HttpsError("invalid-argument", "UID obrigatório.");

  await auth.deleteUser(uid);
  return { ok: true };
});

// ─────────────────────────────────────────────────────────────────────────────

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
