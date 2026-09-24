"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bike,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Footprints,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import type {
  DocumentoProgramaDoc,
  DocumentoProgramaId,
  Modalidade,
  TipoDocumentoPrograma,
} from "@/lib/types";

interface DocumentoConfig
  extends Omit<DocumentoProgramaDoc, "atualizadoEm"> {
  atualizadoEm?: string | null;
}

interface AceiteDocumento {
  uid: string;
  atletaId: string;
  nome: string;
  email: string;
  documentoId: DocumentoProgramaId;
  modalidade: Modalidade;
  tipo: TipoDocumentoPrograma;
  titulo: string;
  versao: number;
  aceitoEm: string | null;
}

const DOCUMENTOS: Record<
  Modalidade,
  Array<{ id: DocumentoProgramaId; tipo: TipoDocumentoPrograma; label: string }>
> = {
  corrida: [
    { id: "corrida_regulamento", tipo: "regulamento", label: "Regulamento" },
    {
      id: "corrida_termo_responsabilidade",
      tipo: "termo_responsabilidade",
      label: "Termo de responsabilidade",
    },
  ],
  bicicleta: [
    { id: "bicicleta_regulamento", tipo: "regulamento", label: "Regulamento" },
    {
      id: "bicicleta_termo_responsabilidade",
      tipo: "termo_responsabilidade",
      label: "Termo de responsabilidade",
    },
  ],
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

function documentoAlterado(atual: DocumentoConfig, salvo: DocumentoConfig | undefined) {
  if (!salvo) return false;
  return (
    atual.titulo.trim() !== salvo.titulo ||
    atual.conteudo.trim() !== salvo.conteudo ||
    atual.ativo !== salvo.ativo
  );
}

export function TermosProgramaTab() {
  const { show } = useToast();
  const [documentos, setDocumentos] = useState<DocumentoConfig[]>([]);
  const [salvos, setSalvos] = useState<DocumentoConfig[]>([]);
  const [aceites, setAceites] = useState<AceiteDocumento[]>([]);
  const [modalidade, setModalidade] = useState<Modalidade>("corrida");
  const [tipo, setTipo] = useState<TipoDocumentoPrograma>("regulamento");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const body = await apiAutenticada("/api/admin/termos");
      const configs = (body.documentos || []) as DocumentoConfig[];
      setDocumentos(configs);
      setSalvos(configs);
      setAceites((body.aceites || []) as AceiteDocumento[]);
    } catch (error) {
      show(
        "error",
        error instanceof Error ? error.message : "Não foi possível carregar os documentos.",
      );
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(timeout);
  }, [carregar]);

  const metaSelecionado = DOCUMENTOS[modalidade].find((item) => item.tipo === tipo)!;
  const documento = documentos.find((item) => item.id === metaSelecionado.id);
  const salvo = salvos.find((item) => item.id === metaSelecionado.id);
  const alterado = documento && salvo ? documentoAlterado(documento, salvo) : false;
  const idsAlterados = useMemo(
    () =>
      new Set(
        documentos
          .filter((item) => documentoAlterado(item, salvos.find((salvoItem) => salvoItem.id === item.id)))
          .map((item) => item.id),
      ),
    [documentos, salvos],
  );
  const aceitesSelecionados = useMemo(
    () => aceites.filter((aceite) => aceite.documentoId === metaSelecionado.id),
    [aceites, metaSelecionado.id],
  );
  const aceitesVersaoAtual = documento
    ? aceitesSelecionados.filter((aceite) => aceite.versao === documento.versao).length
    : 0;

  useEffect(() => {
    if (idsAlterados.size === 0) return;
    const avisarSaida = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", avisarSaida);
    return () => window.removeEventListener("beforeunload", avisarSaida);
  }, [idsAlterados]);

  function atualizarDocumento(patch: Partial<DocumentoConfig>) {
    setDocumentos((atuais) =>
      atuais.map((item) => (item.id === metaSelecionado.id ? { ...item, ...patch } : item)),
    );
  }

  async function salvar() {
    if (!documento) return;
    if (!documento.titulo.trim()) {
      show("info", "Informe o título do documento.");
      return;
    }
    if (documento.ativo && documento.conteudo.trim().length < 20) {
      show("info", "Inclua o texto completo antes de ativar o documento.");
      return;
    }

    setSaving(true);
    try {
      const body = await apiAutenticada("/api/admin/termos", {
        method: "PUT",
        body: JSON.stringify({
          id: documento.id,
          titulo: documento.titulo,
          conteudo: documento.conteudo,
          ativo: documento.ativo,
        }),
      });
      const atualizado = body.documento as DocumentoConfig;
      setDocumentos((atuais) =>
        atuais.map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
      setSalvos((atuais) =>
        atuais.map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
      show(
        "success",
        body.novaVersao === true
          ? `Nova versão ${atualizado.versao} publicada.`
          : "Configuração do documento atualizada.",
      );
    } catch (error) {
      show("error", error instanceof Error ? error.message : "Não foi possível salvar agora.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card className="h-96 animate-pulse" />;
  if (!documento || !salvo) {
    return (
      <Card>
        <p className="text-sm text-danger">
          A configuração dos documentos não pôde ser carregada. Atualize a página e tente novamente.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/20">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-bold text-text">Documentos e aceites do programa</h3>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-light">
                Regulamento e termo de responsabilidade são independentes por modalidade. Uma nova
                versão exige novo aceite somente do documento alterado.
              </p>
            </div>
          </div>

          <SegmentedControl
            value={modalidade}
            onChange={(value) => setModalidade(value)}
            options={[
              { value: "corrida", label: "Corrida", icon: Footprints },
              { value: "bicicleta", label: "Mountain Bike", icon: Bike },
            ]}
            className="w-full sm:w-fit"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            {DOCUMENTOS[modalidade].map((item) => {
              const config = documentos.find((documentoItem) => documentoItem.id === item.id);
              const selecionado = tipo === item.tipo;
              const sujo = idsAlterados.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTipo(item.tipo)}
                  aria-pressed={selecionado}
                  className={`min-h-16 cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selecionado
                      ? "border-primary bg-primary-subtle"
                      : "border-border bg-bg-card hover:border-primary/40"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-bold text-text">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-text-light">
                        Versão {config?.versao || 1} · {config?.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </span>
                    {sujo ? (
                      <span className="rounded-full bg-warning/15 px-2 py-1 text-[11px] font-bold text-warning">
                        Não salvo
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <FileCheck2 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-text">{metaSelecionado.label}</h3>
                  <span className="rounded-full bg-bg-inset px-2.5 py-1 text-xs font-bold text-text-light">
                    Versão {documento.versao}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-light">
                  {modalidade === "corrida" ? "Corrida" : "Mountain Bike"}
                </p>
              </div>
            </div>

            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-4 sm:min-w-56">
              <span>
                <span className="block text-sm font-bold text-text">Exigir aceite</span>
                <span className="block text-xs text-text-light">
                  {documento.ativo ? "Ativado" : "Desativado"}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-label={`Exigir aceite de ${metaSelecionado.label}`}
                aria-checked={documento.ativo}
                onClick={() => atualizarDocumento({ ativo: !documento.ativo })}
                className="flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    documento.ativo ? "bg-success" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform ${
                      documento.ativo ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>
            </label>
          </div>

          <TextField
            label="Título"
            value={documento.titulo}
            maxLength={160}
            onChange={(event) => atualizarDocumento({ titulo: event.target.value })}
          />

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="conteudo-documento" className="text-sm font-medium text-text">
                Texto completo
              </label>
              <span className="text-xs text-text-muted">
                {documento.conteudo.length.toLocaleString("pt-BR")} / 50.000
              </span>
            </div>
            <textarea
              id="conteudo-documento"
              value={documento.conteudo}
              onChange={(event) => atualizarDocumento({ conteudo: event.target.value })}
              rows={16}
              maxLength={50000}
              className="w-full resize-y rounded-[var(--radius)] border border-border bg-bg px-4 py-3 text-base leading-6 text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:text-sm"
            />
          </div>

          {alterado && (documento.titulo.trim() !== salvo.titulo || documento.conteudo.trim() !== salvo.conteudo) ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-text">
              Salvar alterações no título ou texto criará a versão {salvo.versao + 1}. Os atletas
              desta modalidade precisarão aceitar novamente apenas este documento.
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-text-light">
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              Nome, e-mail, conteúdo, versão, hash e horário ficam registrados.
            </p>
            <Button onClick={salvar} loading={saving} disabled={!alterado}>
              {!saving ? <Save className="size-4" aria-hidden="true" /> : null}
              Salvar documento
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-text">
              <Users className="size-5 text-primary" aria-hidden="true" />
              Aceites de {metaSelecionado.label.toLowerCase()}
            </h3>
            <p className="mt-1 text-sm text-text-light">
              {aceitesVersaoAtual} aceite(s) na versão atual · {aceitesSelecionados.length} registro(s)
              mais recente(s).
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void carregar()}
            disabled={idsAlterados.size > 0}
            title={
              idsAlterados.size > 0
                ? "Salve as alterações antes de atualizar os registros."
                : undefined
            }
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Atualizar
          </Button>
        </div>

        {aceitesSelecionados.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
            <CheckCircle2 className="mx-auto size-7 text-text-muted" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-text">Nenhum aceite registrado</p>
            <p className="mt-1 text-xs text-text-light">
              Os registros aparecerão após os atletas acessarem o portal.
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
              {aceitesSelecionados.map((aceite) => (
                <li
                  key={`${aceite.uid}-${aceite.documentoId}`}
                  className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_90px_150px] md:items-center md:gap-4"
                >
                  <span className="truncate font-semibold text-text">{aceite.nome}</span>
                  <span className="truncate text-text-light">
                    {aceite.email || "E-mail indisponível"}
                  </span>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
                      aceite.versao === documento.versao
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
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
