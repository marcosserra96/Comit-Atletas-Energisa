import { auth } from "@/lib/firebase";
import type {
  JustificativaAusenciaDoc,
  MotivoAusencia,
  StatusJustificativaAusencia,
} from "@/lib/types";

type DadosJustificativa = {
  motivo: MotivoAusencia;
  descricao: string;
  inicio: string;
  fim: string;
};

async function requisitar<T>(url: string, init?: RequestInit): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sua sessão foi encerrada. Entre novamente para continuar.");

  const token = await user.getIdToken();
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const texto = await response.text();
  let body: Record<string, unknown> = {};
  if (texto) {
    try {
      body = JSON.parse(texto) as Record<string, unknown>;
    } catch {
      throw new Error("O servidor retornou uma resposta inválida.");
    }
  }
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : "Não foi possível concluir a operação agora.",
    );
  }
  return body as T;
}

export async function carregarMinhasJustificativas(atletaId?: string) {
  const params = new URLSearchParams();
  if (atletaId) params.set("atletaId", atletaId);
  const sufixo = params.size ? `?${params.toString()}` : "";
  const body = await requisitar<{ items: JustificativaAusenciaDoc[] }>(
    `/api/justificativas${sufixo}`,
  );
  return body.items;
}

export async function carregarJustificativasGestao(
  status?: StatusJustificativaAusencia,
) {
  const params = new URLSearchParams({ escopo: "gestao" });
  if (status) params.set("status", status);
  const body = await requisitar<{ items: JustificativaAusenciaDoc[] }>(
    `/api/justificativas?${params.toString()}`,
  );
  return body.items;
}

export async function criarJustificativaAusencia(dados: DadosJustificativa) {
  const body = await requisitar<{ item: JustificativaAusenciaDoc }>(
    "/api/justificativas",
    { method: "POST", body: JSON.stringify(dados) },
  );
  return body.item;
}

export async function atualizarJustificativaAusencia(
  id: string,
  dados: DadosJustificativa,
) {
  const body = await requisitar<{ item: JustificativaAusenciaDoc }>(
    "/api/justificativas",
    { method: "PUT", body: JSON.stringify({ id, ...dados }) },
  );
  return body.item;
}

export async function cancelarJustificativaAusencia(id: string) {
  const body = await requisitar<{ item: JustificativaAusenciaDoc }>(
    "/api/justificativas",
    { method: "PATCH", body: JSON.stringify({ acao: "cancelar", id }) },
  );
  return body.item;
}

export async function analisarJustificativaAusencia(
  id: string,
  status: Extract<StatusJustificativaAusencia, "aprovada" | "recusada">,
  observacaoComite: string,
) {
  const body = await requisitar<{ item: JustificativaAusenciaDoc }>(
    "/api/justificativas",
    {
      method: "PATCH",
      body: JSON.stringify({ acao: "analisar", id, status, observacaoComite }),
    },
  );
  return body.item;
}
