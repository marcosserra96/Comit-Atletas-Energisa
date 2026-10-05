"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  Lock,
  MonitorDown,
  RotateCw,
  Share,
  Share2,
  SquarePlus,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { instalarAgora, useInstalacao, type Aparelho } from "@/lib/pwa/instalacao";
import { useQrDataUrl } from "@/lib/useQrDataUrl";

/* ---------- Ilustrações: miniaturas da tela do celular com o botão certo em destaque ---------- */

function Destaque({ children }: { children: ReactNode }) {
  return (
    <span className="relative flex size-9 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary)_25%,transparent)]">
      <span className="absolute inset-0 animate-ping rounded-full bg-primary/30 motion-reduce:hidden" aria-hidden="true" />
      <span className="relative">{children}</span>
    </span>
  );
}

function Moldura({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-[var(--radius)] border border-border bg-bg-inset px-3 py-2.5 text-text-light", className)}
    >
      {children}
    </div>
  );
}

function BarraSafari() {
  return (
    <Moldura>
      <div className="mb-2 flex h-7 items-center justify-center gap-1 rounded-full bg-bg-card text-[11px] text-text-muted">
        <Lock className="size-3" /> atletas-energisa-portal.vercel.app
      </div>
      <div className="flex items-center justify-between px-1">
        <ChevronLeft className="size-5" />
        <ChevronRight className="size-5 opacity-40" />
        <Destaque>
          <Share className="size-[18px]" />
        </Destaque>
        <BookOpen className="size-5" />
        <Ellipsis className="size-5" />
      </div>
    </Moldura>
  );
}

function BarraChromeIphone() {
  return (
    <Moldura>
      <div className="flex items-center gap-2">
        <div className="flex h-8 flex-1 items-center gap-1 rounded-full bg-bg-card px-3 text-[11px] text-text-muted">
          <Lock className="size-3" /> atletas-energisa-portal…
        </div>
        <Destaque>
          <Share className="size-[18px]" />
        </Destaque>
      </div>
    </Moldura>
  );
}

function BarraChromeAndroid() {
  return (
    <Moldura>
      <div className="flex items-center gap-2">
        <div className="flex h-8 flex-1 items-center gap-1 rounded-full bg-bg-card px-3 text-[11px] text-text-muted">
          <Lock className="size-3" /> atletas-energisa-portal…
        </div>
        <RotateCw className="size-4" />
        <Destaque>
          <EllipsisVertical className="size-[18px]" />
        </Destaque>
      </div>
    </Moldura>
  );
}

function ItemDeMenu({ icone, texto }: { icone: ReactNode; texto: string }) {
  return (
    <Moldura className="flex flex-col gap-1.5 py-2">
      <div className="flex items-center justify-between rounded-[var(--radius-sm,6px)] px-2 py-1.5 text-xs opacity-50">
        <span>Copiar</span>
        <Copy className="size-4" />
      </div>
      <div className="flex items-center justify-between rounded-[var(--radius-sm,6px)] bg-bg-card px-2 py-2 text-sm font-semibold text-text ring-2 ring-primary">
        <span>{texto}</span>
        <span className="text-primary">{icone}</span>
      </div>
    </Moldura>
  );
}

function ConfirmarAdicionar() {
  return (
    <Moldura className="flex items-center justify-between text-xs">
      <span>Cancelar</span>
      <span className="font-semibold text-text">Tela de Início</span>
      <span className="rounded-full bg-primary px-2.5 py-1 font-bold text-on-primary">Adicionar</span>
    </Moldura>
  );
}

function IconeNaTela() {
  return (
    <Moldura className="flex items-center gap-4">
      {["", "", ""].map((_, i) => (
        <span key={i} className="size-11 rounded-[12px] bg-border/70" />
      ))}
      <span className="flex flex-col items-center gap-1">
        <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-[12px] ring-2 ring-primary" />
        <span className="text-[10px] font-semibold text-text">Atletas</span>
      </span>
    </Moldura>
  );
}

/* ---------- Passos ---------- */

interface Passo {
  titulo: string;
  texto?: ReactNode;
  ilustracao?: ReactNode;
}

function ListaDePassos({ passos }: { passos: Passo[] }) {
  return (
    <ol className="flex flex-col gap-5">
      {passos.map((p, i) => (
        <li key={p.titulo} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary-subtle text-sm font-black text-primary">
            {i + 1}
          </span>
          <div className="pt-1">
            <p className="font-bold text-text">{p.titulo}</p>
            {p.texto ? <p className="mt-0.5 text-sm text-text-light">{p.texto}</p> : null}
          </div>
          {p.ilustracao ? <div className="col-start-2">{p.ilustracao}</div> : null}
        </li>
      ))}
    </ol>
  );
}

const ULTIMO_PASSO_IPHONE: Passo = {
  titulo: "Abra pelo ícone e entre uma vez",
  texto: "No iPhone, o app pede seu e-mail e senha só na primeira vez que você abrir pelo ícone.",
  ilustracao: <IconeNaTela />,
};

