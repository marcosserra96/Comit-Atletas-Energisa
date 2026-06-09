const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const ROLES = new Set(["admin", "comite", "atleta"]);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

function sanitizeRole(role) {
  const r = String(role || "atleta").trim().toLowerCase();
  if (!ROLES.has(r)) {
    throw new functions.https.HttpsError("invalid-argument", "Role inválido. Use admin, comite ou atleta.");
  }
  return r;
}

async function assertAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const myUid = context.auth.uid;
  const myDoc = await db.collection("atletas").doc(myUid).get();

  if (!myDoc.exists || myDoc.data().role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Apenas admin pode executar esta ação.");
  }

  return { uid: myUid, email: context.auth.token.email || "" };
}

async function listAllAuthUsers() {
  const users = [];
  let nextPageToken;

  do {
    const result = await auth.listUsers(1000, nextPageToken);
    result.users.forEach((u) => {
      users.push({
        uid: u.uid,
        email: normalizeEmail(u.email),
        displayName: u.displayName || "",
        disabled: !!u.disabled,
        creationTime: u.metadata.creationTime || "",
        lastSignInTime: u.metadata.lastSignInTime || "",
        customClaims: u.customClaims || {}
      });
    });
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  return users;
}

async function listAllFirestoreAthletes() {
  const snap = await db.collection("atletas").get();
  return snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      uid: d.id,
      nome: data.nome || data.name || "",
      email: normalizeEmail(data.email),
      role: data.role || "",
      equipe: data.equipe || "",
      raw: data
    };
  });
}

function buildAudit(authUsers, firestoreUsers) {
  const authByUid = new Map(authUsers.map((u) => [u.uid, u]));
  const fsByUid = new Map(firestoreUsers.map((u) => [u.uid, u]));

  const authSemFirestore = authUsers
    .filter((u) => !fsByUid.has(u.uid))
    .map((u) => ({ ...u, origem: "auth" }));

  const firestoreSemAuth = firestoreUsers
    .filter((u) => !authByUid.has(u.uid))
    .map((u) => ({ ...u, origem: "firestore" }));

  const integrados = firestoreUsers
    .filter((u) => authByUid.has(u.uid))
    .map((u) => ({ ...u, auth: authByUid.get(u.uid), origem: "ambos" }));

  const admins = firestoreUsers.filter((u) => u.role === "admin");
  const comite = firestoreUsers.filter((u) => u.role === "comite");

  const emailMap = new Map();
  [...authUsers, ...firestoreUsers].forEach((u) => {
    if (!u.email) return;
    if (!emailMap.has(u.email)) emailMap.set(u.email, []);
    emailMap.get(u.email).push({ uid: u.uid, origem: authByUid.has(u.uid) && fsByUid.has(u.uid) ? "ambos" : authByUid.has(u.uid) ? "auth" : "firestore" });
  });

  const emailsDuplicados = [...emailMap.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([email, items]) => ({ email, items }));

  return {
    totais: {
      auth: authUsers.length,
      firestore: firestoreUsers.length,
      integrados: integrados.length,
      authSemFirestore: authSemFirestore.length,
      firestoreSemAuth: firestoreSemAuth.length,
      admins: admins.length,
      comite: comite.length,
      emailsDuplicados: emailsDuplicados.length
    },
    authUsers,
    firestoreUsers,
    integrados,
    authSemFirestore,
    firestoreSemAuth,
    admins,
    comite,
    emailsDuplicados
  };
}

async function countAdminsExcept(uidToIgnore = "") {
  const snap = await db.collection("atletas").where("role", "==", "admin").get();
  return snap.docs.filter((d) => d.id !== uidToIgnore).length;
}

exports.auditarUsuarios = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const [authUsers, firestoreUsers] = await Promise.all([
    listAllAuthUsers(),
    listAllFirestoreAthletes()
  ]);
  return buildAudit(authUsers, firestoreUsers);
});

exports.listarFirestoreUsuarios = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  return { usuarios: await listAllFirestoreAthletes() };
});

exports.listarAuthUsuarios = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  return { usuarios: await listAllAuthUsers() };
});

