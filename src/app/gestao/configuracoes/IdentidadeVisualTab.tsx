"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Image as ImageIcon, Palette, RotateCcw, Save } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { logAudit } from "@/lib/audit";
import { applyBranding, BRANDING_PADRAO, loginBackground } from "@/lib/branding";
import type { BrandingDoc, LoginBackgroundStyle } from "@/lib/types";

const CORES_PORTAL: { chave: "primary" | "secondary" | "accent" | "danger"; label: string }[] = [
  { chave: "primary", label: "Cor principal" },
  { chave: "secondary", label: "Cor secundária" },
  { chave: "accent", label: "Cor de destaque" },
  { chave: "danger", label: "Cor de alerta" },
];

export function IdentidadeVisualTab() {
  const { uid, atleta } = useActiveSession();
  const { show } = useToast();
  const [branding, setBrandingState] = useState<BrandingDoc>(BRANDING_PADRAO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "configuracoes", "branding")).then((snap) => {
      if (snap.exists()) setBrandingState({ ...BRANDING_PADRAO, ...(snap.data() as Partial<BrandingDoc>) });
      setLoading(false);
    });
  }, []);

  function update(next: Partial<BrandingDoc>) {
    const draft = { ...branding, ...next };
    setBrandingState(draft);
    applyBranding(draft);
  }

  function restaurarPadrao() {
    setBrandingState(BRANDING_PADRAO);
    applyBranding(BRANDING_PADRAO);
    show("info", "Prévia restaurada para o padrão. Clique em salvar para gravar.");
  }

  async function handleSalvar() {
    setSaving(true);
    try {
      await setDoc(doc(db, "configuracoes", "branding"), {
        ...branding,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: uid,
      });
      await logAudit({
        acao: "identidade_visual_atualizada",
        entidade: "configuracoes",
        entidadeId: "branding",
        dados: { ...branding },
        criadoPor: uid,
        criadoPorNome: atleta.nome,
      });
      show("success", "Identidade visual atualizada com sucesso.");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card className="h-80 animate-pulse" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-text">
            <Palette className="size-4 text-text-muted" />
            Cores do portal
          </h3>
          <p className="mb-4 text-xs text-text-light">
            Aplicadas em tempo real aos botões, links e destaques em todo o portal.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {CORES_PORTAL.map((c) => (
              <div key={c.chave} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text">{c.label}</label>
                <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-bg px-2 py-1.5">
                  <input
                    type="color"
                    value={branding[c.chave]}
                    onChange={(e) => update({ [c.chave]: e.target.value })}
                    className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <span className="text-xs text-text-light">{branding[c.chave]}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-text">
            <ImageIcon className="size-4 text-text-muted" />
            Fundo da tela de login
          </h3>
          <p className="mb-4 text-xs text-text-light">Estilo do painel de destaque na tela de acesso.</p>

          <SegmentedControl<LoginBackgroundStyle>
            value={branding.loginStyle}
            onChange={(v) => update({ loginStyle: v })}
            options={[
              { value: "solido", label: "Sólido" },
              { value: "gradiente", label: "Gradiente" },
            ]}
            className="mb-4"
          />

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">
                {branding.loginStyle === "gradiente" ? "Cor inicial" : "Cor de fundo"}
              </label>
              <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-bg px-2 py-1.5">
                <input
                  type="color"
                  value={branding.loginCorInicio}
                  onChange={(e) => update({ loginCorInicio: e.target.value })}
                  className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                />
                <span className="text-xs text-text-light">{branding.loginCorInicio}</span>
              </div>
            </div>
            {branding.loginStyle === "gradiente" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text">Cor final</label>
                <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-bg px-2 py-1.5">
                  <input
                    type="color"
                    value={branding.loginCorFim}
                    onChange={(e) => update({ loginCorFim: e.target.value })}
                    className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <span className="text-xs text-text-light">{branding.loginCorFim}</span>
                </div>
              </div>
            )}
          </div>

          <div
            className="flex h-36 flex-col justify-center rounded-[var(--radius-lg)] px-5 text-white"
            style={{ background: loginBackground(branding) }}
          >
            <p className="text-[10px] font-bold tracking-[0.14em] text-white/60">PRÉVIA</p>
            <p className="text-lg font-bold tracking-[-0.02em]">Portal Atletas Energisa</p>
            <p className="text-xs text-white/70">Desempenho, pontuação e evolução em um só lugar.</p>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={restaurarPadrao}>
          <RotateCcw className="size-4" />
          Restaurar padrão
        </Button>
        <Button onClick={handleSalvar} loading={saving}>
          <Save className="size-4" />
          Salvar identidade visual
        </Button>
      </div>
    </div>
  );
}
