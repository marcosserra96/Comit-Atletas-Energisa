"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  CheckCircle2,
  FileCheck2,
  Footprints,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { DocumentoProgramaDoc, Modalidade } from "@/lib/types";

function tipoDocumentoLabel(tipo: DocumentoProgramaDoc["tipo"]) {
  return tipo === "regulamento" ? "Regulamento" : "Termo de responsabilidade";
}

interface TermosAceiteScreenProps {
  documentos: DocumentoProgramaDoc[];
  modalidade: Modalidade;
  nome: string;
  email: string;
  onAceitar: () => Promise<void>;
  onLogout: () => void;
}

export function TermosAceiteScreen({
  documentos,
  modalidade,
  nome,
  email,
  onAceitar,
  onLogout,
}: TermosAceiteScreenProps) {
  const [indice, setIndice] = useState(0);
  const [concordouCom, setConcordouCom] = useState<Set<string>>(() => new Set());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const documento = documentos[indice];
  const ultimo = indice === documentos.length - 1;
  const marcouAtual = documento ? concordouCom.has(documento.id) : false;
  const todosMarcados = documentos.every((item) => concordouCom.has(item.id));
  const ModalidadeIcon = modalidade === "bicicleta" ? Bike : Footprints;
  const modalidadeLabel = modalidade === "bicicleta" ? "Mountain Bike" : "Corrida";

  function alternarConcordancia() {
    if (!documento) return;
    setConcordouCom((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(documento.id)) proximo.delete(documento.id);
      else proximo.add(documento.id);
      return proximo;
    });
  }

  async function aceitar() {
    if (!todosMarcados) return;
    setSalvando(true);
    setErro("");
    try {
      await onAceitar();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar seus aceites. Tente novamente.",
      );
      setSalvando(false);
    }
  }

  if (!documento) return null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-3 py-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] [padding-top:max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-6">
      <section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-bg-card shadow-[var(--shadow-modal)] sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-7 sm:py-4">
          <Image
            src="/logos/logo-comite-colorida.png"
            alt="Atletas Energisa"
            width={154}
            height={48}
            className="h-auto w-[116px] sm:w-[132px]"
            priority
          />
          <span className="flex items-center gap-1.5 rounded-full bg-primary-subtle px-3 py-1.5 text-xs font-bold text-primary">
            <ModalidadeIcon className="size-3.5" aria-hidden="true" />
            {modalidadeLabel}
          </span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary sm:size-11">
              <FileCheck2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                  Primeiro acesso
                </p>
                <span className="text-xs font-semibold text-text-muted">
                  Documento {indice + 1} de {documentos.length}
                </span>
              </div>
              <h1 className="mt-1 text-lg font-extrabold leading-tight text-text sm:text-2xl">
                {documento.titulo}
              </h1>
              <p className="mt-1 text-sm text-text-light">
                Leia e aceite cada documento da sua modalidade para continuar.
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2" aria-label="Progresso dos documentos">
            {documentos.map((item, itemIndice) => {
              const concluido = concordouCom.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndice(itemIndice)}
                  aria-current={itemIndice === indice ? "step" : undefined}
                  className={`min-h-11 cursor-pointer rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    itemIndice === indice
                      ? "border-primary bg-primary-subtle text-primary"
                      : "border-border bg-bg text-text-light hover:border-primary/40"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {concluido ? (
                      <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                    ) : (
                      <span className="flex size-4 items-center justify-center rounded-full border border-current text-[10px]">
                        {itemIndice + 1}
                      </span>
                    )}
                    {tipoDocumentoLabel(item.tipo)}
                  </span>
                </button>
              );
            })}
          </div>

          <article
            tabIndex={0}
            aria-label={`Conteúdo de ${documento.titulo}`}
            className="max-h-[34dvh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-bg p-4 text-base leading-7 text-text sm:max-h-[38dvh] sm:p-5 sm:text-sm sm:leading-6"
          >
            {documento.conteudo}
          </article>

          <div className="mt-3 rounded-xl bg-bg px-4 py-3 text-xs leading-relaxed text-text-light">
            O aceite será registrado para <strong className="text-text">{nome}</strong>
            {email ? <> ({email})</> : null}, com a versão do documento e a data e hora do servidor.
          </div>

          <label className="mt-3 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border px-4 py-3 text-base font-semibold text-text transition-colors hover:border-primary/50 sm:text-sm">
            <input
              type="checkbox"
              checked={marcouAtual}
              onChange={alternarConcordancia}
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]"
            />
            <span>Li e concordo com este {tipoDocumentoLabel(documento.tipo).toLowerCase()}.</span>
          </label>

          {erro ? (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {erro}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-4">
          <Button type="button" variant="ghost" onClick={onLogout} disabled={salvando}>
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </Button>
          <div className="flex gap-2">
            {indice > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIndice((atual) => atual - 1)}
                disabled={salvando}
                className="flex-1 sm:flex-none"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Anterior
              </Button>
            ) : null}
            {!ultimo ? (
              <Button
                type="button"
                onClick={() => setIndice((atual) => atual + 1)}
                disabled={!marcouAtual || salvando}
                className="flex-1 sm:flex-none"
              >
                Próximo
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={aceitar}
                disabled={!todosMarcados}
                loading={salvando}
                className="flex-1 sm:flex-none"
              >
                {!salvando ? <CheckCircle2 className="size-4" aria-hidden="true" /> : null}
                Aceitar e continuar
              </Button>
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}
