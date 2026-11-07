import type { LinhaDuplicada, LinhaImportacao } from "@/app/gestao/pontuacao/RevisarImportacaoModal";

/**
 * Funções puras da importação de pontuações (sem Firebase), para testar e
 * reaproveitar. A gravação fica em pontuacaoImportacao.ts.
 */
type Candidata = LinhaImportacao & { atletaId: string; regraId: string; data: string; dataAproximada?: boolean };

export function chaveDuplicidade(atletaId: string, data: string, regraId: string) {
  return `${atletaId}|${data}|${regraId}`;
}

/**
 * Separa o que entra do que parece repetido. `existentes`: as chaves
 * (atleta|data|critério) dos lançamentos que já estão no portal, uma por
 * lançamento (repetições contam).
 *
 * Linhas com data aproximada (treinos extras da planilha antiga, sem dia certo)
 * são sessões diferentes mesmo com a mesma chave: 3 extras no mês são 3 treinos.
 * Para elas, a n-ésima ocorrência só é repetida se o portal já tiver n iguais
 * (assim, reimportar o mês completa o que faltou sem duplicar).
 */
export function analisarDuplicidade<C extends Candidata>(
  candidatas: C[],
  existentes: Iterable<string>,
): { validas: LinhaImportacao[]; duplicadas: LinhaDuplicada[]; paraGravar: Map<number, C> } {
  const validas: LinhaImportacao[] = [];
  const duplicadas: LinhaDuplicada[] = [];
  const paraGravar = new Map<number, C>();
  const chavesVistas = new Map<string, number>();
  const jaNoPortal = new Map<string, number>();
  for (const chave of existentes) jaNoPortal.set(chave, (jaNoPortal.get(chave) ?? 0) + 1);
  const ocorrencias = new Map<string, number>();

  candidatas.forEach((item) => {
    paraGravar.set(item.numeroLinha, item);
    const chave = chaveDuplicidade(item.atletaId, item.data, item.regraId);
    const dataBr = item.data.split("-").reverse().join("/");
    if (item.dataAproximada) {
      const n = (ocorrencias.get(chave) ?? 0) + 1;
      ocorrencias.set(chave, n);
      if ((jaNoPortal.get(chave) ?? 0) >= n) duplicadas.push({ ...item, motivo: `Já lançado no portal (${n}º treino extra de ${dataBr.slice(3)})` });
      else validas.push(item);
      return;
    }
    const linhaAnterior = chavesVistas.get(chave);
    if (jaNoPortal.has(chave)) {
      duplicadas.push({ ...item, motivo: `Já existe um lançamento igual em ${dataBr}` });
    } else if (linhaAnterior) {
      duplicadas.push({ ...item, motivo: `Repetida na própria planilha (linha ${linhaAnterior})` });
    } else {
      validas.push(item);
    }
    chavesVistas.set(chave, item.numeroLinha);
  });

  return { validas, duplicadas, paraGravar };
}

