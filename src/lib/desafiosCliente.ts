"use client";

import { apiAutenticada } from "@/lib/apiCliente";
import type { DesafioDoc } from "@/lib/desafios";

export type RascunhoDesafio = Omit<DesafioDoc, "id" | "atualizadoPorNome"> & { id?: string };

export const listarDesafios = () => apiAutenticada<{ desafios: DesafioDoc[] }>("/api/desafios").then((r) => r.desafios);

export const salvarDesafio = (desafio: RascunhoDesafio, avisar: boolean) =>
  apiAutenticada<{ id: string; avisados: number }>("/api/desafios", { method: "POST", body: JSON.stringify({ ...desafio, avisar }) });

export const excluirDesafio = (id: string) => apiAutenticada("/api/desafios", { method: "DELETE", body: JSON.stringify({ id }) });
