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
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { baixarModeloImportacao, readExcelFile } from "@/lib/excel";
import { modalidadeFromEquipe } from "@/lib/labels";
import { logAudit } from "@/lib/audit";
import {
  RevisarImportacaoModal,
  type LinhaDuplicada,
  type LinhaImportacao,
  type ResultadoAnalise,
} from "./RevisarImportacaoModal";
import type { AtletaDoc, HistoricoPontoDoc, Modalidade, RegraPontuacaoDoc, TipoLancamento } from "@/lib/types";

const TIPOS_VALIDOS: TipoLancamento[] = ["treino", "evento", "avulso"];
const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATA_BR_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const TAMANHO_LOTE = 400;

type EquipeModelo = "" | Modalidade;

interface LinhaParaGravar extends LinhaImportacao {
  equipe: AtletaDoc["equipe"];
  regraId: string;
  tipo: TipoLancamento;
  km?: number;
}

function chaveDuplicidade(atletaId: string, data: string, regraId: string) {
  return `${atletaId}|${data}|${regraId}`;
}

/** Aceita célula já lida como data (AAAA-MM-DD) ou digitada como texto no formato brasileiro (DD/MM/AAAA). */
function normalizarData(valor: string): string | null {
  if (DATA_ISO_REGEX.test(valor)) return valor;
  const match = valor.match(DATA_BR_REGEX);
  if (!match) return null;
  const [, dia, mes, ano] = match;
  const data = `${ano}-${mes}-${dia}`;
  return DATA_ISO_REGEX.test(data) ? data : null;
}

