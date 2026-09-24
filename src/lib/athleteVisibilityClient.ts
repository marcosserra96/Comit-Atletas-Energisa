import { auth } from "@/lib/firebase";

interface AtualizarVisibilidadeResponse {
  ok: boolean;
  visivelNasListas: boolean;
  rankingAtualizado: boolean;
}

export async function atualizarVisibilidadePerfil(
  atletaId: string,
  visivelNasListas: boolean,
): Promise<AtualizarVisibilidadeResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sua sessão foi encerrada. Entre novamente para continuar.");

  const token = await user.getIdToken();
  const response = await fetch("/api/admin/atletas/visibilidade", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ atletaId, visivelNasListas }),
  });

  const texto = await response.text();
  let resultado: Partial<AtualizarVisibilidadeResponse> & { error?: string } = {};
  if (texto) {
    try {
      resultado = JSON.parse(texto) as typeof resultado;
    } catch {
      throw new Error("O servidor retornou uma resposta inválida.");
    }
  }

  if (!response.ok) {
    throw new Error(
      resultado.error || "Não foi possível alterar a visibilidade deste perfil.",
    );
  }

  return {
    ok: resultado.ok === true,
    visivelNasListas: resultado.visivelNasListas === true,
    rankingAtualizado: resultado.rankingAtualizado !== false,
  };
}
