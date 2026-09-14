import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AuditParams {
  acao: string;
  entidade: string;
  entidadeId: string;
  dados?: Record<string, unknown>;
  criadoPor: string;
  criadoPorNome: string;
}

export function addAuditToBatch(batch: WriteBatch, params: AuditParams) {
  const auditRef = doc(collection(db, "auditoria"));
  batch.set(auditRef, {
    ...params,
    criadoEm: serverTimestamp(),
  });
}

export async function logAudit(params: AuditParams) {
  await addDoc(collection(db, "auditoria"), {
    ...params,
    criadoEm: serverTimestamp(),
  });
}
