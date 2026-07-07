"use client";

import { useState } from "react";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Mail, Clock, Link2, UserPlus } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { logAudit } from "@/lib/audit";
import { formatRelativeTime } from "@/lib/format";
import { equipeLabel } from "@/lib/labels";
import { RejectRequestModal } from "./RejectRequestModal";
import type { AtletaDoc, Role, SolicitacaoAcessoDoc } from "@/lib/types";

type Caminho = "vincular" | "criar";

const roleOptions: { value: Role; label: string }[] = [
  { value: "atleta", label: "Atleta" },
  { value: "comite", label: "Comitê" },
  { value: "administrador", label: "Administrador" },
];

export function RequestCard({
  solicitacao,
  atletasSemVinculo,
}: {
  solicitacao: SolicitacaoAcessoDoc;
  atletasSemVinculo: AtletaDoc[];
}) {
  const { uid: adminUid, atleta: adminAtleta } = useActiveSession();
  const { show } = useToast();

  const [caminho, setCaminho] = useState<Caminho>(
    atletasSemVinculo.length > 0 ? "vincular" : "criar",
  );
  const [atletaSelecionado, setAtletaSelecionado] = useState("");
  const [roleEscolhida, setRoleEscolhida] = useState<Role | "">("");
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const primeiroNome = solicitacao.nome.split(" ")[0];

  async function handleVincular() {
    if (!atletaSelecionado) {
      show("info", "Selecione um atleta já cadastrado para vincular.");
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "atletas", atletaSelecionado), {
        authUid: solicitacao.uid,
        email: solicitacao.email,
        role: "atleta",
        ativo: true,
        atualizadoEm: serverTimestamp(),
      });
      await setDoc(doc(db, "usuarios", solicitacao.uid), {
        uid: solicitacao.uid,
        role: "atleta",
        atletaId: atletaSelecionado,
        criadoEm: serverTimestamp(),
      });
      await updateDoc(doc(db, "solicitacoes_acesso", solicitacao.uid), {
        status: "vinculado",
        atualizadoEm: serverTimestamp(),
      });
      await logAudit({
        acao: "vincular_acesso",
        entidade: "atletas",
        entidadeId: atletaSelecionado,
        dados: { solicitacaoUid: solicitacao.uid },
        criadoPor: adminUid,
        criadoPorNome: adminAtleta.nome,
      });
      show("success", `${primeiroNome} vinculado(a) ao cadastro existente.`);
    } catch {
      show("error", "Não foi possível vincular agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCriarNovo() {
    if (!roleEscolhida) {
      show("info", "Selecione um perfil antes de criar o cadastro.");
      return;
    }
    setBusy(true);
    try {
      const novoAtleta = doc(collection(db, "atletas"));
      await setDoc(novoAtleta, {
        id: novoAtleta.id,
        nome: solicitacao.nome,
        email: solicitacao.email,
        role: roleEscolhida,
        equipe: roleEscolhida === "atleta" ? "nenhuma" : "comite",
        ativo: true,
        pontuacaoTotal: 0,
        authUid: solicitacao.uid,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
        criadoPor: adminUid,
      });
      await setDoc(doc(db, "usuarios", solicitacao.uid), {
        uid: solicitacao.uid,
        role: roleEscolhida,
        atletaId: novoAtleta.id,
        criadoEm: serverTimestamp(),
      });
      await updateDoc(doc(db, "solicitacoes_acesso", solicitacao.uid), {
        status: "vinculado",
        atualizadoEm: serverTimestamp(),
      });
      await logAudit({
        acao: "criar_perfil_acesso",
        entidade: "atletas",
        entidadeId: novoAtleta.id,
        dados: { solicitacaoUid: solicitacao.uid, role: roleEscolhida },
        criadoPor: adminUid,
        criadoPorNome: adminAtleta.nome,
      });
      show("success", `Perfil de ${roleEscolhida} criado para ${primeiroNome}.`);
    } catch {
      show("error", "Não foi possível criar o perfil agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(motivo: string) {
    try {
      await updateDoc(doc(db, "solicitacoes_acesso", solicitacao.uid), {
        status: "recusado",
        motivoRecusa: motivo,
        atualizadoEm: serverTimestamp(),
      });
      await logAudit({
        acao: "recusar_acesso",
        entidade: "solicitacoes_acesso",
        entidadeId: solicitacao.uid,
        dados: { motivo },
        criadoPor: adminUid,
        criadoPorNome: adminAtleta.nome,
      });
      show("info", `Solicitação de ${primeiroNome} recusada.`);
      setRejectOpen(false);
    } catch {
      show("error", "Não foi possível recusar agora. Tente novamente.");
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {solicitacao.nome.trim().charAt(0).toUpperCase()}
        </span>
        <div>
          <p className="font-semibold text-text">{solicitacao.nome}</p>
          <p className="flex items-center gap-1.5 text-xs text-text-light">
            <Mail className="size-3.5" />
            {solicitacao.email}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <Clock className="size-3.5" />
            Solicitado {formatRelativeTime(solicitacao.criadoEm)}
          </p>
        </div>
      </div>

      <div className="flex gap-2 rounded-[var(--radius)] bg-bg p-1">
        <button
          type="button"
          onClick={() => setCaminho("vincular")}
          disabled={atletasSemVinculo.length === 0}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${
            caminho === "vincular" ? "bg-bg-card text-primary shadow-sm" : "text-text-light"
          }`}
        >
          <Link2 className="size-3.5" />
          Vincular a atleta existente
        </button>
        <button
          type="button"
          onClick={() => setCaminho("criar")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] py-2 text-xs font-semibold transition-colors ${
            caminho === "criar" ? "bg-bg-card text-primary shadow-sm" : "text-text-light"
          }`}
        >
          <UserPlus className="size-3.5" />
          Criar novo perfil
        </button>
      </div>

      {caminho === "vincular" ? (
        atletasSemVinculo.length === 0 ? (
          <p className="text-xs text-text-muted">
            Nenhum atleta pré-cadastrado sem login no momento — use &ldquo;Criar novo
            perfil&rdquo;.
          </p>
        ) : (
          <Select
            placeholder="Selecione o cadastro do atleta"
            value={atletaSelecionado}
            onChange={(e) => setAtletaSelecionado(e.target.value)}
          >
            {atletasSemVinculo.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome} — {equipeLabel[a.equipe]}
              </option>
            ))}
          </Select>
        )
      ) : (
        <Select
          placeholder="Selecione o perfil"
          value={roleEscolhida}
          onChange={(e) => setRoleEscolhida(e.target.value as Role)}
        >
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="danger" onClick={() => setRejectOpen(true)} disabled={busy}>
          Recusar
        </Button>
        <Button
          size="sm"
          onClick={caminho === "vincular" ? handleVincular : handleCriarNovo}
          loading={busy}
        >
          {caminho === "vincular" ? "Vincular" : "Criar perfil"}
        </Button>
      </div>

      <RejectRequestModal
        open={rejectOpen}
        nome={primeiroNome}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
      />
    </Card>
  );
}