function passosIphone(navegador: string): Passo[] {
  if (navegador === "chrome") {
    return [
      {
        titulo: "Toque em Compartilhar",
        texto: "É o quadrado com a seta para cima, ao lado do endereço, no alto da tela.",
        ilustracao: <BarraChromeIphone />,
      },
      {
        titulo: "Escolha “Adicionar à Tela de Início”",
        texto: "Se não aparecer, role a lista para baixo.",
        ilustracao: <ItemDeMenu texto="Adicionar à Tela de Início" icone={<SquarePlus className="size-4" />} />,
      },
      { titulo: "Toque em Adicionar", ilustracao: <ConfirmarAdicionar /> },
      ULTIMO_PASSO_IPHONE,
    ];
  }
  return [
    {
      titulo: "Toque em Compartilhar",
      texto: (
        <>
          O quadrado com a seta para cima, na barra de baixo. Não achou? Toque em{" "}
          <Ellipsis className="inline size-4 align-text-bottom" aria-label="mais opções" /> primeiro.
        </>
      ),
      ilustracao: <BarraSafari />,
    },
    {
      titulo: "Escolha “Adicionar à Tela de Início”",
      texto: "Se não aparecer, role a lista para baixo.",
      ilustracao: <ItemDeMenu texto="Adicionar à Tela de Início" icone={<SquarePlus className="size-4" />} />,
    },
    { titulo: "Toque em Adicionar", texto: "No canto superior direito.", ilustracao: <ConfirmarAdicionar /> },
    ULTIMO_PASSO_IPHONE,
  ];
}

const PASSOS_ANDROID: Passo[] = [
  {
    titulo: "Toque nos três pontinhos",
    texto: "No canto superior direito do Chrome.",
    ilustracao: <BarraChromeAndroid />,
  },
  {
    titulo: "Escolha “Instalar app”",
    texto: "Em alguns celulares aparece como “Adicionar à tela inicial”.",
    ilustracao: <ItemDeMenu texto="Instalar app" icone={<Download className="size-4" />} />,
  },
  { titulo: "Confirme em Instalar", texto: "O ícone do Atletas aparece na tela inicial.", ilustracao: <IconeNaTela /> },
];

const PASSOS_COMPUTADOR: Passo[] = [
  {
    titulo: "No Chrome ou Edge, clique no ícone de instalar",
    texto: "Fica no fim da barra de endereço (um monitor com uma seta). No Safari do Mac: Arquivo → Adicionar ao Dock.",
    ilustracao: (
      <Moldura className="flex items-center gap-2">
        <div className="flex h-8 flex-1 items-center gap-1 rounded-full bg-bg-card px-3 text-[11px] text-text-muted">
          <Lock className="size-3" /> atletas-energisa-portal.vercel.app
        </div>
        <Destaque>
          <MonitorDown className="size-[18px]" />
        </Destaque>
      </Moldura>
    ),
  },
  { titulo: "Confirme em Instalar", texto: "O portal abre numa janela própria, como um programa." },
];

/* ---------- Navegador de dentro de outro app (WhatsApp, Instagram...) ---------- */

function AbrirNoNavegador({ aparelho, link }: { aparelho: Aparelho; link: string }) {
  const navegador = aparelho === "iphone" ? "Safari" : "Chrome";
  return (
    <Card className="flex flex-col gap-4 border-warning/50 shadow-[inset_4px_0_0_var(--color-warning)]">
      <div>
        <p className="font-bold text-text">Primeiro, abra no {navegador}</p>
        <p className="mt-1 text-sm text-text-light">
          Você abriu o link por dentro de outro app (WhatsApp, Instagram…). Por aqui não dá para instalar.
        </p>
      </div>
      <ListaDePassos
        passos={[
          {
            titulo:
              aparelho === "iphone"
                ? "Toque em ⋯ ou no ícone do Safari, no canto da tela"
                : "Toque em ⋮, no canto superior direito",
          },
          { titulo: `Escolha “Abrir no ${navegador}”`, texto: "A página abre no navegador e os passos continuam lá." },
        ]}
      />
      <CopiarLink link={link} texto={`Ou copie o link e cole no ${navegador}`} />
    </Card>
  );
}

function CopiarLink({ link, texto = "Copiar link" }: { link: string; texto?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      variant="secondary"
      onClick={() => {
        void navigator.clipboard?.writeText(link).then(() => {
          setCopiado(true);
          window.setTimeout(() => setCopiado(false), 2500);
        });
      }}
    >
      {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copiado ? "Link copiado" : texto}
    </Button>
  );
}

/* ---------- Página ---------- */

