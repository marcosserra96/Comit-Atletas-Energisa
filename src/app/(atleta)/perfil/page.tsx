"use client";

import { FormEvent, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { User, MapPin, Cake } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { equipeLabel, isWaitlisted } from "@/lib/labels";

export default function PerfilPage() {
  const { atleta } = useActiveSession();
  const { show } = useToast();
  const [nome, setNome] = useState(atleta.nome);
  const [localidade, setLocalidade] = useState(atleta.localidade ?? "");
  const [dataNascimento, setDataNascimento] = useState(atleta.dataNascimento ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, "atletas", atleta.id), {
        nome,
        localidade,
        dataNascimento,
        atualizadoEm: serverTimestamp(),
      });
      show("success", "Perfil atualizado.");
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Perfil</h2>
        <p className="text-sm text-text-light">Seus dados pessoais e status no programa.</p>
      </div>

      <Card className="flex flex-wrap items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {atleta.nome.trim().charAt(0).toUpperCase()}
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-lg font-bold text-text">{atleta.nome}</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">{equipeLabel[atleta.equipe]}</Badge>
            <Badge tone={isWaitlisted(atleta.equipe) ? "warning" : atleta.ativo ? "success" : "neutral"}>
              {isWaitlisted(atleta.equipe) ? "Na fila" : atleta.ativo ? "Ativo" : "Inativo"}
            </Badge>
            <Badge tone="neutral">{atleta.pontuacaoTotal} pts</Badge>
          </div>
        </div>
      </Card>

      <Card className="max-w-xl">
        <h3 className="mb-4 text-sm font-bold text-text">Editar dados pessoais</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Nome completo"
            icon={<User className="size-[18px]" />}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <TextField
            label="Cidade"
            icon={<MapPin className="size-[18px]" />}
            placeholder="Sua cidade"
            value={localidade}
            onChange={(e) => setLocalidade(e.target.value)}
          />
          <TextField
            label="Data de nascimento"
            type="date"
            icon={<Cake className="size-[18px]" />}
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
          />
          <p className="text-xs text-text-muted">
            Modalidade e status são definidos pelo comitê e não podem ser editados por aqui.
          </p>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Salvar alterações
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
