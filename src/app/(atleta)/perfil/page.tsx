"use client";

import { FormEvent, useState } from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { User, MapPin, Cake, UserCircle, Shield, Mail, Zap } from "lucide-react";
import { db } from "@/lib/firebase";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { useAthleteView } from "@/lib/session/AthleteViewProvider";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SportBadge } from "@/components/ui/SportBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AparenciaCard } from "@/components/account/AparenciaCard";
import { SenhaCard } from "@/components/account/SenhaCard";
import { equipeLabel, isWaitlisted, modalidadeFromEquipe } from "@/lib/labels";

export default function PerfilPage() {
  const { atleta, isPreview } = useAthleteView();
  const { show } = useToast();
  const [nome, setNome] = useState(atleta.nome);
  const [localidade, setLocalidade] = useState(atleta.localidade ?? "");
  const [dataNascimento, setDataNascimento] = useState(atleta.dataNascimento ?? "");
  const [sexo, setSexo] = useState<"M" | "F" | "Outro">(atleta.sexo ?? "Outro");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPreview) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "atletas", atleta.id), {
        nome,
        localidade,
        dataNascimento,
        sexo,
        atualizadoEm: serverTimestamp(),
      });
      batch.set(atletaPublicoRef(atleta.id), { nome }, { merge: true });
      await batch.commit();
      show("success", "Perfil atualizado.");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const modalidade = modalidadeFromEquipe(atleta.equipe);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader 
        icon={UserCircle} 
        title="Perfil" 
        description={isPreview ? "Consulta dos dados do atleta em modo somente leitura." : "Seus dados pessoais e configurações da conta."} 
      />

      {/* HERO SECTION */}
      <Card className="flex flex-row items-center gap-4 bg-gradient-to-br from-bg to-bg-inset p-4 sm:items-start sm:gap-6 sm:p-8 border-border">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-black text-primary shadow-sm sm:size-24 sm:text-4xl">
          {atleta.nome.trim().charAt(0).toUpperCase()}
        </span>
        <div className="flex min-w-0 w-full flex-col items-start gap-2 sm:gap-3">
          <div className="min-w-0 text-left">
            <h2 className="truncate text-lg font-extrabold text-text sm:text-2xl">{atleta.nome}</h2>
            <p className="truncate text-xs text-text-light sm:text-sm">{atleta.email || "E-mail não informado"}</p>
          </div>
          
          <div className="mt-1 flex flex-wrap justify-start gap-2 sm:mt-2">
            <Badge tone={isWaitlisted(atleta.equipe) ? "warning" : atleta.ativo ? "success" : "neutral"} className="px-3 py-1">
              {isWaitlisted(atleta.equipe) ? "Na fila de espera" : atleta.ativo ? "Atleta Ativo" : "Atleta Inativo"}
            </Badge>
            <div className="flex items-center">
              <SportBadge modalidade={modalidade} />
            </div>
            <Badge tone="neutral" className="px-3 py-1">
              <Zap className="size-3.5 mr-1" /> {atleta.pontuacaoTotal || 0} pts
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-12">
        
        {/* COLUNA ESQUERDA - DADOS E VINCULO */}
        <div className="flex flex-col gap-4 sm:gap-6 xl:col-span-7">
          
          <Card>
            <SectionHeader title="Dados Pessoais" />
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">
              <TextField
                label="Nome completo"
                icon={<User className="size-[18px]" />}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                disabled={isPreview}
              />
              
              <TextField
                label="E-mail"
                icon={<Mail className="size-[18px]" />}
                value={atleta.email || ""}
                readOnly
                className="bg-bg-inset text-text-muted cursor-not-allowed"
                title="E-mail não pode ser alterado."
              />

              <TextField
                label="Cidade"
                icon={<MapPin className="size-[18px]" />}
                placeholder="Sua cidade"
                value={localidade}
                onChange={(e) => setLocalidade(e.target.value)}
                disabled={isPreview}
              />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField
                  label="Data de nascimento"
                  type="date"
                  icon={<Cake className="size-[18px]" />}
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  disabled={isPreview}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-text">Sexo</label>
                  <Select
                    value={sexo}
                    onChange={(e) => setSexo(e.target.value as typeof sexo)}
                    disabled={isPreview}
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="Outro">Prefiro não informar</option>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={saving} disabled={isPreview}>
                  {isPreview ? "Somente visualização" : "Salvar alterações"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <SectionHeader title="Vínculo com o Programa" />
            
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mt-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-text-muted">Equipe</label>
                <div className="px-3 py-2.5 rounded-lg bg-bg-inset border border-border/50 text-text-muted font-medium text-sm flex items-center h-[42px]">
                  {equipeLabel[atleta.equipe] || atleta.equipe}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-text-muted">Modalidade</label>
                <div className="px-3 py-2.5 rounded-lg bg-bg-inset border border-border/50 text-text-muted font-medium text-sm flex items-center h-[42px] capitalize">
                  {modalidade === "bicicleta" ? "Ciclismo" : modalidade === "corrida" ? "Corrida" : "Não se aplica"}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-sm font-semibold text-text-muted">Membro desde</label>
                <div className="px-3 py-2.5 rounded-lg bg-bg-inset border border-border/50 text-text-muted font-medium text-sm flex items-center h-[42px]">
                  {atleta.anoEntrada || "Não informado"}
                </div>
              </div>
            </div>
          </Card>

        </div>

        {/* COLUNA DIREITA - CONFIGURAÇÕES */}
        <div className="flex flex-col gap-4 sm:gap-6 xl:col-span-5">
          {isPreview ? (
            <Card className="border-amber-200 bg-amber-50/60">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-bold text-text">Modo somente leitura</p>
                  <p className="mt-1 text-sm text-text-light">
                    Configurações da conta e senha não ficam disponíveis durante a visualização administrativa.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <AparenciaCard />
              <SenhaCard />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
