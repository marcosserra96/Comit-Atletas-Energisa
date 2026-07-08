"use client";

import { useRef, useState } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { FileSpreadsheet, Upload } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { baixarModeloImportacao, readExcelFile } from "@/lib/excel";
import { logAudit } from "@/lib/audit";
import type { Equipe } from "@/lib/types";

const EQUIPES_VALIDAS: Record<string, Equipe> = {
  corrida: "corrida",
  bicicleta: "bicicleta",
  bike: "bicicleta",
  fila_corrida: "fila_corrida",
  "fila corrida": "fila_corrida",
  fila_bicicleta: "fila_bicicleta",
  "fila bicicleta": "fila_bicicleta",
};

const SEXOS_VALIDOS = new Set(["M", "F", "Outro"]);

export function ImportarAtletasCard() {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  function handleBaixarModelo() {
    baixarModeloImportacao({
      arquivo: "modelo-atletas.xlsx",
      aba: "Atletas",
      campos: [
        {
          coluna: "Nome",
          largura: 26,
          exemplo: "Maria Silva",
          obrigatorio: true,
          descricao: "Nome completo do atleta.",
        },
        {
          coluna: "Email",
          largura: 26,
          exemplo: "maria@energisa.com.br",
          descricao: "E-mail de contato (opcional — não precisa ser o e-mail de login).",
        },
        {
          coluna: "Sexo",
          largura: 12,
          opcoes: ["M", "F", "Outro"],
          exemplo: "F",
          descricao: "Selecione uma opção da lista.",
        },
        {
          coluna: "Data Nascimento",
          largura: 16,
          exemplo: new Date(1995, 3, 12),
          descricao: "Use o seletor de data do Excel/Sheets (célula formatada como data).",
        },
        {
          coluna: "Localidade",
          largura: 18,
          exemplo: "Sede",
          descricao: "Cidade, polo ou unidade do atleta.",
        },
        {
          coluna: "Ano Entrada",
          largura: 14,
          exemplo: 2026,
          descricao: "Ano em que o atleta entrou no programa (somente números).",
        },
        {
          coluna: "Equipe",
          largura: 16,
          opcoes: ["corrida", "bicicleta", "fila_corrida", "fila_bicicleta"],
          exemplo: "corrida",
          obrigatorio: true,
          descricao:
            "Selecione uma opção da lista — \"fila_corrida\"/\"fila_bicicleta\" cadastram o atleta na fila de espera.",
        },
      ],
    });
  }

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportando(true);
    try {
      const linhas = await readExcelFile(file);
      let criados = 0;
      const erros: string[] = [];
      const batch = writeBatch(db);

      linhas.forEach((linha, i) => {
        const numeroLinha = i + 2;
        const nome = linha["nome"];
        if (!nome) {
          if (Object.values(linha).some((v) => v)) erros.push(`Linha ${numeroLinha}: nome vazio`);
          return;
        }
        const equipeRaw = (linha["equipe"] ?? "").toLowerCase();
        const equipe = EQUIPES_VALIDAS[equipeRaw];
        if (!equipe) {
          erros.push(`Linha ${numeroLinha}: equipe "${linha["equipe"]}" inválida`);
          return;
        }
        const sexo = SEXOS_VALIDOS.has(linha["sexo"]) ? (linha["sexo"] as "M" | "F" | "Outro") : "Outro";
        const anoEntrada = Number(linha["ano entrada"]);

        const novoAtleta = doc(collection(db, "atletas"));
        batch.set(novoAtleta, {
          id: novoAtleta.id,
          nome,
          email: linha["email"] || null,
          dataNascimento: linha["data nascimento"] || null,
          sexo,
          localidade: linha["localidade"] || null,
          anoEntrada: Number.isFinite(anoEntrada) && anoEntrada > 0 ? anoEntrada : null,
          role: "atleta",
          equipe,
          // Na fila de espera o atleta ainda não entrou no programa de fato.
          ativo: !equipe.startsWith("fila_"),
          ordemFila: equipe.startsWith("fila_") ? Date.now() : null,
          pontuacaoTotal: 0,
          authUid: null,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
          criadoPor: uid,
        });
        criados += 1;
      });

      if (criados > 0) {
        await batch.commit();
        await logAudit({
          acao: "importar_atletas",
          entidade: "atletas",
          entidadeId: "lote",
          dados: { criados, erros: erros.length },
          criadoPor: uid,
          criadoPorNome: autor.nome,
        });
      }

      if (criados === 0) {
        show("error", erros[0] ?? "Nenhuma linha válida encontrada na planilha.");
      } else if (erros.length > 0) {
        show("info", `${criados} atleta(s) importado(s). ${erros.length} linha(s) ignorada(s): ${erros.slice(0, 3).join("; ")}`);
      } else {
        show("success", `${criados} atleta(s) importado(s) com sucesso.`);
      }
    } catch {
      show("error", "Não foi possível ler a planilha. Verifique o formato e tente novamente.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-secondary/10 text-secondary">
          <FileSpreadsheet className="size-5" />
        </span>
        <div>
          <h3 className="font-bold text-text">Importar por planilha</h3>
          <p className="text-sm text-text-light">
            Baixe o modelo, preencha os dados e importe vários atletas de uma vez.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleBaixarModelo}>
          <FileSpreadsheet className="size-4" />
          Baixar modelo
        </Button>
        <Button onClick={() => inputRef.current?.click()} loading={importando}>
          <Upload className="size-4" />
          Importar planilha
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImportar}
        />
      </div>
    </Card>
  );
}
