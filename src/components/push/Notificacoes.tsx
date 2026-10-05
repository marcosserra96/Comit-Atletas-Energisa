"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellOff, BellRing, CheckCircle2, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { usePush, type EstadoPush } from "@/lib/push/cliente";
import { useInstalacao } from "@/lib/pwa/instalacao";

const CHAVE_CONVITE = "push-convite-dispensado-em";
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

function conviteDispensado() {
  try {
    return Date.now() - Number(localStorage.getItem(CHAVE_CONVITE) ?? 0) < TRINTA_DIAS;
  } catch {
    return false;
  }
}

const O_QUE_CHEGA = "Reunião começando, pesquisa nova e recados do comitê, mesmo com o app fechado.";

/** Como liberar de novo depois de bloquear (depende do aparelho). */
function ComoDesbloquear() {
  const { aparelho } = useInstalacao();
  return (
    <p className="text-sm text-text-light">
      {aparelho === "iphone"
        ? "Você bloqueou neste aparelho. Para liberar: Ajustes → Notificações → Atletas → Permitir Notificações."
        : aparelho === "android"
          ? "Você bloqueou neste aparelho. Para liberar: toque no cadeado ao lado do endereço → Permissões → Notificações → Permitir."
          : "Você bloqueou neste navegador. Clique no cadeado ao lado do endereço e permita as notificações."}
    </p>
  );
}

/**
 * Convite no Início: aparece para quem ainda não ativou (e não bloqueou),
 * some por 30 dias em "Agora não".
 */
export function ConviteNotificacoes({ className }: { className?: string }) {
  const { estado, ativar, ocupado, erro } = usePush();
  const [dispensado, setDispensado] = useState(false);
  const [ativou, setAtivou] = useState(false);

  if (ativou && estado === "ativo") {
    return (
      <Card className={cn("flex items-center gap-3", className)} role="status">
        <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden="true" />
        <p className="text-sm font-semibold text-text">Pronto! Os avisos vão chegar neste celular.</p>
      </Card>
    );
  }
  if ((estado !== "desligado" && estado !== "precisa_instalar") || dispensado || conviteDispensado()) return null;

  function agoraNao() {
    try {
      localStorage.setItem(CHAVE_CONVITE, String(Date.now()));
    } catch {
      // some só nesta visita
    }
    setDispensado(true);
  }

  return (
    <Card className={cn("flex flex-col gap-4 sm:flex-row sm:items-center", className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary-subtle text-primary">
          <BellRing className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-text">Receba os avisos no celular</p>
          <p className="mt-0.5 text-sm text-text-light">
            {estado === "precisa_instalar"
              ? "No iPhone, os avisos chegam com o app na Tela de Início. Leva menos de um minuto."
              : O_QUE_CHEGA}
          </p>
          {erro ? <p className="mt-1 text-sm font-medium text-danger">{erro}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 sm:flex-col">
        {estado === "precisa_instalar" ? (
          <Link
            href="/instalar"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
          >
            <Smartphone className="size-4" aria-hidden="true" />
            Instalar o app
          </Link>
        ) : (
          <Button
            className="flex-1"
            loading={ocupado}
            onClick={async () => {
              await ativar();
              setAtivou(true);
            }}
          >
            <Bell className="size-4" />
            Ativar avisos
          </Button>
        )}
        <Button variant="ghost" className="flex-1" onClick={agoraNao}>
          Agora não
        </Button>
      </div>
    </Card>
  );
}

const TEXTO_ESTADO: Record<EstadoPush, string> = {
  carregando: "Verificando…",
  indisponivel: "Este navegador não recebe notificações. Abra o portal no Chrome (Android) ou instale o app (iPhone).",
  precisa_instalar: "No iPhone, os avisos chegam com o app instalado na Tela de Início.",
  desligado: O_QUE_CHEGA,
  negado: "",
  ativo: "Ativadas neste aparelho. " + O_QUE_CHEGA,
};

/** Cartão do Perfil: ligar, desligar e o que fazer quando está bloqueado. */
export function PreferenciaNotificacoes() {
  const { estado, ativar, desativar, ocupado, erro } = usePush();
  const ativo = estado === "ativo";
  const Icone = ativo ? BellRing : estado === "negado" ? BellOff : Bell;

  return (
    <Card id="notificacoes" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            ativo ? "bg-success/10 text-success" : "bg-primary-subtle text-primary",
          )}
        >
          <Icone className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-text">Notificações no celular</p>
          {estado === "negado" ? <ComoDesbloquear /> : <p className="mt-0.5 text-sm text-text-light">{TEXTO_ESTADO[estado]}</p>}
          {erro ? <p className="mt-1 text-sm font-medium text-danger">{erro}</p> : null}
        </div>
      </div>
      {estado === "desligado" ? (
        <Button onClick={() => void ativar()} loading={ocupado}>
          <Bell className="size-4" />
          Ativar notificações
        </Button>
      ) : estado === "ativo" ? (
        <Button variant="secondary" onClick={() => void desativar()} loading={ocupado}>
          <BellOff className="size-4" />
          Desativar neste aparelho
        </Button>
      ) : estado === "precisa_instalar" ? (
        <Link
          href="/instalar"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 text-sm font-bold text-on-primary transition-colors hover:bg-primary-hover"
        >
          <Smartphone className="size-4" aria-hidden="true" />
          Instalar o app
        </Link>
      ) : null}
    </Card>
  );
}