exports.reconstruirCadastro = functions.https.onCall(async (data, context) => {
  const adminUser = await assertAdmin(context);

  let uid = cleanText(data.uid);
  let email = normalizeEmail(data.email);
  const role = sanitizeRole(data.role || "atleta");
  const nome = cleanText(data.nome);
  const equipe = cleanText(data.equipe);

  if (!uid && !email) {
    throw new functions.https.HttpsError("invalid-argument", "Informe UID ou e-mail.");
  }

  let userRecord;
  if (uid) {
    userRecord = await auth.getUser(uid);
  } else {
    userRecord = await auth.getUserByEmail(email);
    uid = userRecord.uid;
  }

  email = normalizeEmail(userRecord.email || email);

  await db.collection("atletas").doc(uid).set({
    nome: nome || userRecord.displayName || "",
    email,
    equipe,
    role,
    reconstruido: true,
    reconstruidoEm: admin.firestore.FieldValue.serverTimestamp(),
    reconstruidoPor: adminUser.uid,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true, uid, email, role };
});

exports.atualizarPerfilUsuario = functions.https.onCall(async (data, context) => {
  const adminUser = await assertAdmin(context);

  const uid = cleanText(data.uid);
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "UID não informado.");
  }

  const ref = db.collection("atletas").doc(uid);
  const before = await ref.get();
  const beforeRole = before.exists ? before.data().role : "";
  const role = sanitizeRole(data.role || beforeRole || "atleta");

  if (uid === adminUser.uid && role !== "admin") {
    throw new functions.https.HttpsError("invalid-argument", "Você não pode remover seu próprio perfil admin por este painel.");
  }

  if (beforeRole === "admin" && role !== "admin") {
    const remainingAdmins = await countAdminsExcept(uid);
    if (remainingAdmins <= 0) {
      throw new functions.https.HttpsError("failed-precondition", "Não é permitido remover o último admin.");
    }
  }

  const payload = {
    role,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: adminUser.uid
  };

  if (data.nome !== undefined) payload.nome = cleanText(data.nome);
  if (data.equipe !== undefined) payload.equipe = cleanText(data.equipe);
  if (data.email !== undefined) payload.email = normalizeEmail(data.email);

  await ref.set(payload, { merge: true });

  return { ok: true, uid, role };
});

exports.excluirFirestoreUsuario = functions.https.onCall(async (data, context) => {
  const adminUser = await assertAdmin(context);
  const uid = cleanText(data.uid);

  if (!uid) throw new functions.https.HttpsError("invalid-argument", "UID não informado.");
  if (uid === adminUser.uid) throw new functions.https.HttpsError("invalid-argument", "Você não pode excluir seu próprio documento.");

  const ref = db.collection("atletas").doc(uid);
  const snap = await ref.get();

  if (snap.exists && snap.data().role === "admin") {
    const remainingAdmins = await countAdminsExcept(uid);
    if (remainingAdmins <= 0) {
      throw new functions.https.HttpsError("failed-precondition", "Não é permitido excluir o último admin.");
    }
  }

  await ref.delete();
  return { ok: true, uid };
});

exports.excluirAuthUsuario = functions.https.onCall(async (data, context) => {
  const adminUser = await assertAdmin(context);
  let uid = cleanText(data.uid);
  const email = normalizeEmail(data.email);

  if (!uid && !email) throw new functions.https.HttpsError("invalid-argument", "Informe UID ou e-mail.");

  let userRecord;
  if (uid) userRecord = await auth.getUser(uid);
  else userRecord = await auth.getUserByEmail(email);

  uid = userRecord.uid;

  if (uid === adminUser.uid) {
    throw new functions.https.HttpsError("invalid-argument", "Você não pode excluir seu próprio login.");
  }

  const fsDoc = await db.collection("atletas").doc(uid).get();
  if (fsDoc.exists && fsDoc.data().role === "admin") {
    const remainingAdmins = await countAdminsExcept(uid);
    if (remainingAdmins <= 0) {
      throw new functions.https.HttpsError("failed-precondition", "Não é permitido excluir o último admin.");
    }
  }

  await auth.deleteUser(uid);
  return { ok: true, uid, email: normalizeEmail(userRecord.email) };
});

exports.excluirUsuarioCompleto = functions.https.onCall(async (data, context) => {
  const adminUser = await assertAdmin(context);
  let uid = cleanText(data.uid);
  const email = normalizeEmail(data.email);

  if (!uid && !email) throw new functions.https.HttpsError("invalid-argument", "Informe UID ou e-mail.");

  let userRecord = null;
  if (uid) {
    try { userRecord = await auth.getUser(uid); } catch (e) { userRecord = null; }
  } else {
    try { userRecord = await auth.getUserByEmail(email); uid = userRecord.uid; } catch (e) { userRecord = null; }
  }

  if (!uid && userRecord) uid = userRecord.uid;
  if (!uid) throw new functions.https.HttpsError("not-found", "Não foi possível localizar UID para exclusão.");

  if (uid === adminUser.uid) {
    throw new functions.https.HttpsError("invalid-argument", "Você não pode excluir seu próprio usuário.");
  }

  const ref = db.collection("atletas").doc(uid);
  const snap = await ref.get();

  if (snap.exists && snap.data().role === "admin") {
    const remainingAdmins = await countAdminsExcept(uid);
    if (remainingAdmins <= 0) {
      throw new functions.https.HttpsError("failed-precondition", "Não é permitido excluir o último admin.");
    }
  }

  if (snap.exists) await ref.delete();
  if (userRecord) await auth.deleteUser(uid);

  return {
    ok: true,
    uid,
    email: normalizeEmail(userRecord?.email || email),
    firestoreDeleted: snap.exists,
    authDeleted: !!userRecord
  };
});
