"use client";

import { FormEvent, useState } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { User, Mail, UserPlus } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { logAudit } from "@/lib/audit";
import { ImportarAtletasCard } from "./ImportarAtletasCard";
import type { Equipe } from "@/lib/types";

export function CadastrarTab() {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState<"M" | "F" | "Outro">("Outro");
  const [localidade, setLocalidade] = useState("");
  const [anoEntrada, setAnoEntrada] = useState(String(new Date().getFullYear()));
  const [equipe, setEquipe] = useState<Equipe>("corrida");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const novoAtleta = doc(collection(db, "atletas"));
      await setDoc(novoAtleta, {
        id: novoAtleta.id,
        nome,
        email: email || null,
        dataNascimento: dataNascimento || null,
        sexo,
        localidade: localidade || null,
        anoEntrada: anoEntrada ? Number(anoEntrada) : null,
        role: "atleta",
        equipe,
        ativo: true,
        pontuacaoTotal: 0,
        authUid: null,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
        criadoPor: uid,
      });
      await logAudit({
        acao: "cadastrar_atleta",
        entidade: "atletas",
        entidadeId: novoAtleta.id,
        dados: { nome, equipe },
        criadoPor: uid,
        criadoPorNome: autor.nome,
      });
      show(
        "success",
        `${nome.split(" ")[0]} cadastrado(a). Quando solicitar acesso, o administrador poderá vincular a este cadastro.`,
      );
      setNome("");
      setEmail("");
      setDataNascimento("");
      setSexo("Outro");
      setLocalidade("");
      setAnoEntrada(String(new Date().getFullYear()));
      setEquipe("corrida");
    } catch {
      show("error", "Não foi possível cadastrar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ImportarAtletasCard />
      <Card className="max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
          <UserPlus className="size-5" />
        </span>
        <div>
          <h3 className="font-bold text-text">Cadastro manual</h3>
          <p className="text-sm text-text-light">
            Preencha os dados do atleta para adicioná-lo ao programa.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">
            Dados pessoais
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Nome completo"
              icon={<User className="size-[18px]" />}
              placeholder="Ex: João Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <TextField
              label="E-mail"
              type="email"
              icon={<Mail className="size-[18px]" />}
              placeholder="joao@energisa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Data de nascimento"
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Sexo</label>
              <Select value={sexo} onChange={(e) => setSexo(e.target.value as typeof sexo)}>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="Outro">Prefiro não informar</option>
              </Select>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">
            Dados do programa
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Localidade / Polo"
              placeholder="Ex: Sede, João Pessoa…"
              value={localidade}
              onChange={(e) => setLocalidade(e.target.value)}
            />
            <TextField
              label="Ano de entrada"
              type="number"
              min={2020}
              max={2099}
              value={anoEntrada}
              onChange={(e) => setAnoEntrada(e.target.value)}
            />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-text">Equipe / modalidade</label>
              <Select value={equipe} onChange={(e) => setEquipe(e.target.value as Equipe)}>
                <option value="corrida">Corrida</option>
                <option value="bicicleta">Bicicleta</option>
                <option value="fila_corrida">Fila de espera — Corrida</option>
                <option value="fila_bicicleta">Fila de espera — Bicicleta</option>
              </Select>
            </div>
          </div>
        </div>

        <Button type="submit" loading={loading} className="w-fit">
          <UserPlus className="size-4" />
          Adicionar atleta
        </Button>
      </form>
      </Card>
    </div>
  );
}
