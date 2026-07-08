import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EmpresaPagadoraDoc } from "@/lib/types";

/**
 * Cria uma empresa pagadora se ainda não existir (comparação sem diferenciar
 * maiúsculas/minúsculas) e retorna o nome final a usar — o já existente, se houver.
 */
export async function garantirEmpresaPagadora(nome: string, empresasConhecidas: EmpresaPagadoraDoc[]): Promise<string> {
  const existente = empresasConhecidas.find((e) => e.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  if (existente) return existente.nome;

  const nova = doc(collection(db, "empresas_pagadoras"));
  await setDoc(nova, { id: nova.id, nome: nome.trim(), criadoEm: serverTimestamp() });
  return nome.trim();
}
