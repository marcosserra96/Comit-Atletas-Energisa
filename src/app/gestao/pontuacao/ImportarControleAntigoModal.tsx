"use client";

import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { ArrowLeft, FileSpreadsheet, History, Table2, Upload } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  agruparCombos,
  carregarWorkbook,
  listarAbas,
  parsearAba,
  type AbaDetectada,
  type ComboPendente,
} from "@/lib/legado/controleAntigo";
import { analisarDuplicidade, gravarLancamentos, type LinhaParaGravar } from "@/lib/pontuacaoImportacao";
import { RevisarImportacaoModal, type LinhaDuplicada, type LinhaImportacao, type ResultadoAnalise } from "./RevisarImportacaoModal";
import type { AtletaDoc, HistoricoPontoDoc, Modalidade, RegraPontuacaoDoc } from "@/lib/types";
import type ExcelJS from "exceljs";

type Passo = "arquivo" | "mapeamento";

export function ImportarControleAntigoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();

  const [passo, setPasso] = useState<Passo>("arquivo");
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(null);
  const [abas, setAbas] = useState<AbaDetectada[]>([]);
  const [ano, setAno] = useState(() => String(new Date().getFullYear()));

  const [abaEscolhida, setAbaEscolhida] = useState<AbaDetectada | null>(null);
  const [combos, setCombos] = useState<ComboPendente[]>([]);
  const [entradasCount, setEntradasCount] = useState(0);
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});
  const [regras, setRegras] = useState<RegraPontuacaoDoc[] | null>(null);
  const [analisando, setAnalisando] = useState(false);

  const [resultado, setResultado] = useState<ResultadoAnalise | null>(null);
  const [linhasParaGravar, setLinhasParaGravar] = useState<Map<number, LinhaParaGravar>>(new Map());
  const [confirmando, setConfirmando] = useState(false);

  function resetTudo() {
    setPasso("arquivo");
    setWorkbook(null);
    setAbas([]);
    setAbaEscolhida(null);
    setCombos([]);
    setEntradasCount(0);
    setMapeamento({});
    setRegras(null);
  }

  function handleClose() {
    resetTudo();
    onClose();
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCarregandoArquivo(true);
    try {
      const wb = await carregarWorkbook(file);
      const detectadas = listarAbas(wb);
      if (detectadas.length === 0) {
        show("error", "Não encontrei nenhuma aba de controle nesse arquivo.");
        return;
      }
      setWorkbook(wb);
      setAbas(detectadas);
    } catch {
      show("error", "Não foi possível ler esse arquivo. Confira se é o .xlsx do controle antigo.");
    } finally {
      setCarregandoArquivo(false);
    }
  }

  async function escolherAba(aba: AbaDetectada) {
    if (!workbook) return;
    const entradas = parsearAba(workbook, aba.nome);
    if (entradas.length === 0) {
      show("info", `A aba "${aba.nome}" não tem nenhum lançamento preenchido.`);
      return;
    }
    const modalidade: Modalidade = aba.equipeLabel.toLowerCase().startsWith("bike") ? "bicicleta" : "corrida";
    const regrasSnap = await getDocs(collection(db, "regras_pontuacao"));
    const todasRegras = regrasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc);
    setRegras(todasRegras.filter((r) => r.modalidade === "ambas" || r.modalidade === modalidade));
    setAbaEscolhida(aba);
    setCombos(agruparCombos(entradas));
    setEntradasCount(entradas.length);
    setMapeamento({});
    setPasso("mapeamento");
  }

  async function handleContinuar() {
    if (!workbook || !abaEscolhida) return;
    if (!/^\d{4}$/.test(ano)) {
      show("info", "Informe um ano válido (ex: 2026).");
      return;
    }
    if (!abaEscolhida.mesNumero) {
      show("error", `Não consegui identificar o mês da aba "${abaEscolhida.nome}".`);
      return;
    }
    const mapeadas = Object.values(mapeamento).filter(Boolean).length;
    if (mapeadas === 0) {
      show("info", "Vincule ao menos um grupo a uma regra antes de continuar.");
      return;
    }

    setAnalisando(true);
    try {
      const entradas = parsearAba(workbook, abaEscolhida.nome);
      const [atletasSnap, historicoSnap] = await Promise.all([
        getDocs(collection(db, "atletas")),
        getDocs(collection(db, "historico_pontos")),
      ]);
      const atletas = atletasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc);
      const atletaPorNome = new Map(atletas.map((a) => [a.nome.trim().toLowerCase(), a]));
      const chavesExistentes = new Set(
        historicoSnap.docs
          .map((d) => d.data() as HistoricoPontoDoc)
          .filter((h) => !h.estornado)
          .map((h) => `${h.atletaId}|${h.dataTreino}|${h.regraId}`),
      );

      const candidatas: LinhaParaGravar[] = [];
      const erros: { numeroLinha: number; motivo: string }[] = [];
      let numeroLinha = 1;

      for (const entrada of entradas) {
        numeroLinha += 1;
        const chaveCombo = `${entrada.diaSemana}|${entrada.pontos}`;
        const regraId = mapeamento[chaveCombo];
        if (!regraId) continue; // grupo não vinculado — ignorado silenciosamente, já avisado antes de continuar

        const regraDoc = (regras ?? []).find((r) => r.id === regraId);
        if (!regraDoc) continue;

        const atletaDoc = atletaPorNome.get(entrada.atletaNomeBruto.toLowerCase());
        if (!atletaDoc) {
          erros.push({
            numeroLinha,
            motivo: `atleta "${entrada.atletaNomeBruto}" não encontrado (dia ${entrada.dia}, ${entrada.diaSemana})`,
          });
          continue;
        }

        const diaStr = String(entrada.dia).padStart(2, "0");
        const data = `${ano}-${abaEscolhida.mesNumero}-${diaStr}`;
        if (data > new Date().toISOString().slice(0, 10)) {
          erros.push({ numeroLinha, motivo: `data ${diaStr}/${abaEscolhida.mesNumero}/${ano} não pode ser no futuro` });
          continue;
        }

        candidatas.push({
          numeroLinha,
          atletaId: atletaDoc.id,
          atletaNome: atletaDoc.nome,
          equipe: atletaDoc.equipe,
          regraId: regraDoc.id,
          regraDesc: regraDoc.descricao,
          pontos: regraDoc.pontos,
          tipo: regraDoc.tiposLancamento[0] ?? "treino",
          data,
        });
      }

      const { validas, duplicadas, paraGravar } = analisarDuplicidade(candidatas, chavesExistentes);
      setLinhasParaGravar(paraGravar);

      if (validas.length === 0 && duplicadas.length === 0) {
        show(
          "error",
          erros[0]?.motivo
            ? `Nenhum lançamento válido. Ex: ${erros[0].motivo}`
            : "Nenhum lançamento válido encontrado nessa aba.",
        );
        return;
      }

      if (duplicadas.length === 0 && erros.length === 0) {
        await confirmarGravacao(validas, [], paraGravar);
        return;
      }

      setResultado({ validas, duplicadas, erros });
    } catch {
      show("error", "Não foi possível analisar essa aba agora. Tente novamente.");
    } finally {
      setAnalisando(false);
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

      await gravarLancamentos({
        linhas,
        uid,
        autorNome: autor.nome,
        acaoAudit: "importar_controle_antigo",
        dadosAudit: { aba: abaEscolhida?.nome, ano, duplicadasIncluidas: duplicadasSelecionadas.length },
      });

      show("success", `${linhas.length} lançamento(s) importado(s) com sucesso.`);
      setResultado(null);
      handleClose();
    } catch {
      show("error", "Não foi possível concluir a importação agora. Tente novamente.");
    } finally {
      setConfirmando(false);
    }
  }

  const qtdMapeada = Object.values(mapeamento).filter(Boolean).length;

  return (
    <>
      <Modal
        open={open && resultado === null}
        onClose={handleClose}
        title="Importar controle antigo"
        description={
          passo === "arquivo"
            ? "Suba o arquivo de controle (várias abas, uma por mês/equipe) e escolha qual aba importar."
            : `Aba "${abaEscolhida?.nome}" — vincule cada grupo (dia da semana + pontos) a uma regra cadastrada.`
        }
        size="xl"
        footer={
          passo === "mapeamento" ? (
            <>
              <Button variant="secondary" onClick={() => setPasso("arquivo")} disabled={analisando}>
                <ArrowLeft className="size-4" />
                Voltar
              </Button>
              <Button onClick={handleContinuar} loading={analisando} disabled={qtdMapeada === 0}>
                Continuar ({qtdMapeada}/{combos.length} vinculados)
              </Button>
            </>
          ) : undefined
        }
      >
        {passo === "arquivo" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-light">Ano de referência</label>
              <input
                type="number"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                className="h-10 w-28 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <p className="text-xs text-text-muted">
                A planilha antiga não guarda o ano — usado pra montar a data de cada lançamento.
              </p>
            </div>

            {abas.length === 0 ? (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-border p-8 text-center hover:border-primary/40">
                <Upload className="size-6 text-text-muted" />
                <span className="text-sm font-semibold text-text">
                  {carregandoArquivo ? "Lendo arquivo…" : "Clique para escolher o arquivo .xlsx"}
                </span>
                <span className="text-xs text-text-muted">O controle com uma aba por mês/equipe</span>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleArquivo} disabled={carregandoArquivo} />
              </label>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-text-light">Escolha a aba pra importar</p>
                <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                  {abas.map((aba) => (
                    <button
                      key={aba.nome}
                      onClick={() => escolherAba(aba)}
                      className="flex flex-col items-start gap-1 rounded-[var(--radius)] border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
                        <Table2 className="size-3.5 text-text-muted" />
                        {aba.nome}
                      </span>
                      {!aba.mesNumero && (
                        <span className="text-[11px] font-semibold text-danger">Mês não reconhecido</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-muted">
              {entradasCount} lançamento(s) encontrado(s) nessa aba, agrupados em {combos.length} combinações de
              dia da semana + pontos. Grupos sem regra vinculada não serão importados.
            </p>
            <div className="max-h-96 overflow-y-auto rounded-[var(--radius)] border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-bg-card">
                  <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                    <th className="px-3 py-2.5 font-semibold">Dia da semana</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Pontos</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Qtd.</th>
                    <th className="px-3 py-2.5 font-semibold">Regra</th>
                  </tr>
                </thead>
                <tbody>
                  {combos.map((combo) => (
                    <tr key={combo.chave} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium text-text">{combo.diaSemana}</td>
                      <td className="px-3 py-2 text-center text-text-light">{combo.pontos}</td>
                      <td className="px-3 py-2 text-center text-text-light">{combo.quantidade}</td>
                      <td className="px-3 py-2">
                        <Select
                          className="w-full"
                          searchable
                          value={mapeamento[combo.chave] ?? ""}
                          onChange={(e) => setMapeamento((prev) => ({ ...prev, [combo.chave]: e.target.value }))}
                        >
                          <option value="">Não importar</option>
                          {(regras ?? []).map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.descricao} ({r.pontos} pts)
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(regras ?? []).length === 0 && (
              <EmptyState
                icon={History}
                title="Nenhuma regra cadastrada"
                description="Cadastre critérios de pontuação em Configurar Portal → Critérios antes de importar."
              />
            )}
          </div>
        )}
      </Modal>

      <RevisarImportacaoModal
        resultado={resultado}
        confirmando={confirmando}
        onCancelar={() => {
          setResultado(null);
          setLinhasParaGravar(new Map());
        }}
        onConfirmar={(duplicadasSelecionadas) => confirmarGravacao(resultado?.validas ?? [], duplicadasSelecionadas)}
      />
    </>
  );
}

export function BotaoImportarControleAntigo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="size-4" />
        Importar controle antigo
      </Button>
      <ImportarControleAntigoModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