export default function InstalarPage() {
  const instalacao = useInstalacao();
  const [escolhido, setEscolhido] = useState<Aparelho | null>(null);
  const [instalando, setInstalando] = useState(false);
  const aparelho = escolhido ?? instalacao.aparelho;
  const doProprioAparelho = aparelho === instalacao.aparelho;
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/instalar`;
  const qr = useQrDataUrl(link, 480);

  const umToque = doProprioAparelho && instalacao.podeInstalarDireto && aparelho !== "iphone";
  const passos =
    aparelho === "iphone"
      ? passosIphone(doProprioAparelho ? instalacao.navegador : "safari")
      : aparelho === "android"
        ? PASSOS_ANDROID
        : PASSOS_COMPUTADOR;

  async function instalar() {
    setInstalando(true);
    try {
      await instalarAgora();
    } finally {
      setInstalando(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="superficie-escura bg-navy px-4 pb-16 pt-6 text-white sm:pb-20">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Image src="/logos/logo-comite-branca-trim.png" alt="Atletas Energisa" width={128} height={40} className="h-9 w-auto" priority />
          <Link href="/login" className="text-sm font-semibold text-white/80 hover:text-white">
            Entrar no portal
          </Link>
        </div>
        <div className="mx-auto mt-8 flex max-w-4xl items-center gap-4">
          <Image src="/icons/icon-192.png" alt="" width={64} height={64} className="size-16 shrink-0 rounded-[18px] shadow-lg" />
          <div>
            <h1 className="text-2xl font-black leading-tight sm:text-3xl">Instale o app Atletas Energisa</h1>
            <p className="mt-1 text-sm text-white/75 sm:text-base">
              Fica na tela inicial do celular: abre com um toque, em tela cheia, sem digitar endereço.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-10 grid max-w-4xl gap-5 px-4 pb-16 md:grid-cols-[minmax(0,1fr)_17rem] md:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {!instalacao.pronto ? (
            <Card className="h-72 animate-pulse" />
          ) : instalacao.instalado ? (
            <Card className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
                <Check className="size-7" aria-hidden="true" />
              </span>
              <p className="text-lg font-bold text-text">Você já está usando o app</p>
              <Link href="/dashboard" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                Ir para o início <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Card>
          ) : (
            <>
              {instalacao.navegador === "interno" && doProprioAparelho ? (
                <AbrirNoNavegador aparelho={instalacao.aparelho} link={link} />
              ) : null}

              <Card className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-bold text-text">
                    {umToque ? "Instale com um toque" : "Passo a passo"}
                  </h2>
                  <SegmentedControl
                    value={aparelho}
                    onChange={(v) => setEscolhido(v as Aparelho)}
                    options={[
                      { value: "iphone", label: "iPhone" },
                      { value: "android", label: "Android" },
                      { value: "computador", label: "Computador" },
                    ]}
                  />
                </div>

                {umToque ? (
                  <div className="flex flex-col gap-3">
                    <Button onClick={instalar} loading={instalando} className="h-12 text-base">
                      <Download className="size-5" />
                      Instalar agora
                    </Button>
                    <p className="text-center text-sm text-text-light">
                      Confirme em <strong className="text-text">Instalar</strong> na janela que abrir. Pronto: o ícone aparece na tela inicial.
                    </p>
                  </div>
                ) : (
                  <ListaDePassos passos={passos} />
                )}

                {aparelho === "android" && doProprioAparelho && instalacao.navegador === "outro" ? (
                  <p className="rounded-[var(--radius)] bg-bg-inset px-3 py-2.5 text-sm text-text-light">
                    No navegador da Samsung: toque em ☰ → <strong className="text-text">Adicionar página a</strong> →{" "}
                    <strong className="text-text">Tela inicial</strong>.
                  </p>
                ) : null}

                {aparelho === "iphone" && doProprioAparelho && instalacao.navegador === "outro" ? (
                  <p className="rounded-[var(--radius)] bg-bg-inset px-3 py-2.5 text-sm text-text-light">
                    Neste navegador pode não aparecer a opção. Se não encontrar, abra este link no Safari.
                  </p>
                ) : null}
              </Card>
            </>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-bold text-text">
              {instalacao.aparelho === "computador" ? "Abra no celular" : "Mande para um colega"}
            </p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- PNG gerado na hora (data URL)
              <img src={qr} alt="QR code da página de instalação" className="aspect-square w-full max-w-48 rounded-[var(--radius)]" />
            ) : (
              <div className="aspect-square w-full max-w-48 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
            )}
            <p className="text-xs text-text-light">Aponte a câmera do celular para o QR code.</p>
            <div className="flex w-full flex-col gap-2">
              <CopiarLink link={link} />
              {instalacao.pronto && "share" in navigator ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    void navigator.share({ title: "Instale o app Atletas Energisa", url: link }).catch(() => undefined)
                  }
                >
                  <Share2 className="size-4" />
                  Compartilhar
                </Button>
              ) : null}
            </div>
          </Card>
          <p className="px-2 text-center text-xs text-text-muted">
            Prefere não instalar? Tudo funciona também pelo navegador, em{" "}
            <Link href="/login" className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline">
              entrar no portal <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
            .
          </p>
        </aside>
      </main>
    </div>
  );
}
