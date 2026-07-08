"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { KeyRound, Link2, ShieldCheck, TestTube2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { logAudit } from "@/lib/audit";
import { roleLabel } from "@/lib/labels";
import { GerenciarAcessosModal } from "./GerenciarAcessosModal";
import { TestarPermissoesModal } from "./TestarPermissoesModal";
import { CorrigirVinculoModal } from "./CorrigirVinculoModal";
import type { AtletaDoc, Equipe, Role } from "@/lib/types";

export function UsuariosTab() {
  const { uid: adminUid, atleta: adminAtleta } = useActiveSession();
  const { show } = useToast();
  const [staff, setStaff] = useState<AtletaDoc[] | null>(null);
  const [atletasSemVinculo, setAtletasSemVinculo] = useState<AtletaDoc[]>([]);
  const [gerenciandoAcessos, setGerenciandoAcessos] = useState<AtletaDoc | null>(null);
  const [testandoPermissoes, setTestandoPermissoes] = useState<AtletaDoc | null>(null);
  const [corrigindoVinculo, setCorrigindoVinculo] = useState<AtletaDoc | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "atletas"), (snap) => {
      setStaff(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
          .filter((a) => a.role === "comite" || a.role === "administrador"),
      );
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), where("authUid", "==", null)),
      (snap) => setAtletasSemVinculo(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)),
    );
    return unsubscribe;
  }, []);

  async function handleChangeEquipe(pessoa: AtletaDoc, novaEquipe: Equipe) {
    try {
      await updateDoc(doc(db, "atletas", pessoa.id), { equipe: novaEquipe });
      await logAudit({
        acao: "alterar_equipe_staff",
        entidade: "atletas",
        entidadeId: pessoa.id,
        dados: { de: pessoa.equipe, para: novaEquipe },
        criadoPor: adminUid,
        criadoPorNome: adminAtleta.nome,
      });
      show(
        "success",
        novaEquipe === "comite"
          ? `${pessoa.nome.split(" ")[0]} não compete mais no programa.`
          : `${pessoa.nome.split(" ")[0]} agora também compete em ${novaEquipe === "bicicleta" ? "Bicicleta" : "Corrida"}.`,
      );
    } catch {
      show("error", "Não foi possível atualizar agora. Tente novamente.");
    }
  }

  const totalAdministradores = useMemo(
    () => staff?.filter((s) => s.role === "administrador").length ?? 0,
    [staff],
  );

  async function handleChangeRole(pessoa: AtletaDoc, novaRole: Role) {
    if (pessoa.role === "administrador" && novaRole !== "administrador" && totalAdministradores <= 1) {
      show("error", "Não é possível remover o último administrador do programa.");
      return;
    }
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "atletas", pessoa.id), { role: novaRole });
      if (pessoa.authUid) {
        batch.update(doc(db, "usuarios", pessoa.authUid), { role: novaRole });
      }
      await batch.commit();
      await logAudit({
        acao: "alterar_perfil_usuario",
        entidade: "atletas",
        entidadeId: pessoa.id,
        dados: { de: pessoa.role, para: novaRole },
        criadoPor: adminUid,
        criadoPorNome: adminAtleta.nome,
      });
      show("success", `Perfil de ${pessoa.nome.split(" ")[0]} atualizado para ${roleLabel[novaRole]}.`);
    } catch {
      show("error", "Não foi possível atualizar agora. Tente novamente.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-light">
        {staff === null ? "Carregando…" : `${staff.length} membros da equipe do programa.`}
      </p>

      {staff === null ? (
        <Card className="h-40 animate-pulse" />
      ) : staff.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Nenhum membro de equipe"
            description="Comitê e administradores aparecem aqui assim que forem criados."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((pessoa) => (
            <Card key={pessoa.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {pessoa.nome.trim().charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-text">{pessoa.nome}</p>
                  <p className="text-xs text-text-light">{pessoa.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={pessoa.id === adminAtleta.id ? "primary" : "neutral"}>
                  {pessoa.id === adminAtleta.id ? "Você" : roleLabel[pessoa.role as Role]}
                </Badge>
              </div>
              <Select
                value={pessoa.role ?? ""}
                disabled={pessoa.id === adminAtleta.id}
                onChange={(e) => handleChangeRole(pessoa, e.target.value as Role)}
              >
                <option value="comite">Comitê</option>
                <option value="administrador">Administrador</option>
              </Select>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-light">Também é atleta?</label>
                <Select
                  value={pessoa.equipe === "bicicleta" || pessoa.equipe === "corrida" ? pessoa.equipe : "comite"}
                  onChange={(e) => handleChangeEquipe(pessoa, e.target.value as Equipe)}
                >
                  <option value="comite">Comitê</option>
                  <option value="bicicleta">Sim, Bicicleta</option>
                  <option value="corrida">Sim, Corrida</option>
                </Select>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCorrigindoVinculo(pessoa)}
                className="justify-center"
              >
                <Link2 className="size-3.5" />
                Corrigir vínculo
              </Button>

              {pessoa.role === "comite" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setGerenciandoAcessos(pessoa)}
                    className="justify-center"
                  >
                    <KeyRound className="size-3.5" />
                    Gerenciar acessos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTestandoPermissoes(pessoa)}
                    className="justify-center"
                  >
                    <TestTube2 className="size-3.5" />
                    Testar permissões
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <GerenciarAcessosModal
        key={gerenciandoAcessos?.id ?? "none"}
        pessoa={gerenciandoAcessos}
        onClose={() => setGerenciandoAcessos(null)}
      />
      <TestarPermissoesModal
        key={`teste-${testandoPermissoes?.id ?? "none"}`}
        pessoa={testandoPermissoes}
        onClose={() => setTestandoPermissoes(null)}
        onCorrigir={(pessoa) => {
          setTestandoPermissoes(null);
          setGerenciandoAcessos(pessoa);
        }}
      />
      <CorrigirVinculoModal
        key={`vinculo-${corrigindoVinculo?.id ?? "none"}`}
        pessoa={corrigindoVinculo}
        atletasSemVinculo={atletasSemVinculo}
        onClose={() => setCorrigindoVinculo(null)}
      />
    </div>
  );
}
