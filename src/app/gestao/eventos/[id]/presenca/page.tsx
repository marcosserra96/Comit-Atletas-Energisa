"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { ArrowLeft, Check, Download, Maximize2, QrCode, RefreshCw, Smartphone, Undo2, UsersRound, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataHoraField } from "@/components/ui/DataHoraField";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { temPermissao } from "@/lib/permissoes";
import { atualizarRankingAutomaticamente } from "@/lib/rankingAutoUpdate";
import { cn } from "@/lib/cn";
import { formatShortDate, plural } from "@/lib/format";
import { horarioDoEvento } from "@/lib/eventos";
import {
  JANELA_CODIGO_MS,
  codigoDinamico,
  gerarCodigoFixo,
  gerarSegredo,
  janelaDoCheckin,
  janelaDoCodigo,
  situacaoCheckin,
  urlDoCheckin,
  type SegredoCheckinDoc,
} from "@/lib/reunioes";
import type { CheckinReuniao, EventoDoc, HistoricoPontoDoc } from "@/lib/types";

const SITUACAO_TEXTO = {
  desligado: "Confirmação pelo app desligada",
  antes: "Confirmação ainda não abriu",
  aberto: "Recebendo confirmações agora",
  encerrado: "Confirmação encerrada",
} as const;

function formatarCodigo(codigo: string) {
  return codigo.length === 6 ? `${codigo.slice(0, 3)} ${codigo.slice(3)}` : codigo;
}

