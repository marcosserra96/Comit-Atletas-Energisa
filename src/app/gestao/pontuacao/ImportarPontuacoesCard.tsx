"use client";

import { useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { FileSpreadsheet, Upload } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { downloadTemplate, readExcelFile } from "@/lib/excel";
import { modalidadeFromEquipe } from "@/lib/labels";
import { logAudit } from "@/lib/audit";
import type { AtletaDoc, RegraPontuacaoDoc, TipoLancamento } from "@/lib/types";

const TIPOS_VALIDOS: TipoLancamento[] = ["treino", "evento", "avulso"];
const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function ImportarPontuacoesCard() {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  function handleBaixarModelo() {
    downloadTemplate("modelo-pontuacoes.xlsx", "Pontuações", [], {
      Atleta: "Bruno Costa",
      Data: new Date().toISOString().slice(0, 10),
      Tipo: "treino",
      Regra: "Treino registrado no app",
      KM: 10,
    });
  }

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportando(true);
    try {
      const [linhas, atletasSnap, regrasSnap] = await Promise.all([
        readExcelFile(file),
        getDocs(collection(db, "atletas")),
        getDocs(collection(db, "regras_pontuacao")),
      ]);

      const atletas = atletasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc);
      const regras = regrasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc);
      const atletaPorNome = new Map(atletas.map((a) => [a.nome.trim().toLowerCase(), a]));

      const loteId = doc(collection(db, "historico_pontos")).id;
      const batch = writeBatch(db);
      const incrementoPorAtleta = new Map<string, number>();
      let criados = 0;
      const erros: string[] = [];

      linhas.forEach((linha, i) => {
        const numeroLinha = i + 2;
        const nome = linha["atleta"];
        if (!nome) {
          if (Object.values(linha).some((v) => v)) erros.push(`Linha ${numeroLinha}: atleta vazio`);
          return;
        }
        const atletaDoc = atletaPorNome.get(nome.toLowerCase());
        if (!atletaDoc) {
          erros.push(`Linha ${numeroLinha}: atleta "${nome}" não encontrado`);
          return;
        }
        const data = linha["data"];
        if (!DATA_REGEX.test(data)) {
          erros.push(`Linha ${numeroLinha}: data "${data}" inválida (use AAAA-MM-DD)`);
          return;
        }
        const tipo = linha["tipo"].toLowerCase() as TipoLancamento;
        if (!TIPOS_VALIDOS.includes(tipo)) {
          erros.push(`Linha ${numeroLinha}: tipo "${linha["tipo"]}" inválido`);
          return;
        }
        const modalidade = modalidadeFromEquipe(atletaDoc.equipe);
        const regraDoc = regras.find(
          (r) =>
            (r.modalidade === "ambas" || r.modalidade === modalidade) &&
            r.tiposLancamento.includes(tipo) &&
            r.descricao.trim().toLowerCase() === linha["regra"].trim().toLowerCase(),
        );
        if (!regraDoc) {
          erros.push(`Linha ${numeroLinha}: regra "${linha["regra"]}" não encontrada para ${nome}`);
          return;
        }
        const km = Number(linha["km"]);

        const lancamentoRef = doc(collection(db, "historico_pontos"));
        batch.set(lancamentoRef, {
          id: lancamentoRef.id,
          atletaId: atletaDoc.id,
          atletaNome: atletaDoc.nome,
          equipe: atletaDoc.equipe,
          regraId: regraDoc.id,
          regraDesc: regraDoc.descricao,
          pontos: regraDoc.pontos,
          ...(Number.isFinite(km) && km > 0 ? { kmPercorrido: km } : {}),
          tipoLancamento: tipo,
          dataTreino: data,
          loteId,
          criadoPor: uid,
          criadoPorNome: autor.nome,
          criadoEm: serverTimestamp(),
          estornado: false,
        });
        incrementoPorAtleta.set(atletaDoc.id, (incrementoPorAtleta.get(atletaDoc.id) ?? 0) + regraDoc.pontos);
        criados += 1;
      });

      for (const [atletaId, pontos] of incrementoPorAtleta) {
        batch.update(doc(db, "atletas", atletaId), {
          pontuacaoTotal: increment(pontos),
          atualizadoEm: serverTimestamp(),
        });
      }

      if (criados > 0) {
        await batch.commit();
        await logAudit({
          acao: "importar_pontuacoes",
          entidade: "historico_pontos",
          entidadeId: loteId,
          dados: { criados, erros: erros.length },
          criadoPor: uid,
          criadoPorNome: autor.nome,
        });
      }

      if (criados === 0) {
        show("error", erros[0] ?? "Nenhuma linha válida encontrada na planilha.");
      } else if (erros.length > 0) {
        show("info", `${criados} lançamento(s) importado(s). ${erros.length} linha(s) ignorada(s): ${erros.slice(0, 3).join("; ")}`);
      } else {
        show("success", `${criados} lançamento(s) importado(s) com sucesso.`);
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
          <h3 className="font-bold text-text">Importar pontuações</h3>
          <p className="text-sm text-text-light">
            Baixe o modelo e importe lançamentos em lote a partir de uma planilha.
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