export function ImportarPontuacoesCard() {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [equipeModelo, setEquipeModelo] = useState<EquipeModelo>("");
  const [importando, setImportando] = useState(false);
  const [baixandoModelo, setBaixandoModelo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [linhasParaGravar, setLinhasParaGravar] = useState<Map<number, LinhaParaGravar>>(new Map());
  const [resultado, setResultado] = useState<ResultadoAnalise | null>(null);

  async function handleBaixarModelo() {
    setBaixandoModelo(true);
    try {
      const [atletasSnap, regrasSnap] = await Promise.all([
        getDocs(collection(db, "atletas")),
        getDocs(collection(db, "regras_pontuacao")),
      ]);
      const atletas = atletasSnap.docs.map((d) => d.data() as AtletaDoc);
      const atletasDoModelo = atletas
        .filter((a) => !equipeModelo || a.equipe === equipeModelo)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      const nomesAtletas = atletasDoModelo.map((a) => a.nome);
      const descricoesRegras = [
        ...new Set(regrasSnap.docs.map((d) => (d.data() as RegraPontuacaoDoc).descricao)),
      ].sort((a, b) => a.localeCompare(b, "pt-BR"));

      await baixarModeloImportacao({
        arquivo: "modelo-pontuacoes.xlsx",
        aba: "Pontuações",
        linhasPreenchidas: nomesAtletas.map((nome) => ({ Atleta: nome })),
        campos: [
          {
            coluna: "Atleta",
            largura: 26,
            opcoes: nomesAtletas,
            exemplo: nomesAtletas[0] ?? "Bruno Costa",
            obrigatorio: true,
            descricao: "Nome exatamente igual ao cadastro do atleta.",
          },
          {
            coluna: "Data",
            largura: 14,
            exemplo: new Date(),
            obrigatorio: true,
            descricao: "Data do treino/evento — célula formatada como data ou texto no formato DD/MM/AAAA (não pode ser futura).",
          },
          {
            coluna: "Tipo",
            largura: 12,
            opcoes: TIPOS_VALIDOS,
            exemplo: "treino",
            obrigatorio: true,
            descricao: "Selecione uma opção da lista.",
          },
          {
            coluna: "Regra",
            largura: 30,
            opcoes: descricoesRegras,
            exemplo: descricoesRegras[0] ?? "Treino registrado no app",
            obrigatorio: true,
            descricao:
              "Descrição exata do critério de pontuação (cadastrado em Configurar Portal → Critérios), compatível com a equipe e o tipo do atleta.",
          },
          {
            coluna: "KM",
            largura: 10,
            exemplo: 10,
            descricao: "Quilometragem percorrida (opcional, só para números maiores que zero).",
          },
        ],
      });
    } catch {
      show("error", "Não foi possível gerar o modelo agora. Tente novamente.");
    } finally {
      setBaixandoModelo(false);
    }
  }

  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportando(true);
    try {
      const [linhas, atletasSnap, regrasSnap, historicoSnap] = await Promise.all([
        readExcelFile(file),
        getDocs(collection(db, "atletas")),
        getDocs(collection(db, "regras_pontuacao")),
        getDocs(collection(db, "historico_pontos")),
      ]);

      const atletas = atletasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc);
      const regras = regrasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc);
      const atletaPorNome = new Map(atletas.map((a) => [a.nome.trim().toLowerCase(), a]));

      const chavesExistentes = new Set(
        historicoSnap.docs
          .map((d) => d.data() as HistoricoPontoDoc)
          .filter((h) => !h.estornado)
          .map((h) => chaveDuplicidade(h.atletaId, h.dataTreino, h.regraId)),
      );

      const validas: LinhaImportacao[] = [];
      const duplicadas: LinhaDuplicada[] = [];
      const erros: { numeroLinha: number; motivo: string }[] = [];
      const paraGravar = new Map<number, LinhaParaGravar>();
      const chavesVistasNaPlanilha = new Map<string, number>();

      linhas.forEach((linha, i) => {
        const numeroLinha = i + 2;
        const nome = linha["atleta"]?.trim();
        if (!nome) {
          if (Object.values(linha).some((v) => v)) erros.push({ numeroLinha, motivo: "atleta vazio" });
          return;
        }
        const atletaDoc = atletaPorNome.get(nome.toLowerCase());
        if (!atletaDoc) {
          erros.push({ numeroLinha, motivo: `atleta "${nome}" não encontrado` });
          return;
        }
        const data = normalizarData(linha["data"] ?? "");
        if (!data) {
          erros.push({ numeroLinha, motivo: `data "${linha["data"]}" inválida (use DD/MM/AAAA ou célula formatada como data)` });
          return;
        }
        if (data > new Date().toISOString().slice(0, 10)) {
          erros.push({ numeroLinha, motivo: "data não pode ser no futuro" });
          return;
        }
        const tipo = linha["tipo"]?.trim().toLowerCase() as TipoLancamento;
        if (!TIPOS_VALIDOS.includes(tipo)) {
          erros.push({ numeroLinha, motivo: `tipo "${linha["tipo"]}" inválido` });
          return;
        }
        const modalidade = modalidadeFromEquipe(atletaDoc.equipe);
        const regraDoc = regras.find(
          (r) =>
            (r.modalidade === "ambas" || r.modalidade === modalidade) &&
            r.tiposLancamento.includes(tipo) &&
            r.descricao.trim().toLowerCase() === linha["regra"]?.trim().toLowerCase(),
        );
        if (!regraDoc) {
          erros.push({ numeroLinha, motivo: `regra "${linha["regra"]}" não encontrada para ${nome}` });
          return;
        }
        const km = Number(linha["km"]);

        const item: LinhaParaGravar = {
          numeroLinha,
          atletaId: atletaDoc.id,
          atletaNome: atletaDoc.nome,
          equipe: atletaDoc.equipe,
          regraId: regraDoc.id,
          regraDesc: regraDoc.descricao,
          pontos: regraDoc.pontos,
          tipo,
          data,
          ...(Number.isFinite(km) && km > 0 ? { km } : {}),
        };
        paraGravar.set(numeroLinha, item);

        const chave = chaveDuplicidade(atletaDoc.id, data, regraDoc.id);
        const linhaAnterior = chavesVistasNaPlanilha.get(chave);
        if (chavesExistentes.has(chave)) {
          duplicadas.push({ ...item, motivo: `Já existe um lançamento igual em ${data.split("-").reverse().join("/")}` });
        } else if (linhaAnterior) {
          duplicadas.push({ ...item, motivo: `Repetida na própria planilha (linha ${linhaAnterior})` });
        } else {
          validas.push(item);
        }
        chavesVistasNaPlanilha.set(chave, numeroLinha);
      });

      setLinhasParaGravar(paraGravar);

      if (validas.length === 0 && duplicadas.length === 0) {
        show("error", erros[0]?.motivo ? `Nenhuma linha válida. Ex: linha ${erros[0].numeroLinha} — ${erros[0].motivo}` : "Nenhuma linha válida encontrada na planilha.");
        return;
      }

      if (duplicadas.length === 0 && erros.length === 0) {
        // Passa o mapa direto em vez de depender do estado — setLinhasParaGravar acima
        // ainda não foi aplicado nesse ponto (setState é assíncrono), então ler o estado
        // aqui pegaria o Map antigo (vazio) e "importaria" 0 linhas por engano.
        await confirmarGravacao(validas, [], paraGravar);
        return;
      }

      setResultado({ validas, duplicadas, erros });
    } catch {
      show("error", "Não foi possível ler a planilha. Verifique o formato e tente novamente.");
    } finally {
      setImportando(false);
    }
  }

  async function confirmarGravacao(
    validas: LinhaImportacao[],
    duplicadasSelecionadas: LinhaDuplicada[],
    mapaGravar: Map<number, LinhaParaGravar> = linhasParaGravar,
  ) {
    setConfirmando(true);
    try {
      const linhas = [...validas, ...duplicadasSelecionadas]
        .map((v) => mapaGravar.get(v.numeroLinha))
        .filter((v): v is LinhaParaGravar => !!v);

      const loteId = doc(collection(db, "historico_pontos")).id;
      const incrementoPorAtleta = new Map<string, number>();

      for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
        const grupo = linhas.slice(i, i + TAMANHO_LOTE);
        const batch = writeBatch(db);
        grupo.forEach((linha) => {
          const ref = doc(collection(db, "historico_pontos"));
          batch.set(ref, {
            id: ref.id,
            atletaId: linha.atletaId,
            atletaNome: linha.atletaNome,
            equipe: linha.equipe,
            regraId: linha.regraId,
            regraDesc: linha.regraDesc,
            pontos: linha.pontos,
            ...(linha.km ? { kmPercorrido: linha.km } : {}),
            tipoLancamento: linha.tipo,
            dataTreino: linha.data,
            loteId,
            criadoPor: uid,
            criadoPorNome: autor.nome,
            criadoEm: serverTimestamp(),
            estornado: false,
          });
          incrementoPorAtleta.set(linha.atletaId, (incrementoPorAtleta.get(linha.atletaId) ?? 0) + linha.pontos);
        });
        await batch.commit();
      }

      const atletaIds = [...incrementoPorAtleta.entries()];
      for (let i = 0; i < atletaIds.length; i += TAMANHO_LOTE) {
        const grupo = atletaIds.slice(i, i + TAMANHO_LOTE);
        const batch = writeBatch(db);
        grupo.forEach(([atletaId, pontos]) => {
          batch.update(doc(db, "atletas", atletaId), {
            pontuacaoTotal: increment(pontos),
            atualizadoEm: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      if (linhas.length > 0) {
        await logAudit({
          acao: "importar_pontuacoes",
          entidade: "historico_pontos",
          entidadeId: loteId,
          dados: { criados: linhas.length, duplicadasIncluidas: duplicadasSelecionadas.length },
          criadoPor: uid,
          criadoPorNome: autor.nome,
        });
      }

      show("success", `${linhas.length} lançamento(s) importado(s) com sucesso.`);
      setResultado(null);
      setLinhasParaGravar(new Map());
    } catch {
      show("error", "Não foi possível concluir a importação agora. Tente novamente.");
    } finally {
      setConfirmando(false);
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
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-40"
          value={equipeModelo}
          onChange={(e) => setEquipeModelo(e.target.value as EquipeModelo)}
        >
          <option value="">Modelo: todos</option>
          <option value="corrida">Modelo: corrida</option>
          <option value="bicicleta">Modelo: bicicleta</option>
        </Select>
        <Button variant="secondary" onClick={handleBaixarModelo} loading={baixandoModelo}>
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

      <RevisarImportacaoModal
        resultado={resultado}
        confirmando={confirmando}
        onCancelar={() => {
          setResultado(null);
          setLinhasParaGravar(new Map());
        }}
        onConfirmar={(duplicadasSelecionadas) =>
          confirmarGravacao(resultado?.validas ?? [], duplicadasSelecionadas)
        }
      />
    </Card>
  );
}
