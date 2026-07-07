"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { logAudit } from "@/lib/audit";
import {
  PERFIS_RAPIDOS,
  PERMISSAO_LABEL,
  PERMISSAO_ORDEM,
  PERMISSOES_PADRAO,
  type PermissaoChave,
} from "@/lib/permissoes";
import type { AtletaDoc } from "@/lib/types";

export function GerenciarAcessosModal({
  pessoa,
  onClose,
}: {
  pessoa: AtletaDoc | null;
  onClose: () => void;
}) {
  const { uid: adminUid, atleta: adminAtleta } = useActiveSession();
  const { show } = useToast();
  const [carregando, setCarregando] = useState(() => !!pessoa?.authUid);
  const [permissoes, setPermissoes] = useState<Set<PermissaoChave>>(new Set());
  const [perfilRapido, setPerfilRapido] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!pessoa?.authUid) return;
    getDoc(doc(db, "usuarios", pessoa.authUid)).then((snap) => {
      const atuais = (snap.data()?.permissoes as string[] | undefined) ?? PERMISSOES_PADRAO;
      setPermissoes(new Set(atuais as PermissaoChave[]));
      setCarregando(false);
    });
  }, [pessoa?.authUid]);

  function toggle(chave: PermissaoChave) {
    setPerfilRapido("");
    setPermissoes((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  }

  function aplicarPerfil(chave: string) {
    setPerfilRapido(chave);
    const perfil = PERFIS_RAPIDOS[chave];
    if (perfil) setPermissoes(new Set(perfil.permissoes));
  }

  async function handleSalvar() {
    if (!pessoa?.authUid) return;
    setSalvando(true);
    try {
      const selecionadas = [...permissoes];
      const ref = doc(db, "usuarios", pessoa.authUid);
      const antesSnap = await getDoc(ref);
      const antes = (antesSnap.data()?.permissoes as string[] | undefined) ?? PERMISSOES_PADRAO;
      await updateDoc(ref, { permissoes: selecionadas });
      await logAudit({
        acao: "alterar_permissoes",
        entidade: "usuarios",
        entidadeId: pessoa.authUid,
        dados: { atletaId: pessoa.id, antes, depois: selecionadas },
        criadoPor: adminUid,
        criadoPorNome: adminAtleta.nome,
      });
      show("success", `Acessos de ${pessoa.nome.split(" ")[0]} atualizados.`);
      onClose();
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={!!pessoa} onClose={onClose} title="Gestão de acessos">
      {pessoa && (
        <div className="flex flex-col gap-4">
          <p className="font-bold text-primary">{pessoa.nome}</p>

          {!pessoa.authUid ? (
            <p className="rounded-[var(--radius)] border border-border bg-bg p-3 text-sm text-text-light">
              Este atleta ainda não vinculou um login. Os acessos podem ser configurados assim que
              ele solicitar e for vinculado a este cadastro.
            </p>
          ) : carregando ? (
            <div className="h-40 animate-pulse rounded-[var(--radius)] bg-bg" />
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text">Perfil rápido</label>
                <Select value={perfilRapido} onChange={(e) => aplicarPerfil(e.target.value)}>
                  <option value="">Selecionar perfil…</option>
                  {Object.entries(PERFIS_RAPIDOS).map(([chave, perfil]) => (
                    <option key={chave} value={chave}>
                      {perfil.label}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-text-muted">
                  Use o perfil para evitar combinações erradas de permissões.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {PERMISSAO_ORDEM.map((chave) => (
                  <label
                    key={chave}
                    className="flex items-center gap-2.5 rounded-[var(--radius)] border border-border bg-bg px-3 py-2.5 text-sm text-text"
                  >
                    <input
                      type="checkbox"
                      checked={permissoes.has(chave)}
                      onChange={() => toggle(chave)}
                      className="size-4 rounded border-border accent-primary"
                    />
                    {PERMISSAO_LABEL[chave]}
                  </label>
                ))}
              </div>

              <div className="mt-1 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSalvar} loading={salvando}>
                  Salvar acessos
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