/** Código atual (fixo ou o da janela de 30 s) e quanto falta para trocar. */
function useCodigoAtual(segredo: SegredoCheckinDoc | null, dinamico: boolean) {
  const [agora, setAgora] = useState(() => Date.now());
  const [dinamicoAtual, setDinamicoAtual] = useState<{ janela: number; codigo: string } | null>(null);
  useEffect(() => {
    if (!dinamico) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [dinamico]);
  const janela = janelaDoCodigo(agora);
  useEffect(() => {
    if (!segredo || !dinamico) return;
    let ativo = true;
    codigoDinamico(segredo.segredo, janela).then((codigo) => ativo && setDinamicoAtual({ janela, codigo }));
    return () => {
      ativo = false;
    };
  }, [segredo, dinamico, janela]);
  if (!segredo) return { codigo: "", restanteMs: 0 };
  if (!dinamico) return { codigo: segredo.codigoFixo, restanteMs: 0 };
  return {
    codigo: dinamicoAtual?.janela === janela ? dinamicoAtual.codigo : "",
    restanteMs: JANELA_CODIGO_MS - (agora % JANELA_CODIGO_MS),
  };
}

function useQrDataUrl(conteudo: string, tamanho: number) {
  const [url, setUrl] = useState<{ conteudo: string; dataUrl: string } | null>(null);
  useEffect(() => {
    if (!conteudo) return;
    let ativo = true;
    QRCode.toDataURL(conteudo, { width: tamanho, margin: 2, errorCorrectionLevel: "M", color: { dark: "#07192d", light: "#ffffff" } })
      .then((dataUrl) => ativo && setUrl({ conteudo, dataUrl }))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [conteudo, tamanho]);
  return url?.conteudo === conteudo ? url.dataUrl : "";
}

export default function PresencaReuniaoPage() {
  const { id } = useParams<{ id: string }>();
  const { usuario, uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const podeEventos = temPermissao(usuario, "eventos");
  const podeRegistrar = temPermissao(usuario, "registrar");
  const [evento, setEvento] = useState<EventoDoc | null | undefined>(undefined);
  const [segredo, setSegredo] = useState<SegredoCheckinDoc | null>(null);
  const [presencas, setPresencas] = useState<HistoricoPontoDoc[]>([]);
  const [config, setConfig] = useState<CheckinReuniao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [trocandoCodigo, setTrocandoCodigo] = useState(false);
  const [removendo, setRemovendo] = useState<HistoricoPontoDoc | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!podeEventos) return;
    return onSnapshot(
      doc(db, "agenda_eventos", id),
      (snap) => setEvento(snap.exists() ? ({ id: snap.id, ...snap.data() } as EventoDoc) : null),
      () => setEvento(null),
    );
  }, [podeEventos, id]);

  // Segredo do QR: criado na primeira vez que a tela é aberta.
  useEffect(() => {
    if (!podeEventos) return;
    const ref = doc(db, "reunioes_checkin", id);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) setSegredo(snap.data() as SegredoCheckinDoc);
        else void setDoc(ref, { segredo: gerarSegredo(), codigoFixo: gerarCodigoFixo(), atualizadoEm: serverTimestamp() });
      },
      () => setSegredo(null),
    );
  }, [podeEventos, id]);

  useEffect(() => {
    if (!podeEventos) return;
    return onSnapshot(
      query(collection(db, "historico_pontos"), where("eventoId", "==", id)),
      (snap) =>
        setPresencas(
          snap.docs
            .map((d) => ({ ...(d.data() as HistoricoPontoDoc), id: d.id }))
            .filter((l) => l.tipoLancamento === "reuniao" && !l.estornado)
            .sort((a, b) => a.atletaNome.localeCompare(b.atletaNome, "pt-BR")),
        ),
      () => setPresencas([]),
    );
  }, [podeEventos, id]);

  const configAtual: CheckinReuniao = config ?? evento?.checkin ?? { ativo: true, dinamico: false };
  const janela = evento ? janelaDoCheckin({ ...evento, checkin: configAtual }) : null;
  const situacao = evento ? situacaoCheckin({ ...evento, checkin: configAtual }, new Date(agora)) : "desligado";
  const alterado = config !== null;
  const janelaInvalida = janela !== null && janela.fecha <= janela.abre;

  const { codigo, restanteMs } = useCodigoAtual(segredo, configAtual.dinamico);
  const origem = typeof window === "undefined" ? "" : window.location.origin;
  const conteudoQr = codigo ? urlDoCheckin(origem, id, codigo) : "";
  const qr = useQrDataUrl(conteudoQr, 640);
  const qrGrande = useQrDataUrl(telaCheia ? conteudoQr : "", 1200);
  const viaApp = useMemo(() => presencas.filter((p) => p.origemPresenca === "qrcode").length, [presencas]);

  if (!podeEventos) return <NotAuthorized />;
  if (evento === undefined) return <Card className="h-96 animate-pulse" />;
  if (evento === null || evento.tipo !== "reuniao") {
    return (
      <Card>
        <EmptyState icon={UsersRound} title="Reunião não encontrada" description="Ela pode ter sido removida da agenda." />
      </Card>
    );
  }

  async function salvarConfig() {
    if (janelaInvalida) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, "agenda_eventos", id), {
        checkin: {
          ativo: configAtual.ativo,
          dinamico: configAtual.dinamico,
          ...(configAtual.abreEm ? { abreEm: configAtual.abreEm } : {}),
          ...(configAtual.fechaEm ? { fechaEm: configAtual.fechaEm } : {}),
        },
        atualizadoEm: serverTimestamp(),
      });
      setConfig(null);
      show("success", "Configuração da presença salva.");
    } catch {
      show("error", "Não foi possível salvar agora.");
    } finally {
      setSalvando(false);
    }
  }

  async function trocarCodigo() {
    await setDoc(doc(db, "reunioes_checkin", id), {
      segredo: gerarSegredo(),
      codigoFixo: gerarCodigoFixo(),
      atualizadoEm: serverTimestamp(),
    });
    setTrocandoCodigo(false);
    show("success", "Novo código gerado. O QR anterior parou de valer.");
  }

  async function removerPresenca() {
    if (!removendo) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "historico_pontos", removendo.id), {
        estornado: true,
        estornadoEm: serverTimestamp(),
        estornadoPor: uid,
        motivoEstorno: `Presença removida por ${autor.nome}`,
      });
      if (removendo.pontos > 0) {
        batch.update(doc(db, "atletas", removendo.atletaId), {
          pontuacaoTotal: increment(-removendo.pontos),
          atualizadoEm: serverTimestamp(),
        });
        batch.set(atletaPublicoRef(removendo.atletaId), { pontuacaoTotal: increment(-removendo.pontos) }, { merge: true });
      }
      await batch.commit();
      await atualizarRankingAutomaticamente([removendo.atletaId], "presenca_removida");
      show("success", "Presença removida.");
      setRemovendo(null);
    } catch {
      show("error", "Não foi possível remover agora.");
    }
  }

  function baixarPng() {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = qr;
    link.download = `qr-presenca-${evento!.titulo.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.png`;
    link.click();
  }

  const segundos = Math.ceil(restanteMs / 1000);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <Link
          href="/gestao/eventos"
          className="mb-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-text-light hover:text-text"
        >
          <ArrowLeft className="size-4" />
          Eventos
        </Link>
        <h1 className="text-2xl font-extrabold text-text">{evento.titulo}</h1>
        <p className="mt-1 text-sm text-text-light">
          {formatShortDate(evento.data)} · {horarioDoEvento(evento)} · {evento.local}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex flex-col items-center gap-4 text-center">
          <div className="flex w-full items-center justify-between gap-3">
            <Badge tone={situacao === "aberto" ? "success" : situacao === "antes" ? "primary" : "neutral"}>
              {SITUACAO_TEXTO[situacao]}
            </Badge>
            <span className="text-sm text-text-light">{plural(presencas.length, "presença", "presenças")}</span>
          </div>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code de presença da reunião ${evento.titulo}`} className="aspect-square w-full max-w-[320px]" />
          ) : (
            <div className="aspect-square w-full max-w-[320px] animate-pulse rounded-[var(--radius-lg)] bg-bg-inset" />
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Código para digitar</p>
            <p className="mt-1 font-mono text-4xl font-black tracking-[0.2em] text-text">{formatarCodigo(codigo) || "······"}</p>
            {configAtual.dinamico ? (
              <div className="mx-auto mt-2 w-48">
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-inset">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                    style={{ width: `${(restanteMs / JANELA_CODIGO_MS) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-text-muted">Muda em {segundos} s</p>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => setTelaCheia(true)} disabled={!qr}>
              <Maximize2 className="size-4" />
              Tela cheia
            </Button>
            <Button variant="secondary" onClick={baixarPng} disabled={!qr || configAtual.dinamico}>
              <Download className="size-4" />
              Baixar QR (PNG)
            </Button>
            {!configAtual.dinamico ? (
              <Button variant="ghost" onClick={() => setTrocandoCodigo(true)}>
                <RefreshCw className="size-4" />
                Gerar novo código
              </Button>
            ) : null}
          </div>
          {configAtual.dinamico ? (
            <p className="text-xs text-text-muted">
              Com o código que muda, o QR só funciona exibido pelo portal (tela cheia ou projetada), não em PowerPoint.
            </p>
          ) : (
            <p className="text-xs text-text-muted">
              O QR e o código só valem dentro do horário de confirmação. Pode colocar o PNG na apresentação.
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <h2 className="font-bold text-text">Confirmação pelo app</h2>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={configAtual.ativo}
                onChange={(e) => setConfig({ ...configAtual, ativo: e.target.checked })}
                className="mt-0.5 size-5 shrink-0 rounded border-border accent-primary"
              />
              <span>
                <span className="font-semibold text-text">Ativa</span>
                <span className="block text-xs text-text-light">
                  Na janela abaixo, o atleta vê o aviso no app e confirma com o QR code ou o código.
                </span>
              </span>
            </label>
            <DataHoraField
              label="Abre em"
              value={janela ? janela.abre.toISOString() : ""}
              onChange={(iso) => setConfig({ ...configAtual, abreEm: iso })}
            />
            <DataHoraField
              label="Fecha em"
              value={janela ? janela.fecha.toISOString() : ""}
              onChange={(iso) => setConfig({ ...configAtual, fechaEm: iso })}
              error={janelaInvalida ? "Precisa ser depois da abertura." : undefined}
            />
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={configAtual.dinamico}
                onChange={(e) => setConfig({ ...configAtual, dinamico: e.target.checked })}
                className="mt-0.5 size-5 shrink-0 rounded border-border accent-primary"
              />
              <span>
                <span className="font-semibold text-text">Código que muda a cada 30 s</span>
                <span className="block text-xs text-text-light">
                  Mais controle: foto do QR enviada no grupo para de valer. Exige exibir pelo portal.
                </span>
              </span>
            </label>
            <div className="flex justify-end gap-2">
              {alterado ? (
                <Button variant="ghost" onClick={() => setConfig(null)}>
                  Descartar
                </Button>
              ) : null}
              <Button onClick={salvarConfig} loading={salvando} disabled={!alterado || janelaInvalida}>
                Salvar
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-0">
            <div className="flex items-center justify-between gap-2 px-5 pt-5">
              <h2 className="font-bold text-text">Presenças</h2>
              <span className="text-xs text-text-light">
                {viaApp} pelo app · {presencas.length - viaApp} manuais
              </span>
            </div>
            {presencas.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-text-muted">Ninguém confirmou ainda. A lista atualiza sozinha.</p>
            ) : (
              <ul className="max-h-96 divide-y divide-border overflow-y-auto">
                {presencas.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-5 py-2.5 text-sm">
                    {p.origemPresenca === "qrcode" ? (
                      <Smartphone className="size-4 shrink-0 text-primary" aria-label="Pelo app" />
                    ) : (
                      <Check className="size-4 shrink-0 text-text-muted" aria-label="Manual" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-text">{p.atletaNome}</span>
                    {podeRegistrar ? (
                      <button
                        type="button"
                        onClick={() => setRemovendo(p)}
                        className="flex size-9 items-center justify-center rounded-[var(--radius)] text-text-muted hover:bg-danger/10 hover:text-danger"
                        aria-label={`Remover presença de ${p.atletaNome}`}
                      >
                        <Undo2 className="size-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/gestao/pontuacao"
              className="border-t border-border px-5 py-3 text-sm font-semibold text-primary hover:underline"
            >
              Marcar presença manual em Lançar pontos → Reunião
            </Link>
          </Card>
        </div>
      </div>

      {telaCheia ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-white p-6 text-center text-[#07192d]"
          role="dialog"
          aria-label="QR code em tela cheia"
        >
          <button
            type="button"
            onClick={() => setTelaCheia(false)}
            className="absolute right-4 top-4 flex size-12 items-center justify-center rounded-full bg-black/5 hover:bg-black/10"
            aria-label="Sair da tela cheia"
          >
            <X className="size-6" />
          </button>
          <p className="text-2xl font-extrabold sm:text-4xl">{evento.titulo}</p>
          <p className="flex items-center gap-2 text-lg sm:text-2xl">
            <QrCode className="size-6" aria-hidden="true" />
            Aponte a câmera do celular ou abra o portal e toque em Escanear QR code
          </p>
          {qrGrande || qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrGrande || qr} alt="QR code de presença" className="aspect-square h-[min(60vh,80vw)]" />
          ) : null}
          <p className="font-mono text-5xl font-black tracking-[0.25em] sm:text-7xl">{formatarCodigo(codigo)}</p>
          <p className={cn("text-xl", configAtual.dinamico ? "" : "opacity-70")}>
            {configAtual.dinamico ? `Muda em ${segundos} s · ` : ""}
            {plural(presencas.length, "presença confirmada", "presenças confirmadas")}
          </p>
        </div>
      ) : null}

      <ConfirmActionModal
        open={trocandoCodigo}
        title="Gerar novo código"
        description="O QR code e o código atuais param de valer na hora. Se já estão numa apresentação, ela precisa do QR novo."
        confirmLabel="Gerar novo código"
        onClose={() => setTrocandoCodigo(false)}
        onConfirm={trocarCodigo}
      />
      <ConfirmActionModal
        open={removendo !== null}
        title="Remover presença"
        description={`Remover a presença de ${removendo?.atletaNome ?? ""}? Os pontos saem do ranking e o atleta não consegue confirmar de novo pelo app.`}
        confirmLabel="Remover presença"
        onClose={() => setRemovendo(null)}
        onConfirm={removerPresenca}
      />
    </div>
  );
}
