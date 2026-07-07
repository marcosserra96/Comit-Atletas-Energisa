"use client";

import { FormEvent, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { Moon, Sun, UserCog } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { firebaseErrorCode, mapFirebaseError } from "@/lib/firebaseErrors";

export function AparenciaCard() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  function handleChange(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-text">
        <Sun className="size-4 text-text-muted" />
        Aparência
      </h3>
      <p className="mb-2 text-xs text-text-light">Tema</p>
      <div className="flex w-fit gap-1 rounded-[var(--radius)] border border-border bg-bg p-1">
        <button
          onClick={() => handleChange("light")}
          className={cn(
            "flex items-center gap-2 rounded-[calc(var(--radius)-2px)] px-4 py-2 text-sm font-semibold transition-colors",
            theme === "light" ? "bg-bg-card text-primary shadow-sm" : "text-text-light",
          )}
        >
          <Sun className="size-4" />
          Claro
        </button>
        <button
          onClick={() => handleChange("dark")}
          className={cn(
            "flex items-center gap-2 rounded-[calc(var(--radius)-2px)] px-4 py-2 text-sm font-semibold transition-colors",
            theme === "dark" ? "bg-bg-card text-primary shadow-sm" : "text-text-light",
          )}
        >
          <Moon className="size-4" />
          Escuro
        </button>
      </div>
    </Card>
  );
}

function ContaCard() {
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

export default function MinhaContaPage() {
  const { atleta } = useActiveSession();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-extrabold text-text">Minha Conta</h2>
        <p className="text-sm text-text-light">
          Personalize a aparência do portal e gerencie os dados de {atleta.nome.split(" ")[0]}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AparenciaCard />
        <ContaCard />
      </div>
    </div>
  );
}
