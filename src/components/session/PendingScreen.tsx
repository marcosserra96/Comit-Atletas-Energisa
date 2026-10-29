"use client";

import { Bell, BellOff, BellRing, Clock3, LogOut, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { usePush } from "@/lib/push/cliente";

/**
 * Aviso de "acesso liberado" na tela de espera: quem ativa recebe uma
 * notificação neste aparelho assim que o comitê libera, e o aparelho já fica
 * inscrito para os avisos do portal.
 */
function AvisarQuandoLiberar() {
  const { estado, ativar, ocupado, erro } = usePush();
  if (estado === "carregando" || estado === "indisponivel") return null;

  if (estado === "ativo") {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-success/10 p-4 text-left" role="status">
        <BellRing className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <p className="text-sm text-text-secondary">
          <span className="font-semibold text-text">Pronto.</span> Você recebe uma notificação neste aparelho quando o acesso for liberado.
        </p>
      </div>
    );
  }

  if (estado === "negado") {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-bg-inset p-4 text-left">
        <BellOff className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden="true" />
        <p className="text-sm text-text-light">As notificações estão bloqueadas neste navegador. Volte por aqui mais tarde para ver se o acesso já foi liberado.</p>
      </div>
    );
  }

  if (estado === "precisa_instalar") {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-bg-inset p-4 text-left">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm text-text-light">
          Para ser avisado no iPhone, adicione o portal à Tela de Início: toque em <span className="font-semibold text-text">Compartilhar</span> e depois em{" "}
          <span className="font-semibold text-text">Adicionar à Tela de Início</span>. Abra por lá e ative o aviso.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl bg-bg-inset p-4 text-left">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">Quer ser avisado?</p>
          <p className="mt-0.5 text-sm text-text-light">Receba uma notificação neste aparelho assim que o acesso for liberado.</p>
        </div>
      </div>
      <Button className="mt-3 w-full" onClick={() => void ativar()} loading={ocupado}>
        Avisar neste aparelho
      </Button>
      {erro ? <p className="mt-2 text-sm font-medium text-danger">{erro}</p> : null}
    </div>
  );
}

export function PendingScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-bg-card p-9 text-center shadow-xl">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Clock3 className="size-6" />
        </span>
        <h1 className="mb-2 text-lg font-bold text-text">Acesso em análise</h1>
        <p className="mb-6 text-sm leading-relaxed text-text-light">
          Seu cadastro foi enviado para o Comitê. Quando o acesso for liberado, é só entrar por aqui com o mesmo e-mail e senha.
        </p>
        <AvisarQuandoLiberar />
        <Button variant="secondary" className="w-full" onClick={onLogout}>
          <LogOut className="size-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
