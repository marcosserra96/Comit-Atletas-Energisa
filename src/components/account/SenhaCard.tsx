"use client";

import { FormEvent, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { UserCog } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { firebaseErrorCode, mapFirebaseError } from "@/lib/firebaseErrors";

export function SenhaCard() {
  const { show } = useToast();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !user.email) return;
    if (!novaSenha) {
      show("info", "Informe a nova senha para atualizar.");
      return;
    }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, senhaAtual);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, novaSenha);
      show("success", "Senha atualizada com sucesso.");
      setSenhaAtual("");
      setNovaSenha("");
    } catch (error) {
      show("error", mapFirebaseError(firebaseErrorCode(error)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-text">
        <UserCog className="size-4 text-text-muted" />
        Dados da conta
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Senha atual"
          type="password"
          placeholder="Obrigatório para alterar a senha"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          required
        />
        <TextField
          label="Nova senha"
          type="password"
          placeholder="Mínimo 6 caracteres"
          minLength={6}
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          required
        />
        <Button type="submit" loading={loading} className="w-full">
          Salvar alterações
        </Button>
      </form>
    </Card>
  );
}
