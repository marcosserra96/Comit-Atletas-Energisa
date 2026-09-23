"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { CloudDownload, KeyRound, Link2, ShieldCheck, TestTube2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
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

interface ResultadoSincronizacao {
  total: number;
  adicionadas: number;
  jaVinculadas: number;
  jaSolicitadas: number;
  semEmail: number;
  desativadas: number;
}

export function UsuariosTab() {
  const { uid: adminUid, atleta: adminAtleta } = useActiveSession();
  const { show } = useToast();
  const [staff, setStaff] = useState<AtletaDoc[] | null>(null);
  const [atletasSemVinculo, setAtletasSemVinculo] = useState<AtletaDoc[]>([]);
  const [gerenciandoAcessos, setGerenciandoAcessos] = useState<AtletaDoc | null>(null);
  const [testandoPermissoes, setTestandoPermissoes] = useState<AtletaDoc | null>(null);
  const [corrigindoVinculo, setCorrigindoVinculo] = useState<AtletaDoc | null>(null);
  const [salvandoIds, setSalvandoIds] = useState<Set<string>>(new Set());
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSincronizacao, setResultadoSincronizacao] =
    useState<ResultadoSincronizacao | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "atletas"), (snap) => {
      setStaff(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
          .filter((a) => Boolean(a.authUid)),
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
    setSalvandoIds((prev) => new Set(prev).add(pessoa.id));
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
        novaEquipe === "comite" || novaEquipe === "nenhuma"
          ? `${pessoa.nome.split(" ")[0]} não compete mais no programa.`
          : `${pessoa.nome.split(" ")[0]} agora também compete em ${novaEquipe === "bicicleta" ? "Bicicleta" : "Corrida"}.`,
      );
    } catch {
      show("error", "Não foi possível atualizar agora. Tente novamente.");
    } finally {
      setSalvandoIds((prev) => {
        const next = new Set(prev);
        next.delete(pessoa.id);
        return next;
      });
    }
  }

  const totalAdministradores = useMemo(
    () => staff?.filter((s) => s.role === "administrador").length ?? 0,
    [staff],
  );

  async function handleSincronizarContas() {
    const user = auth.currentUser;
    if (!user) {
      show("error", "Sua sessão terminou. Entre novamente para continuar.");
      return;
    }

    setSincronizando(true);
    setResultadoSincronizacao(null);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin/sincronizar-solicitacoes", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as ResultadoSincronizacao & { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível sincronizar as contas.");

      setResultadoSincronizacao(data);
      show(
        "success",
        data.adicionadas > 0
          ? `${data.adicionadas} conta(s) enviada(s) para aprovação.`
          : "Todas as contas já estavam tratadas.",
      );
    } catch (error) {
      show(
        "error",
        error instanceof Error ? error.message : "Não foi possível sincronizar as contas.",
      );
    } finally {
      setSincronizando(false);
    }
  }

  async function handleChangeRole(pessoa: AtletaDoc, novaRole: Role) {
    if (pessoa.role === "administrador" && novaRole !== "administrador" && totalAdministradores <= 1) {
      show("error", "Não é possível remover o último administrador do programa.");
      return;
    }
    setSalvandoIds((prev) => new Set(prev).add(pessoa.id));
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
    } finally {
      setSalvandoIds((prev) => {
        const next = new Set(prev);
        next.delete(pessoa.id);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/20 bg-primary-subtle/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CloudDownload className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-text">Sincronizar contas do Firebase</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-light">
                Localiza contas ainda sem vínculo e cria os pedidos pendentes automaticamente,
                sem depender de um novo acesso do atleta.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full shrink-0 sm:w-auto"
            onClick={handleSincronizarContas}
            loading={sincronizando}
          >
            <CloudDownload className="size-4" aria-hidden="true" />
            Sincronizar contas
          </Button>
        </div>

        {resultadoSincronizacao && (
          <div
            className="mt-4 grid grid-cols-2 gap-2 border-t border-primary/15 pt-4 text-xs sm:grid-cols-4"
            aria-live="polite"
          >
            <p className="rounded-[var(--radius-sm)] bg-bg-card px-3 py-2 text-text-light">
              <strong className="block text-base text-primary">{resultadoSincronizacao.adicionadas}</strong>
              adicionadas
            </p>
            <p className="rounded-[var(--radius-sm)] bg-bg-card px-3 py-2 text-text-light">
              <strong className="block text-base text-text">{resultadoSincronizacao.jaVinculadas}</strong>
              já vinculadas
            </p>
            <p className="rounded-[var(--radius-sm)] bg-bg-card px-3 py-2 text-text-light">
              <strong className="block text-base text-text">{resultadoSincronizacao.jaSolicitadas}</strong>
              já solicitadas
            </p>
            <p className="rounded-[var(--radius-sm)] bg-bg-card px-3 py-2 text-text-light">
              <strong className="block text-base text-text">{resultadoSincronizacao.total}</strong>
              contas analisadas
            </p>
          </div>
        )}
      </Card>

      <p className="text-sm text-text-light">
        {staff === null ? "Carregando…" : `${staff.length} usuários com acesso ao portal.`}
      </p>

      {staff === null ? (
        <Card className="h-40 animate-pulse" />
      ) : staff.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Nenhum usuário com acesso"
            description="As pessoas aparecem aqui assim que o login é vinculado a um cadastro."
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
              <div className="flex flex-wrap items-center gap-2">
                {pessoa.id === adminAtleta.id && <Badge tone="primary">Você</Badge>}
                <Badge tone="neutral">
                  {pessoa.role ? roleLabel[pessoa.role] : "Sem perfil"}
                </Badge>
                <Badge tone="neutral">
                  {pessoa.equipe === "bicicleta"
                    ? "Atleta · Bicicleta"
                    : pessoa.equipe === "corrida"
                      ? "Atleta · Corrida"
                      : pessoa.equipe === "fila_bicicleta"
                        ? "Fila · Bicicleta"
                        : pessoa.equipe === "fila_corrida"
                          ? "Fila · Corrida"
                          : "Não compete"}
                </Badge>
              </div>
              <Select
                value={pessoa.role ?? ""}
                disabled={pessoa.id === adminAtleta.id || salvandoIds.has(pessoa.id)}
                onChange={(e) => handleChangeRole(pessoa, e.target.value as Role)}
              >
                <option value="atleta">Atleta</option>
                <option value="comite">Comitê</option>
                <option value="administrador">Administrador</option>
              </Select>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-light">Participação no programa</label>
                <Select
                  value={
                    pessoa.equipe === "bicicleta" || pessoa.equipe === "corrida"
                      ? pessoa.equipe
                      : "nao_compete"
                  }
                  disabled={salvandoIds.has(pessoa.id)}
                  onChange={(e) => {
                    const valor = e.target.value;
                    const novaEquipe: Equipe =
                      valor === "nao_compete"
                        ? pessoa.role === "atleta"
                          ? "nenhuma"
                          : "comite"
                        : (valor as Equipe);
                    handleChangeEquipe(pessoa, novaEquipe);
                  }}
                >
                  <option value="nao_compete">Não compete</option>
                  <option value="bicicleta">Atleta · Bicicleta</option>
                  <option value="corrida">Atleta · Corrida</option>
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
