/**
 * Garante uma conta de administrador em produção: cria ou reaproveita o
 * usuário no Authentication (sempre definindo a senha informada, mesmo se a
 * conta já existir) e garante os documentos atletas/usuarios com
 * role="administrador".
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     npx tsx scripts/set-admin-producao.ts --email=... --senha=... --nome="..."
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function arg(nome: string): string | undefined {
  const prefixo = `--${nome}=`;
  return process.argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length);
}

async function main() {
  const email = arg("email");
  const senha = arg("senha");
  const nome = arg("nome");

  if (!email || !senha || !nome) {
    console.error('Uso: npx tsx scripts/set-admin-producao.ts --email=... --senha=... --nome="..."');
    process.exit(1);
  }
  if (senha.length < 6) {
    console.error("A senha precisa ter pelo menos 6 caracteres.");
    process.exit(1);
  }

  const app = initializeApp({ credential: applicationDefault() });
  const auth = getAuth(app);
  const db = getFirestore(app);

  const existente = await auth.getUserByEmail(email).catch(() => null);
  const usuario = existente
    ? await auth.updateUser(existente.uid, { password: senha, displayName: nome })
    : await auth.createUser({ email, password: senha, displayName: nome });

  console.log(existente ? "Conta já existia — senha e nome atualizados." : "Conta criada.");

  const now = Timestamp.now();
  const atletasSnap = await db.collection("atletas").where("authUid", "==", usuario.uid).get();

  if (atletasSnap.empty) {
    const atletaRef = db.collection("atletas").doc();
    await atletaRef.set({
      id: atletaRef.id,
      nome,
      email,
      role: "administrador",
      equipe: "comite",
      ativo: true,
      pontuacaoTotal: 0,
      authUid: usuario.uid,
      criadoEm: now,
      atualizadoEm: now,
    });
    await db.collection("usuarios").doc(usuario.uid).set({
      uid: usuario.uid,
      role: "administrador",
      atletaId: atletaRef.id,
      criadoEm: now,
    });
    console.log(`Perfil de administrador criado (atletas/${atletaRef.id}).`);
  } else {
    const atletaRef = atletasSnap.docs[0].ref;
    await atletaRef.update({ role: "administrador", ativo: true, atualizadoEm: now });
    await db.collection("usuarios").doc(usuario.uid).set(
      { uid: usuario.uid, role: "administrador", atletaId: atletaRef.id, criadoEm: now },
      { merge: true },
    );
    console.log(`Perfil de administrador confirmado (atletas/${atletaRef.id}).`);
  }

  console.log(`\nPronto — administrador: ${email}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
