"use client";

import { useState } from "react";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { AlertTriangle, Mail, Clock, Link2, UserPlus } from "lucide-react";
import { db } from "@/lib/firebase";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { addAuditToBatch } from "@/lib/audit";
import { apiAutenticada } from "@/lib/apiCliente";
import { formatRelativeTime } from "@/lib/format";
import { roleLabel } from "@/lib/labels";
import { RejectRequestModal } from "./RejectRequestModal";
import { SeletorDeCadastro } from "@/components/atletas/SeletorDeCadastro";
import { sugerirPorNome } from "@/lib/semelhancaNome";
import type { AtletaDoc, Role, SolicitacaoAcessoDoc } from "@/lib/types";

type Caminho = "vincular" | "criar";

const roleOptions: { value: Role; label: string }[] = [
  { value: "atleta", label: "Atleta" },
  { value: "comite", label: "Comitê" },
  { value: "administrador", label: "Administrador" },
];

/** Avisa a pessoa no celular (se ela ativou o aviso na tela de espera). Sem esperar: o agendador cobre uma falha. */
function avisarLiberacao(uid: string) {
  void apiAutenticada("/api/acesso/liberado", { method: "POST", body: JSON.stringify({ uid }) }).catch(() => undefined);
}

export function RequestCard({
  solicitacao,
  atletasSemVinculo,
  atletasComLogin = [],
}: {
  solicitacao: SolicitacaoAcessoDoc;
  atletasSemVinculo: AtletaDoc[];
  /** Cadastros que já têm login: dá para trocar o e-mail de acesso deles. */
  atletasComLogin?: AtletaDoc[];
}) {
  const { uid: adminUid, atleta: adminAtleta } = useActiveSession();
  const { show } = useToast();

  const [caminho, setCaminho] = useState<Caminho>(
    atletasSemVinculo.length > 0 ? "vincular" : "criar",
  );
  // Nome praticamente igual e sem empate: já vem marcado (o comitê confirma ao vincular).
  const [atletaSelecionado, setAtletaSelecionado] = useState(() => {
    const [primeira, segunda] = sugerirPorNome(solicitacao, atletasSemVinculo, (a) => a.nome, 2);
    return primeira && primeira.pontuacao >= 0.8 && (!segunda || primeira.pontuacao - segunda.pontuacao >= 0.15)
      ? primeira.item.id
      : "";
  });
  // Incluir quem já tem login: a pessoa quer passar a entrar com outro e-mail.
  const [substituir, setSubstituir] = useState(false);
  const opcoes = substituir ? [...atletasSemVinculo, ...atletasComLogin] : atletasSemVinculo;
  const selecionado = opcoes.find((a) => a.id === atletaSelecionado);
  const loginAntigo = selecionado?.authUid && selecionado.authUid !== solicitacao.uid ? selecionado : null;
  const [roleEscolhida, setRoleEscolhida] = useState<Role>("atleta");

  function escolherCadastro(id: string) {
    setAtletaSelecionado(id);
    // Trocando o login de quem já tem acesso, o perfil continua o mesmo (comitê continua comitê).
    const a = atletasComLogin.find((x) => x.id === id);
    if (a?.role) setRoleEscolhida(a.role);
  }
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const primeiroNome = solicitacao.nome.split(" ")[0];

  async function handleVincular() {
    if (!atletaSelecionado) {
      show("info", "Selecione um atleta já cadastrado para vincular.");
      return;
    }
    if (loginAntigo?.authUid === adminUid) {
      show("info", "Para trocar o seu próprio e-mail de acesso, peça a outro administrador.");
      return;
    }
    setBusy(true);
    try {
      // Só dá para marcar um pedido que já existe (as regras não deixam o comitê criar pedido em nome de outra conta).
      const pedidoAntigo = loginAntigo?.authUid ? await getDoc(doc(db, "solicitacoes_acesso", loginAntigo.authUid)) : null;
      const batch = writeBatch(db);
      if (loginAntigo?.authUid) {
        // O login antigo deixa de abrir o portal: sem usuário, e com um aviso claro se tentar entrar.
        batch.delete(doc(db, "usuarios", loginAntigo.authUid));
        if (pedidoAntigo?.exists()) {
          batch.update(doc(db, "solicitacoes_acesso", loginAntigo.authUid), {
            status: "recusado",
            motivoRecusa: "Seu acesso ao portal passou para outro e-mail. Entre com o e-mail novo.",
            atualizadoEm: serverTimestamp(),
          });
        }
      }
      batch.update(doc(db, "atletas", atletaSelecionado), {
        authUid: solicitacao.uid,
        email: solicitacao.email,
        role: roleEscolhida,
        ativo: true,
        atualizadoEm: serverTimestamp(),
      });
      batch.set(atletaPublicoRef(atletaSelecionado), { ativo: true }, { merge: true });
      batch.set(doc(db, "usuarios", solicitacao.uid), {
        uid: solicitacao.uid,
        role: roleEscolhida,
        atletaId: atletaSelecionado,
        criadoEm: serverTimestamp(),
      });
      batch.update(doc(db, "solicitacoes_acesso", solicitacao.uid), {
        status: "vinculado",
        atualizadoEm: serverTimestamp(),
      });
      addAuditToBatch(batch, {
        acao: loginAntigo ? "substituir_login" : "vincular_acesso",
        entidade: "atletas",
        entidadeId: atletaSelecionado,
        dados: {
          solicitacaoUid: solicitacao.uid,
          role: roleEscolhida,
          ...(loginAntigo ? { loginAntigoUid: loginAntigo.authUid, emailAntigo: loginAntigo.email ?? null, emailNovo: solicitacao.email } : {}),
        },
        criadoPor: adminUid,
        criadoPorNome: adminAtleta.nome,
      });
      await batch.commit();
      avisarLiberacao(solicitacao.uid);
      show(
        "success",
        loginAntigo
          ? `${primeiroNome} agora entra com ${solicitacao.email}. O e-mail antigo não abre mais o portal.`
          : `${primeiroNome} vinculado(a) como ${roleLabel[roleEscolhida]}.`,
      );
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
      const batch = writeBatch(db);
      batch.set(novoAtleta, {
        id: novoAtleta.id,
        nome: solicitacao.nome,
        email: solicitacao.email,
        role: roleEscolhida,
        equipe: roleEscolhida === "atleta" ? "nenhuma" : "comite",
        ativo: true,
        visivelNasListas: true,
        pontuacaoTotal: 0,
        authUid: solicitacao.uid,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
        criadoPor: adminUid,
      });
      batch.set(
        atletaPublicoRef(novoAtleta.id),
        {
          id: novoAtleta.id,
          nome: solicitacao.nome,
          equipe: roleEscolhida === "atleta" ? "nenhuma" : "comite",
          ativo: true,
          visivelNasListas: true,
          pontuacaoTotal: 0,
        },
      );
      batch.set(doc(db, "usuarios", solicitacao.uid), {
        uid: solicitacao.uid,
        role: roleEscolhida,
        atletaId: novoAtleta.id,
        criadoEm: serverTimestamp(),
      });
      batch.update(doc(db, "solicitacoes_acesso", solicitacao.uid), {
        status: "vinculado",
        atualizadoEm: serverTimestamp(),
      });
      addAuditToBatch(batch, {
        acao: "criar_perfil_acesso",
        entidade: "atletas",
        entidadeId: novoAtleta.id,
        dados: { solicitacaoUid: solicitacao.uid, role: roleEscolhida },
        criadoPor: adminUid,
        criadoPorNome: adminAtleta.nome,
      });
      await batch.commit();
      avisarLiberacao(solicitacao.uid);
      show("success", `Perfil de ${roleEscolhida} criado para ${primeiroNome}.`);
    } catch {
      show("error", "Não foi possível criar o perfil agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(motivo: string) {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "solicitacoes_acesso", solicitacao.uid), {
        status: "recusado",
        motivoRecusa: motivo,
        atualizadoEm: serverTimestamp(),
      });
      addAuditToBatch(batch, {
        acao: "recusar_acesso",
        entidade: "solicitacoes_acesso",
        entidadeId: solicitacao.uid,
        dados: { motivo },
        criadoPor: adminUid,
        criadoPorNome: adminAtleta.nome,
      });
      await batch.commit();
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
          disabled={atletasSemVinculo.length === 0 && atletasComLogin.length === 0}
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
        opcoes.length === 0 && atletasComLogin.length === 0 ? (
          <p className="text-xs text-text-muted">
            Nenhum atleta pré-cadastrado sem login no momento — use &ldquo;Criar novo
            perfil&rdquo;.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {atletasComLogin.length > 0 ? (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius)] bg-bg p-3 text-sm">
                <input
                  type="checkbox"
                  checked={substituir}
                  onChange={(e) => {
                    setSubstituir(e.target.checked);
                    if (!e.target.checked && atletasComLogin.some((a) => a.id === atletaSelecionado)) setAtletaSelecionado("");
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
                />
                <span>
                  <span className="font-semibold text-text">Mostrar também quem já tem login</span>
                  <span className="block text-xs text-text-light">Para quando a pessoa quer passar a entrar com outro e-mail.</span>
                </span>
              </label>
            ) : null}
            {opcoes.length === 0 ? (
              <p className="text-xs text-text-muted">Nenhum cadastro sem login. Marque a opção acima para trocar o e-mail de quem já tem acesso.</p>
            ) : (
              <SeletorDeCadastro
                atletas={opcoes}
                valor={atletaSelecionado}
                onChange={escolherCadastro}
                referencia={{ nome: solicitacao.nome, email: solicitacao.email }}
              />
            )}
            {loginAntigo ? (
              <div className="flex items-start gap-2.5 rounded-[var(--radius)] border border-accent/30 bg-accent/5 p-3 text-sm text-text" role="note">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <p className="[text-wrap:pretty]">
                  {loginAntigo.nome.split(" ")[0]} hoje entra com <b>{loginAntigo.email ?? "outro login"}</b>. Ao vincular, o acesso passa para{" "}
                  <b>{solicitacao.email}</b> e o e-mail antigo deixa de abrir o portal. Pontos, histórico e conquistas continuam no mesmo cadastro.
                </p>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-light">Perfil de acesso</label>
              <Select
                value={roleEscolhida}
                onChange={(e) => setRoleEscolhida(e.target.value as Role)}
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
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
          disabled={caminho === "vincular" && !selecionado}
        >
          {caminho === "vincular"
            ? selecionado
              ? loginAntigo
                ? "Trocar o e-mail de acesso"
                : `Vincular a ${selecionado.nome.split(" ").slice(0, 2).join(" ")}`
              : "Escolha o cadastro"
            : "Criar perfil"}
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
