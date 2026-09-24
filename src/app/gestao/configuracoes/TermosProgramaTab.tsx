"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";

interface TermosConfig {
  titulo: string;
  conteudo: string;
  ativo: boolean;
  versao: number;
  atualizadoEm?: string | null;
}

interface AceiteTermos {
  uid: string;
  atletaId: string;
  nome: string;
  email: string;
  versao: number;
  aceitoEm: string | null;
}

const TERMOS_INICIAIS: TermosConfig = {
  titulo: "Termos do Programa",
  conteudo: "",
  ativo: false,
  versao: 0,
};

async function apiAutenticada(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sua sessão foi encerrada. Entre novamente.");
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
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
    throw new Error(typeof body.error === "string" ? body.error : "Não foi possível concluir a ação.");
  }
  return body;
}

function formatarDataHora(valor: string | null | undefined) {
  if (!valor) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor));
}

export function TermosProgramaTab() {
  const { show } = useToast();
  const [termos, setTermos] = useState<TermosConfig>(TERMOS_INICIAIS);
  const [salvo, setSalvo] = useState<TermosConfig>(TERMOS_INICIAIS);
  const [aceites, setAceites] = useState<AceiteTermos[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const body = await apiAutenticada("/api/admin/termos");
      const config = (body.termos || TERMOS_INICIAIS) as TermosConfig;
      setTermos(config);
      setSalvo(config);
      setAceites((body.aceites || []) as AceiteTermos[]);
    } catch (error) {
      show("error", error instanceof Error ? error.message : "Não foi possível carregar os termos.");
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timeout);
  }, [carregar]);

  const textoAlterado = useMemo(
    () => termos.titulo.trim() !== salvo.titulo || termos.conteudo.trim() !== salvo.conteudo,
    [salvo, termos],
  );

  async function salvar() {
    if (!termos.titulo.trim()) {
      show("info", "Informe o título dos termos.");
      return;
    }
    if (termos.ativo && termos.conteudo.trim().length < 20) {
      show("info", "Inclua o texto completo antes de ativar a obrigatoriedade.");
      return;
    }

    setSaving(true);
    try {
      const body = await apiAutenticada("/api/admin/termos", {
        method: "PUT",
        body: JSON.stringify({
          titulo: termos.titulo,
          conteudo: termos.conteudo,
          ativo: termos.ativo,
        }),
      });
      const versao = Number(body.versao) || termos.versao;
      const atualizado = { ...termos, titulo: termos.titulo.trim(), conteudo: termos.conteudo.trim(), versao };
      setTermos(atualizado);
      setSalvo(atualizado);
      show(
        "success",
        body.novaVersao === true
          ? `Nova versão ${versao} salva com sucesso.`
          : "Configuração dos termos atualizada.",
      );
    } catch (error) {
      show("error", error instanceof Error ? error.message : "Não foi possível salvar agora.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card className="h-80 animate-pulse" />;

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/20">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                <FileCheck2 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-text">Termos do programa</h3>
                  <span className="rounded-full bg-bg-inset px-2.5 py-1 text-xs font-bold text-text-light">
                    {termos.versao ? `Versão ${termos.versao}` : "Ainda não publicado"}
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-light">
                  Quando ativo, o atleta precisa aceitar a versão vigente antes de acessar qualquer
                  área do portal.
                </p>
              </div>
            </div>

            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-4 sm:min-w-56">
              <span>
                <span className="block text-sm font-bold text-text">Exigir aceite</span>
                <span className="block text-xs text-text-light">
                  {termos.ativo ? "Ativado" : "Desativado"}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-label="Exigir aceite dos termos"
                aria-checked={termos.ativo}
                onClick={() => setTermos((atual) => ({ ...atual, ativo: !atual.ativo }))}
                className="flex min-h-11 min-w-14 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className={`relative h-7 w-12 rounded-full transition-colors ${termos.ativo ? "bg-success" : "bg-border"}`}>
                  <span className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform ${termos.ativo ? "translate-x-5" : "translate-x-0"}`} />
                </span>
              </button>
            </label>
          </div>

          <TextField
            label="Título"
            value={termos.titulo}
            maxLength={120}
            onChange={(event) => setTermos((atual) => ({ ...atual, titulo: event.target.value }))}
          />

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="conteudo-termos" className="text-sm font-medium text-text">
                Texto completo
              </label>
              <span className="text-xs text-text-muted">{termos.conteudo.length.toLocaleString("pt-BR")} / 50.000</span>
            </div>
            <textarea
              id="conteudo-termos"
              value={termos.conteudo}
              onChange={(event) => setTermos((atual) => ({ ...atual, conteudo: event.target.value }))}
              rows={14}
              maxLength={50000}
              placeholder="Cole aqui o texto dos termos que você enviará. Parágrafos e quebras de linha serão preservados."
              className="w-full resize-y rounded-[var(--radius)] border border-border bg-bg px-4 py-3 text-base leading-6 text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
            />
          </div>

          {textoAlterado && salvo.versao > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-text">
              Salvar alterações no título ou texto criará a versão {salvo.versao + 1}. Todos os
              usuários precisarão aceitar novamente no próximo acesso.
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-text-light">
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              Nome, e-mail, versão e horário são registrados pelo servidor.
            </p>
            <Button onClick={salvar} loading={saving}>
              {!saving && <Save className="size-4" aria-hidden="true" />}
              Salvar configuração
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-text">
              <Users className="size-5 text-primary" aria-hidden="true" />
              Aceites registrados
            </h3>
            <p className="mt-1 text-sm text-text-light">
              {aceites.length} usuário(s) com aceite registrado na versão mais recente de cada um.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void carregar()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Atualizar
          </Button>
        </div>

        {aceites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
            <CheckCircle2 className="mx-auto size-7 text-text-muted" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-text">Nenhum aceite registrado ainda</p>
            <p className="mt-1 text-xs text-text-light">
              Os registros aparecerão aqui após os primeiros acessos.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_90px_150px] gap-4 bg-bg px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-text-muted md:grid">
              <span>Nome</span>
              <span>E-mail</span>
              <span>Versão</span>
              <span>Data e hora</span>
            </div>
            <ul className="divide-y divide-border">
              {aceites.map((aceite) => (
                <li
                  key={aceite.uid}
                  className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_90px_150px] md:items-center md:gap-4"
                >
                  <span className="truncate font-semibold text-text">{aceite.nome}</span>
                  <span className="truncate text-text-light">{aceite.email || "E-mail indisponível"}</span>
                  <span className="w-fit rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-bold text-primary">
                    Versão {aceite.versao}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-text-light">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {formatarDataHora(aceite.aceitoEm)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
