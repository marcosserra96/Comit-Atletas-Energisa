"use client";

import { useActiveSession } from "@/lib/session/SessionProvider";
import { PreferenciaNotificacoes, O_QUE_CHEGA_COMITE } from "@/components/push/Notificacoes";
import { podeReceberAvisoComite, TIPOS_COMITE } from "@/lib/push/automaticos";

/** Minha conta: o comitê também recebe avisos (só dos pedidos que pode resolver). */
export function NotificacoesComiteCard() {
  const { usuario } = useActiveSession();
  const tipos = TIPOS_COMITE.filter((t) => podeReceberAvisoComite(usuario, t as "comite_acesso"));
  return <PreferenciaNotificacoes tipos={tipos} oQueChega={O_QUE_CHEGA_COMITE} rodape="" />;
}
