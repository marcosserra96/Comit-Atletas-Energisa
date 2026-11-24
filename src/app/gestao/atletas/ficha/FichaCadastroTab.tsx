"use client";

import { dataIsoLocal } from "@/lib/date";
import { Fragment, FormEvent, useState } from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { AlertOctagon, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ConfirmarPerigoModal } from "@/components/ui/ConfirmarPerigoModal";
import { logAudit } from "@/lib/audit";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { ehModalidade, trocasDoAtleta } from "@/lib/modalidade";
import { modalidadeLabel } from "@/lib/labels";
import { atualizarRankingAutomaticamente } from "@/lib/rankingAutoUpdate";
import { TrocasModalidade } from "./TrocasModalidade";
import type { AtletaDoc, Equipe } from "@/lib/types";

const equipeOptions: Equipe[] = ["corrida", "bicicleta", "fila_corrida", "fila_bicicleta"];

export function FichaCadastroTab({ atleta, onSaved }: { atleta: AtletaDoc; onSaved: () => void }) {
  const { uid, usuario, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const [nome, setNome] = useState(atleta.nome);
  const [email, setEmail] = useState(atleta.email ?? "");
  const [sexo, setSexo] = useState<"M" | "F" | "Outro">(atleta.sexo ?? "Outro");
  const [dataNascimento, setDataNascimento] = useState(atleta.dataNascimento ?? "");
  const [localidade, setLocalidade] = useState(atleta.localidade ?? "");
  const [anoEntrada, setAnoEntrada] = useState(atleta.anoEntrada ? String(atleta.anoEntrada) : "");
  const [equipe, setEquipe] = useState<Equipe>(atleta.equipe);
  const [dataTroca, setDataTroca] = useState(dataIsoLocal());
  const [loading, setLoading] = useState(false);
  // Corrida ↔ Bike: a troca fica registrada com a data, e os pontos de antes ficam na modalidade antiga.
  const trocandoModalidade = ehModalidade(equipe) && ehModalidade(atleta.equipe) && equipe !== atleta.equipe;
  const ultimaTroca = trocasDoAtleta(atleta).at(-1);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (trocandoModalidade && (!dataTroca || dataTroca > dataIsoLocal() || (ultimaTroca && dataTroca <= ultimaTroca.data))) {
      show("error", ultimaTroca && dataTroca && dataTroca <= ultimaTroca.data ? "A troca precisa ser depois da última, registrada no Trocas de modalidade." : "Informe o dia em que a troca de modalidade começou (até hoje).");
      return;
    }
    setLoading(true);
    try {
      const entrouNaFilaAgora = equipe.startsWith("fila_") && !atleta.equipe.startsWith("fila_");
      const saiuDaFilaAgora = !equipe.startsWith("fila_") && atleta.equipe.startsWith("fila_");
      const ativoAtualizado = entrouNaFilaAgora ? false : saiuDaFilaAgora ? true : atleta.ativo;
      // Entrou agora numa equipe (vindo da fila, de outra equipe ou do comitê): vira "novo atleta".
      const entrouNaEquipeAgora = (equipe === "corrida" || equipe === "bicicleta") && equipe !== atleta.equipe;
      const batch = writeBatch(db);
      batch.update(doc(db, "atletas", atleta.id), {
        nome,
        email: email || null,
        sexo,
        dataNascimento: dataNascimento || null,
        localidade: localidade || null,
        anoEntrada: anoEntrada ? Number(anoEntrada) : null,
        equipe,
        // Só mexe em "ativo" quando a mudança de equipe realmente entra ou sai
        // da fila — fora isso, respeita o status ligado/desligado manualmente
        // na aba Resumo (não sobrescreve a cada salvamento do Cadastro).
        ...(entrouNaFilaAgora ? { ativo: false } : {}),
        ...(saiuDaFilaAgora ? { ativo: true } : {}),
        // Só ganha uma nova posição (vai pro fim) se está entrando na fila agora;
        // se já estava nessa mesma fila, mantém a ordem definida por drag-and-drop.
        ...(entrouNaFilaAgora ? { ordemFila: Date.now() } : {}),
        ...(entrouNaEquipeAgora ? { entrouNaEquipeEm: trocandoModalidade ? dataTroca : dataIsoLocal() } : {}),
        ...(trocandoModalidade && ehModalidade(atleta.equipe) && ehModalidade(equipe)
          ? {
              trocasModalidade: [
                ...trocasDoAtleta(atleta),
                { de: atleta.equipe, para: equipe, data: dataTroca, registradoPor: uid, registradoPorNome: autor.nome, registradoEm: new Date().toISOString() },
              ],
            }
          : {}),
        atualizadoEm: serverTimestamp(),
      });
      batch.set(
        atletaPublicoRef(atleta.id),
        {
          nome,
          equipe,
          ativo: ativoAtualizado,
          visivelNasListas: perfilAtletaVisivel(atleta),
        },
        { merge: true },
      );
      await batch.commit();
      await logAudit({
        acao: "editar_atleta",
        entidade: "atletas",
        entidadeId: atleta.id,
        dados: { nome, equipe, ...(trocandoModalidade ? { trocaModalidade: `${atleta.equipe}→${equipe} em ${dataTroca}` } : {}) },
        criadoPor: uid,
        criadoPorNome: autor.nome,
      });
      // A equipe define em que ranking a pessoa aparece.
      if (equipe !== atleta.equipe) await atualizarRankingAutomaticamente([atleta.id], trocandoModalidade ? "troca_modalidade" : "equipe_alterada");
      show("success", trocandoModalidade ? "Cadastro atualizado e troca de modalidade registrada." : "Cadastro atualizado.");
      onSaved();
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExcluir() {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "atletas", atleta.id));
      batch.delete(atletaPublicoRef(atleta.id));
      if (atleta.authUid) {
        batch.delete(doc(db, "usuarios", atleta.authUid));
      }
      await batch.commit();
      await logAudit({
        acao: "excluir_atleta",
        entidade: "atletas",
        entidadeId: atleta.id,
        dados: { nome: atleta.nome, equipe: atleta.equipe },
        criadoPor: uid,
        criadoPorNome: autor.nome,
      });
      show("success", `${atleta.nome.split(" ")[0]} foi excluído do programa.`);
      onSaved();
    } catch {
      show("error", "Não foi possível excluir agora. Tente novamente.");
    }
  }

  return (
    <Fragment>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
          <TextField
            label="Localidade / Polo"
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
              {equipeOptions.map((eq) => (
                <option key={eq} value={eq}>
                  {eq === "corrida"
                    ? "Corrida"
                    : eq === "bicicleta"
                      ? "Bike"
                      : eq === "fila_corrida"
                        ? "Fila de espera — Corrida"
                        : "Fila de espera — Bike"}
                </option>
              ))}
            </Select>
          </div>
          {trocandoModalidade ? (
            <div className="flex flex-col gap-2 rounded-[var(--radius)] bg-[var(--color-info-subtle)] p-3 sm:col-span-2">
              <div className="w-48">
                <TextField
                  label={`Primeiro dia na ${modalidadeLabel[equipe as "corrida" | "bicicleta"]}`}
                  type="date"
                  value={dataTroca}
                  min={ultimaTroca ? ultimaTroca.data : undefined}
                  max={dataIsoLocal()}
                  onChange={(e) => setDataTroca(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-text-secondary [text-wrap:pretty]">
                Os pontos, treinos e km de antes dessa data continuam na {modalidadeLabel[atleta.equipe as "corrida" | "bicicleta"]}: não entram na apuração da {modalidadeLabel[equipe as "corrida" | "bicicleta"]}.
              </p>
            </div>
          ) : null}
        </div>
        <Button type="submit" loading={loading} className="w-fit">
          Salvar cadastro
        </Button>
      </form>

      <TrocasModalidade key={(atleta.trocasModalidade ?? []).length} atleta={atleta} />

      {usuario.role === "administrador" && (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-danger/30 bg-danger/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertOctagon className="size-4 text-danger" />
            <h4 className="text-sm font-bold text-text">Zona de risco</h4>
          </div>
          <p className="mb-3 text-xs text-text-light">
            Exclui o cadastro permanentemente, incluindo o vínculo com o login (se houver). O
            histórico de pontos já lançado não é apagado, mas deixa de estar associado a um atleta
            ativo.
          </p>
          <Button type="button" variant="danger" size="sm" onClick={() => setConfirmandoExclusao(true)}>
            <Trash2 className="size-3.5" />
            Excluir atleta
          </Button>
        </div>
      )}

      <ConfirmarPerigoModal
        open={confirmandoExclusao}
        titulo="Excluir atleta"
        descricao={`Essa ação apaga o cadastro de ${atleta.nome} permanentemente e não pode ser desfeita.`}
        palavraChave="EXCLUIR"
        onClose={() => setConfirmandoExclusao(false)}
        onConfirm={handleExcluir}
      />
    </Fragment>
  );
}
