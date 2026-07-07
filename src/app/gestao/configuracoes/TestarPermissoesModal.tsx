"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { CheckCircle2, ShieldAlert, Wrench, XCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { PERMISSAO_LABEL, PERMISSAO_ORDEM, PERMISSOES_PADRAO, type PermissaoChave } from "@/lib/permissoes";
import { avaliarPermissoes } from "@/lib/permissionSimulator";
import type { AtletaDoc } from "@/lib/types";

export function TestarPermissoesModal({
  pessoa,
  onClose,
  onCorrigir,
}: {
  pessoa: AtletaDoc | null;
  onClose: () => void;
  onCorrigir: (pessoa: AtletaDoc) => void;
}) {
  const [carregando, setCarregando] = useState(() => !!pessoa?.authUid);
  const [permissoes, setPermissoes] = useState<PermissaoChave[]>(PERMISSOES_PADRAO);

  useEffect(() => {
    if (!pessoa?.authUid) return;
    getDoc(doc(db, "usuarios", pessoa.authUid)).then((snap) => {
      setPermissoes(((snap.data()?.permissoes as PermissaoChave[] | undefined) ?? PERMISSOES_PADRAO));
      setCarregando(false);
    });
  }, [pessoa?.authUid]);

  const cenarios = useMemo(
    () => (pessoa ? avaliarPermissoes({ role: "comite", permissoes }) : []),
    [pessoa, permissoes],
  );

  const categorias = useMemo(() => [...new Set(cenarios.map((c) => c.categoria))], [cenarios]);
  const negados = cenarios.filter((c) => !c.permitido).length;

  return (
    <Modal open={!!pessoa} onClose={onClose} title="Testar permissões" size="lg">
      {pessoa && (
        <div className="flex flex-col gap-4">
          <p className="font-bold text-primary">{pessoa.nome}</p>

          {!pessoa.authUid ? (
            <p className="rounded-[var(--radius)] border border-border bg-bg p-3 text-sm text-text-light">
              Este atleta ainda não vinculou um login, então não há permissões para testar.
            </p>
          ) : carregando ? (
            <div className="h-64 animate-pulse rounded-[var(--radius)] bg-bg" />
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {PERMISSAO_ORDEM.map((chave) => (
                  <span
                    key={chave}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                      permissoes.includes(chave)
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-bg text-text-muted",
                    )}
                  >
                    {PERMISSAO_LABEL[chave]}
                  </span>
                ))}
              </div>

              {negados > 0 && (
                <div className="flex items-start gap-2.5 rounded-[var(--radius)] border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {negados} ação(ões) seriam negadas pelo Firestore com a configuração atual — confira
                    abaixo e corrija se algo aqui não deveria estar bloqueado.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {categorias.map((categoria) => (
                  <div key={categoria}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">
                      {categoria}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {cenarios
                        .filter((c) => c.categoria === categoria)
                        .map((c) => (
                          <div
                            key={c.chave}
                            className={cn(
                              "flex items-start gap-2.5 rounded-[var(--radius)] border px-3 py-2.5",
                              c.permitido ? "border-border bg-bg" : "border-danger/30 bg-danger/5",
                            )}
                          >
                            {c.permitido ? (
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                            ) : (
                              <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text">{c.label}</p>
                              <p className="text-xs text-text-light">{c.regra}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-text-muted">
                Baseado nas regras de segurança do Firestore hoje publicadas para este papel e estas
                permissões — não executa nenhuma ação real no banco.
              </p>

              <div className="mt-1 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Fechar
                </Button>
                <Button type="button" onClick={() => onCorrigir(pessoa)}>
                  <Wrench className="size-4" />
                  Corrigir permissões
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
