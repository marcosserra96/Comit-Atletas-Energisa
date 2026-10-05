"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOff, CheckCircle2, Keyboard, Loader2, QrCode, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatPontos } from "@/lib/format";
import { normalizarCodigo } from "@/lib/reunioes";

export interface ResultadoCheckin {
  status: "confirmada" | "ja_confirmada";
  titulo: string;
  pontos?: number;
}

/** Chama o servidor, que confere horário, código e duplicidade. */
export async function confirmarPresenca(eventoId: string, codigo: string): Promise<ResultadoCheckin> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sua sessão expirou. Entre novamente.");
  const token = await user.getIdToken();
  const resposta = await fetch("/api/reunioes/checkin", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ eventoId, codigo }),
  });
  const corpo = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resposta.ok) {
    throw new Error(typeof corpo.error === "string" ? corpo.error : "Não foi possível confirmar agora.");
  }
  return corpo as unknown as ResultadoCheckin;
}

/** Conteúdo lido no QR: o endereço do portal (/presenca/{id}?c=...) ou só o código. */
export function lerConteudoQr(texto: string): { eventoId?: string; codigo: string } | null {
  const bruto = texto.trim();
  try {
    const url = new URL(bruto);
    const partes = url.pathname.split("/").filter(Boolean);
    const i = partes.indexOf("presenca");
    const codigo = url.searchParams.get("c") ?? "";
    if (i >= 0 && partes[i + 1] && codigo) return { eventoId: partes[i + 1], codigo };
    return null;
  } catch {
    const codigo = normalizarCodigo(bruto);
    return codigo.length >= 6 ? { codigo } : null;
  }
}

/** Câmera traseira + leitura do QR quadro a quadro. */
function LeitorQr({ onLido, onFechar }: { onLido: (texto: string) => void; onFechar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let parado = false;
    let quadro = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function ler() {
      if (parado) return;
      const video = videoRef.current;
      if (video && ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        // Reduz a imagem: leitura mais rápida em celular simples.
        const escala = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * escala);
        canvas.height = Math.round(video.videoHeight * escala);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const achado = jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: "dontInvert" });
        if (achado?.data) {
          parado = true;
          onLido(achado.data);
          return;
        }
      }
      quadro = requestAnimationFrame(ler);
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      // Sem câmera disponível neste navegador: mostra a alternativa de digitar.
      queueMicrotask(() => setErro("Este navegador não libera a câmera. Digite o código mostrado na tela."));
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        if (parado) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        void video.play();
        quadro = requestAnimationFrame(ler);
      })
      .catch(() =>
        setErro("Não conseguimos abrir a câmera. Libere o acesso nas configurações do navegador ou digite o código."),
      );

    return () => {
      parado = true;
      cancelAnimationFrame(quadro);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onLido]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-lg)] bg-black">
        {erro ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/80">
            <CameraOff className="size-8" aria-hidden="true" />
            {erro}
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </>
        )}
      </div>
      <p className="text-center text-sm text-text-light">Aponte para o QR code da reunião.</p>
      <Button variant="ghost" onClick={onFechar}>
        <X className="size-4" />
        Cancelar
      </Button>
    </div>
  );
}

type Estado =
  | { tipo: "inicio" }
  | { tipo: "lendo" }
  | { tipo: "digitando" }
  | { tipo: "enviando" }
  | { tipo: "pronto"; resultado: ResultadoCheckin }
  | { tipo: "erro"; mensagem: string };

/**
 * Fluxo de confirmação: escanear (câmera no próprio portal) ou digitar o código.
 * Com `codigoInicial` (veio do QR lido pela câmera do celular), envia sozinho.
 */
export function ConfirmarPresenca({
  eventoId,
  codigoInicial,
  onConcluido,
}: {
  eventoId: string;
  codigoInicial?: string;
  onConcluido?: (r: ResultadoCheckin) => void;
}) {
  const [estado, setEstado] = useState<Estado>(codigoInicial ? { tipo: "enviando" } : { tipo: "inicio" });
  const [codigo, setCodigo] = useState("");
  const enviadoInicial = useRef(false);

  const enviar = useCallback(
    async (valor: string) => {
      setEstado({ tipo: "enviando" });
      try {
        const resultado = await confirmarPresenca(eventoId, valor);
        setEstado({ tipo: "pronto", resultado });
        onConcluido?.(resultado);
      } catch (e) {
        setEstado({ tipo: "erro", mensagem: e instanceof Error ? e.message : "Não foi possível confirmar agora." });
      }
    },
    [eventoId, onConcluido],
  );

  useEffect(() => {
    if (!codigoInicial || enviadoInicial.current) return;
    enviadoInicial.current = true;
    void enviar(codigoInicial);
  }, [codigoInicial, enviar]);

  const aoLer = useCallback(
    (texto: string) => {
      const lido = lerConteudoQr(texto);
      if (!lido) return setEstado({ tipo: "erro", mensagem: "Esse QR code não é de uma reunião do programa." });
      if (lido.eventoId && lido.eventoId !== eventoId) {
        return setEstado({ tipo: "erro", mensagem: "Esse QR code é de outra reunião." });
      }
      void enviar(lido.codigo);
    },
    [enviar, eventoId],
  );

  if (estado.tipo === "lendo") return <LeitorQr onLido={aoLer} onFechar={() => setEstado({ tipo: "inicio" })} />;

  if (estado.tipo === "enviando") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-text-light">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
        Confirmando sua presença…
      </div>
    );
  }

  if (estado.tipo === "pronto") {
    const { resultado } = estado;
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <p className="text-lg font-bold text-text">
          {resultado.status === "confirmada" ? "Presença confirmada!" : "Sua presença já estava confirmada"}
        </p>
        <p className="text-sm text-text-light">
          {resultado.titulo}
          {resultado.status === "confirmada" && resultado.pontos
            ? ` · +${formatPontos(resultado.pontos)} pontos no ranking`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {estado.tipo === "erro" ? (
        <p role="alert" className="rounded-[var(--radius)] border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">
          {estado.mensagem}
        </p>
      ) : null}
      {estado.tipo === "digitando" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (normalizarCodigo(codigo).length >= 6) void enviar(codigo);
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Código da reunião</span>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ex: AB3 K9Z"
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={9}
              className="h-14 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-center font-mono text-2xl font-bold tracking-[0.2em] text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <Button type="submit" disabled={normalizarCodigo(codigo).length < 6}>
            Confirmar presença
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEstado({ tipo: "inicio" })}>
            Voltar
          </Button>
        </form>
      ) : (
        <div className={cn("flex flex-col gap-2")}>
          <Button onClick={() => setEstado({ tipo: "lendo" })}>
            <QrCode className="size-4" />
            Escanear QR code
          </Button>
          <Button variant="secondary" onClick={() => setEstado({ tipo: "digitando" })}>
            <Keyboard className="size-4" />
            Digitar o código
          </Button>
        </div>
      )}
    </div>
  );
}
