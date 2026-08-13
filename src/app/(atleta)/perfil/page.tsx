"use client";

import { FormEvent, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { User, MapPin, Cake, UserCircle, Shield, Mail, Zap } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
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
import { equipeLabel, isWaitlisted } from "@/lib/labels";

export default function PerfilPage() {
  const { atleta } = useActiveSession();
  const { show } = useToast();
  const [nome, setNome] = useState(atleta.nome);
  const [localidade, setLocalidade] = useState(atleta.localidade ?? "");
  const [dataNascimento, setDataNascimento] = useState(atleta.dataNascimento ?? "");
  const [sexo, setSexo] = useState<"M" | "F" | "Outro">(atleta.sexo ?? "Outro");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, "atletas", atleta.id), {
        nome,
        localidade,
        dataNascimento,
        sexo,
        atualizadoEm: serverTimestamp(),
      });
      show("success", "Perfil atualizado.");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  // Determine the default modality visual based on the equipe as a fallback
  const modalidadeBadge = atleta.equipe === "corrida" || atleta.equipe === "bicicleta" ? atleta.equipe : "corrida";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        icon={UserCircle} 
        title="Perfil" 
        description="Seus dados pessoais e configurações da conta." 
      />

      {/* HERO SECTION */}
      <Card className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 sm:p-8 bg-gradient-to-br from-bg to-bg-inset border-border">
        <span className="flex size-24 shrink-0 items-center justify-center rounded-full bg-primary/10 text-4xl font-black text-primary shadow-sm">
          {atleta.nome.trim().charAt(0).toUpperCase()}
        </span>
        <div className="flex flex-col items-center sm:items-start gap-3 w-full">
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-extrabold text-text">{atleta.nome}</h2>
            <p className="text-text-light text-sm">{(atleta as any).email || "E-mail não informado"}</p>
          </div>
          
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
            <Badge tone={isWaitlisted(atleta.equipe) ? "warning" : atleta.ativo ? "success" : "neutral"} className="px-3 py-1">
              {isWaitlisted(atleta.equipe) ? "Na fila de espera" : atleta.ativo ? "Atleta Ativo" : "Atleta Inativo"}
            </Badge>
            <div className="flex items-center">
              <SportBadge sport={modalidadeBadge} />
            </div>
            <Badge tone="neutral" className="px-3 py-1">
              <Zap className="size-3.5 mr-1" /> {atleta.pontuacaoTotal || 0} pts
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA - DADOS E VINCULO */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          
          <Card>
            <SectionHeader title="Dados Pessoais" />
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">
              <TextField
                label="Nome completo"
                icon={<User className="size-[18px]" />}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
              
              <TextField
                label="E-mail"
                icon={<Mail className="size-[18px]" />}
                value={(atleta as any).email || ""}
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
              />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextField
                  label="Data de nascimento"
                  type="date"
                  icon={<Cake className="size-[18px]" />}
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-text">Sexo</label>
                  <Select value={sexo} onChange={(e) => setSexo(e.target.value as typeof sexo)}>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="Outro">Prefiro não informar</option>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" loading={saving}>
                  Salvar alterações
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
                  {modalidadeBadge}
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
        <div className="xl:col-span-5 flex flex-col gap-6">
          <AparenciaCard />
          <SenhaCard />
        </div>
      </div>
    </div>
  );
}
