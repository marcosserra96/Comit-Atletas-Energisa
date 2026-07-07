import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function logAudit(params: {
  acao: string;
  entidade: string;
  entidadeId: string;
  dados?: Record<string, unknown>;
  criadoPor: string;
  criadoPorNome: string;
}) {
  await addDoc(collection(db, "auditoria"), {
    ...params,
    criadoEm: serverTimestamp(),
  });
}
