"use client";

import { useEffect, useState } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  FileCheck2,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Modal } from "@/components/ui/Modal";
import type { DocumentoProgramaDoc, Modalidade } from "@/lib/types";

interface DocumentoConsulta extends DocumentoProgramaDoc {
  aceite: {
    versao: number;
    aceitoEm: string | null;
    atual: boolean;
  } | null;
}

function formatarDataHora(valor: string | null | undefined) {
  if (!valor) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor));
}

export default function DocumentosPage() {
  const { atleta, isPreview } = useAthleteView();
  const [modalidade, setModalidade] = useState<Modalidade | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoConsulta[]>([]);
  const [selecionado, setSelecionado] = useState<DocumentoConsulta | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setLoading(true);
      setErro("");
      try {
        const user = auth.currentUser;
        if (!user) throw new Error("Sua sessão foi encerrada. Entre novamente.");
        const token = await user.getIdToken();
        const query = isPreview ? `?atletaId=${encodeURIComponent(atleta.id)}` : "";
        const response = await fetch(`/api/termos/documentos${query}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const texto = await response.text();
        let body: Record<string, unknown> = {};
        try {
          body = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
        } catch {
          throw new Error("O servidor retornou uma resposta inválida.");
        }
        if (!response.ok) {
          throw new Error(
            typeof body.error === "string" ? body.error : "Não foi possível carregar os documentos.",
          );
        }
        if (!ativo) return;
        setModalidade(
          body.modalidade === "corrida" || body.modalidade === "bicicleta"
            ? body.modalidade
            : null,
        );
        setDocumentos(Array.isArray(body.documentos) ? (body.documentos as DocumentoConsulta[]) : []);
      } catch (error) {
        if (ativo) {
          setErro(
            error instanceof Error ? error.message : "Não foi possível carregar os documentos.",
          );
        }
      } finally {
        if (ativo) setLoading(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [atleta.id, isPreview]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        icon={BookOpenCheck}
        title="Documentos do programa"
        description={
          isPreview
            ? "Consulta dos documentos e aceites vinculados a este atleta."
            : "Consulte a qualquer momento o regulamento e o termo da sua modalidade."
        }
        className="mb-0"
      />

      {erro ? (
        <InlineAlert tone="danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{erro}</span>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        </InlineAlert>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-52 animate-pulse" />
          <Card className="h-52 animate-pulse" />
        </div>
      ) : documentos.length === 0 && !erro ? (
        <Card>
          <div className="py-8 text-center">
            <ScrollText className="mx-auto size-8 text-text-muted" aria-hidden="true" />
            <p className="mt-3 font-bold text-text">Nenhum documento disponível</p>
            <p className="mt-1 text-sm text-text-light">
              {modalidade
                ? "Os documentos da modalidade estão temporariamente indisponíveis."
                : "Este perfil não possui uma modalidade esportiva definida."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {documentos.map((documento) => {
            const Icon = documento.tipo === "regulamento" ? ScrollText : FileCheck2;
            const tipoLabel =
              documento.tipo === "regulamento" ? "Regulamento" : "Termo de responsabilidade";
            return (
              <Card key={documento.id} className="flex h-full flex-col border-primary/10">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <Badge tone={documento.aceite?.atual ? "success" : "warning"}>
                    {documento.aceite?.atual ? (
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    ) : null}
                    {documento.aceite?.atual ? "Aceito" : "Aceite pendente"}
                  </Badge>
                </div>

                <div className="mt-4 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">{tipoLabel}</p>
                  <h2 className="mt-1 text-lg font-extrabold leading-snug text-text">
                    {documento.titulo}
                  </h2>
                  <p className="mt-2 text-sm text-text-light">
                    Versão {documento.versao}
                    {documento.aceite?.aceitoEm
                      ? ` · Aceito em ${formatarDataHora(documento.aceite.aceitoEm)}`
                      : ""}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelecionado(documento)}
                  className="mt-5 w-full"
                >
                  <BookOpenCheck className="size-4" aria-hidden="true" />
                  Ler documento
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={selecionado !== null}
        onClose={() => setSelecionado(null)}
        title={selecionado?.titulo || "Documento do programa"}
        description={selecionado ? `Versão ${selecionado.versao}` : undefined}
        size="lg"
        mobileSheet
      >
        <article
          tabIndex={0}
          className="max-h-[65dvh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-bg p-4 text-base leading-7 text-text sm:p-5 sm:text-sm sm:leading-6"
        >
          {selecionado?.conteudo}
        </article>
        {selecionado?.aceite?.atual ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-text-light">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            Aceite registrado em {formatarDataHora(selecionado.aceite.aceitoEm)}.
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
