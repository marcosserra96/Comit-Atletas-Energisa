"use client";

import { Smartphone, X } from "lucide-react";
import { useQrDataUrl } from "@/lib/useQrDataUrl";

/** QR para abrir o controle no celular, sobre a apresentação. */
export function PainelControleRemoto({ sessao, conectado, erro, onFechar }: { sessao: string; conectado: boolean; erro: string; onFechar: () => void }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/controle/${sessao}` : "";
  const qr = useQrDataUrl(url, 420);
  return (
    <div role="dialog" aria-label="Controle pelo celular" className="absolute bottom-24 right-6 z-10 w-[300px] rounded-2xl bg-white p-4 text-[#07192d] shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center gap-2">
        <Smartphone className="size-4" aria-hidden="true" />
        <p className="text-sm font-bold">Controle pelo celular</p>
        <button type="button" onClick={onFechar} aria-label="Desligar o controle pelo celular" className="ml-auto flex size-8 items-center justify-center rounded-full hover:bg-black/5">
          <X className="size-4" />
        </button>
      </div>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code do controle" className="mx-auto size-52" />
      ) : (
        <div className="mx-auto size-52 animate-pulse rounded-lg bg-black/5" />
      )}
      <p className="mt-2 text-xs leading-snug text-black/60">
        Aponte a câmera do celular e entre com sua conta do comitê. Funciona com o celular em qualquer rede.
      </p>
      <p className={`mt-2 text-xs font-semibold ${erro ? "text-[#c2410c]" : conectado ? "text-[#15803d]" : "text-black/50"}`} role="status">
        {erro || (conectado ? "Celular conectado" : "Esperando o celular…")}
      </p>
    </div>
  );
}
