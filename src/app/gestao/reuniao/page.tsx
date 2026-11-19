"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { AlertTriangle, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, CloudOff, Download, Eye, EyeOff, Info, Loader2, MonitorPlay, Palette, Pencil, Play, Plus, Presentation, Save, Copy, Send, Star, Trash2, UserPlus, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { SlideReuniao } from "@/components/reuniao/SlidesReuniao";
import { Apresentador, SlideEscalado, gerarPdfDosSlides, type AcaoDoSlide } from "@/components/reuniao/Apresentador";
import { EditorDoSlide, GaleriaDeSlides, useAcoesDoRoteiro } from "@/components/reuniao/EditorRoteiro";
import { BotaoDaFaixa, FaixaDeOpcoes, GrupoDaFaixa, SeparadorDaFaixa } from "@/components/reuniao/FaixaDeOpcoes";
import { PainelDeSlides } from "@/components/reuniao/PainelDeSlides";
import { useSorteio } from "@/components/reuniao/useSorteio";
import { useEnquetes } from "@/components/reuniao/useEnquetes";
import { DURACAO_ENQUETE_MS, pesquisaDaEnquete } from "@/lib/enquete";
import { TemaApresentacao } from "@/components/reuniao/TemaApresentacao";
import { NoticiaModal } from "@/app/gestao/noticias/NoticiaModal";
import { AvatarAtleta } from "@/components/atletas/AvatarAtleta";
import { temPermissao } from "@/lib/permissoes";
import { carregarTodosLancamentos } from "@/lib/lancamentosCache";
import { useRegrasDeTreino } from "@/lib/useRegrasDeTreino";
import { useDiasTreino } from "@/lib/useDiasTreino";
import { calcularPremio, type ResultadoPremio } from "@/lib/premiacaoPersonalizada";
import { useFotosAtletas } from "@/lib/fotos";
import { useQrDataUrl } from "@/lib/useQrDataUrl";
import { buscaCombina } from "@/lib/semelhancaNome";
import { horarioDoEvento } from "@/lib/eventos";
import { formatShortDate, plural } from "@/lib/format";
import { modalidadeLabel } from "@/lib/labels";
import { hojeBrasil, normalizarCalendario, ordenarTrimestres, trimestreVigente, type CalendarioPremiacaoDoc } from "@/lib/calendarioPremiacao";
import { apagarReuniao, listarReunioes, salvarReuniao, useImagensReuniao, usePresentesNaReuniao, useQrPresenca } from "@/lib/reuniaoCliente";
import { listarDesafios } from "@/lib/desafiosCliente";
import { agruparPorAtleta, participacaoNoDesafio, type DesafioDoc } from "@/lib/desafios";
import { calcularSequencia } from "@/lib/conquistas";
import { consolidarAtividades } from "@/lib/activityConsolidation";
import {
  agendaDoAno,
  aniversariantesDoPeriodo,
  completarSecoes,
  destaquesDoPeriodo,
  periodoDoAnoAte,
  membroAtivoDaEquipe,
  montarRoteiro,
  periodoAnterior,
  periodoDoAno,
  trechoEquivalente,
  novosAtletas,
  periodosDeApuracao,
  regrasParaSlide,
  resultadosDaEquipe,
  reuniaoPadrao,
  verificarAntesDeApresentar,
  resumoParaAtletas,
  temaDaReuniao,
  nomeDaSecao,
  duplicarReuniao,
  FATOR_VELOCIDADE,
  passosDoSlide,
  type ReuniaoResultadosDoc,
} from "@/lib/reuniaoResultados";
import type { AtletaDoc, EventoDoc, HistoricoMensalDoc, HistoricoPontoDoc, RegraPontuacaoDoc } from "@/lib/types";

type Rascunho = Omit<ReuniaoResultadosDoc, "id"> & { id?: string };

/** Tudo que os slides usam, carregado uma vez. */
function useDadosReuniao() {
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [lancamentos, setLancamentos] = useState<HistoricoPontoDoc[] | null>(null);
  const [mensais, setMensais] = useState<HistoricoMensalDoc[] | null>(null);
  const [regras, setRegras] = useState<RegraPontuacaoDoc[] | null>(null);
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [calendario, setCalendario] = useState<CalendarioPremiacaoDoc | null>(null);
  const [erro, setErro] = useState(false);
  const regrasTreino = useRegrasDeTreino();

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "atletas"),
      (snap) => setAtletas(snap.docs.map((d) => ({ ...(d.data() as AtletaDoc), id: d.id }))),
      () => setErro(true),
    );
    carregarTodosLancamentos().then(setLancamentos, () => setErro(true));
    getDocs(collection(db, "historico_mensal")).then((s) => setMensais(s.docs.map((d) => ({ ...(d.data() as HistoricoMensalDoc), id: d.id }))), () => setMensais([]));
    getDocs(collection(db, "regras_pontuacao")).then((s) => setRegras(s.docs.map((d) => ({ ...(d.data() as RegraPontuacaoDoc), id: d.id }))), () => setRegras([]));
    getDocs(collection(db, "agenda_eventos")).then((s) => setEventos(s.docs.map((d) => ({ ...(d.data() as EventoDoc), id: d.id }))), () => setEventos([]));
    getDoc(doc(db, "configuracoes", "calendario_premiacao")).then(
      (s) => setCalendario(normalizarCalendario(s.data() as Partial<CalendarioPremiacaoDoc> | undefined)),
      () => setCalendario(normalizarCalendario(undefined)),
    );
    return unsub;
  }, []);

  const pronto = !!(atletas && lancamentos && mensais && regras && eventos && calendario && regrasTreino);
  return { atletas, lancamentos, mensais, regras, eventos, calendario, regrasTreino, pronto, erro };
}

/**
 * Período padrão: o último trimestre encerrado (é o que a reunião de resultados
 * apresenta); sem nenhum encerrado, o que está valendo; sem calendário, os 3 meses anteriores.
 */
function periodoPadrao(cal: CalendarioPremiacaoDoc, hoje: string) {
  const ordenados = ordenarTrimestres(cal.trimestres);
  const t = ordenados.filter((x) => x.fim < hoje).at(-1) ?? trimestreVigente(cal, hoje) ?? ordenados.filter((x) => x.inicio <= hoje).at(-1);
  if (t) return { nome: t.nome, inicio: t.inicio, fim: t.fim };
  const d = new Date(`${hoje}T12:00:00`);
  const ini = new Date(d.getFullYear(), d.getMonth() - 3, 1);
  const fim = new Date(d.getFullYear(), d.getMonth(), 0);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { nome: "Últimos 3 meses", inicio: iso(ini), fim: iso(fim) };
}

/** Reunião da agenda mais adequada: a de hoje ou a próxima; senão, a última. */
function reuniaoDaAgenda(eventos: EventoDoc[], hoje: string) {
  const reunioes = eventos.filter((e) => e.tipo === "reuniao").sort((a, b) => a.data.localeCompare(b.data));
  return reunioes.find((e) => e.data >= hoje) ?? reunioes.at(-1) ?? null;
}

function slug(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Revisão de "Novos atletas": quem entrou no período e ajustes manuais. */
function EditorNovos({
  atletas,
  novos,
  rascunho,
  onChange,
}: {
  atletas: AtletaDoc[];
  novos: AtletaDoc[];
  rascunho: Rascunho;
  onChange: (campos: Partial<Rascunho>) => void;
}) {
  const [busca, setBusca] = useState("");
  const fotos = useFotosAtletas(novos);
  const ids = new Set(novos.map((a) => a.id));
  const candidatos = busca.trim()
    ? atletas
        .filter((a) => (a.equipe === "corrida" || a.equipe === "bicicleta") && a.visivelNasListas !== false && !ids.has(a.id) && buscaCombina(busca, a.nome))
        .slice(0, 6)
    : [];

  function tirar(id: string) {
    onChange({ novosIncluir: rascunho.novosIncluir.filter((x) => x !== id), novosExcluir: [...new Set([...rascunho.novosExcluir, id])] });
  }
  function incluir(id: string) {
    onChange({ novosExcluir: rascunho.novosExcluir.filter((x) => x !== id), novosIncluir: [...new Set([...rascunho.novosIncluir, id])] });
    setBusca("");
  }

  return (
    <div className="flex flex-col gap-3">
      {novos.length === 0 ? (
        <p className="rounded-[var(--radius)] bg-bg-inset p-3 text-sm text-text-light">
          Ninguém entrou nas equipes no período. Se houver, adicione abaixo; sem ninguém, a seção não aparece.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {novos.map((a) => (
            <li key={a.id} className="flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-2 hover:bg-bg-inset">
              <AvatarAtleta nome={a.nome} foto={fotos[a.id]} className="size-8 text-xs" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{a.nome}</span>
              {!a.fotoVersao ? <span className="hidden text-xs text-warning sm:inline">sem foto</span> : null}
              <span className="text-xs text-text-light">{a.equipe === "bicicleta" ? modalidadeLabel.bicicleta : modalidadeLabel.corrida}</span>
              <button type="button" onClick={() => tirar(a.id)} aria-label={`Tirar ${a.nome}`} className="flex size-8 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-bg px-3 focus-within:border-primary focus-within:bg-bg-card focus-within:ring-2 focus-within:ring-primary/15">
          <UserPlus className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Adicionar atleta pelo nome"
            aria-label="Adicionar atleta pelo nome"
            className="h-10 w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
          />
        </div>
        {candidatos.length > 0 ? (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-[var(--radius)] border border-border bg-bg-card shadow-lg">
            {candidatos.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => incluir(a.id)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-bg-inset">
                  <Plus className="size-4 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                  <span className="text-xs text-text-light">{a.equipe === "bicicleta" ? modalidadeLabel.bicicleta : modalidadeLabel.corrida}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="text-xs text-text-muted">
        Entra sozinho quem foi colocado numa equipe dentro do período (pela ficha ou no cadastro). A foto vem da ficha do atleta.
      </p>
    </div>
  );
}

/** Pré-voo: o que vai sair errado no telão, com o atalho para resolver. */
function AntesDeApresentar({ itens }: { itens: ReturnType<typeof verificarAntesDeApresentar> }) {
  if (itens.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] border border-success/30 bg-success-subtle px-4 py-3" role="status">
        <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
        <p className="text-sm font-semibold text-text">Pronto para apresentar</p>
      </div>
    );
  }
  const atencao = itens.filter((i) => i.nivel === "atencao").length;
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm font-bold text-text">
        Antes de apresentar{" "}
        {atencao > 0 ? <span className="font-semibold text-accent">· {atencao === 1 ? "1 ponto para ver" : `${atencao} pontos para ver`}</span> : null}
      </p>
      <ul className="flex flex-col gap-3">
        {itens.map((v) => (
          <li key={v.id} className="flex gap-2.5">
            {v.nivel === "atencao" ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">{v.texto}</p>
              {v.detalhe ? <p className="mt-0.5 text-xs text-text-light">{v.detalhe}</p> : null}
              {v.acao ? (
                <Link href={v.acao.href} className="mt-1 inline-flex min-h-9 items-center text-xs font-bold text-primary hover:underline pointer-coarse:min-h-11">
                  {v.acao.rotulo}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function ReuniaoResultadosPage() {
  const { usuario, uid, atleta: eu } = useActiveSession();
  const podeEnquete = temPermissao(usuario, "pesquisas");
  const { show } = useToast();
  const pode = temPermissao(usuario, "informativo");
  const dados = useDadosReuniao();
  // Agenda de treinos: só a aderência das premiações com critérios usa.
  const diasTreino = useDiasTreino();
  const hoje = hojeBrasil();

  const [salvas, setSalvas] = useState<ReuniaoResultadosDoc[] | null>(null);
  const [desafios, setDesafios] = useState<DesafioDoc[]>([]);
  const [rascunhoEditado, setRascunho] = useState<Rascunho | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  // Como no PowerPoint: a aba da faixa de opções, se ela está recolhida e o slide escolhido.
  const [aba, setAba] = useState<"inicio" | "slide" | "design" | "reuniao" | "arquivo">("inicio");
  const [recolhida, setRecolhida] = useState(false);
  const [selecao, setSelecao] = useState<{ secao: string | null; chave: string | null }>({ secao: null, chave: null });
  const [galeria, setGaleria] = useState(false);
  // Cada edição sobe a versão: um salvamento só limpa o "alterado" se nada mudou enquanto salvava.
  const versao = useRef(0);
  const [salvando, setSalvando] = useState(false);
  const [apresentando, setApresentando] = useState<number | null>(null);
  const [exportando, setExportando] = useState<number | null>(null);
  const [formato, setFormato] = useState<"pdf" | "pptx">("pdf");
  const [apagando, setApagando] = useState(false);
  const [envio, setEnvio] = useState<{ versao: number; aberto: boolean }>({ versao: 0, aberto: false });
  const podeEnviar = temPermissao(usuario, "noticias");
  const nosPdf = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!pode) return;
    listarReunioes().then((l) => setSalvas(l.map(completarSecoes)), () => setSalvas([]));
    listarDesafios().then(setDesafios, () => setDesafios([]));
  }, [pode]);

  const criarNova = useCallback(() => {
    if (!dados.calendario || !dados.eventos) return;
    setRascunho(reuniaoPadrao(periodoPadrao(dados.calendario, hoje), reuniaoDaAgenda(dados.eventos, hoje)?.id ?? null));
    versao.current += 1;
    setAlterado(true);
  }, [dados.calendario, dados.eventos, hoje]);

  // Próxima reunião a partir desta: roteiro, slides escritos, textos e aparência iguais.
  function duplicar() {
    if (!rascunho || !dados.calendario || !dados.eventos) return;
    setRascunho(duplicarReuniao(rascunho, periodoPadrao(dados.calendario, hoje), reuniaoDaAgenda(dados.eventos, hoje)?.id ?? null));
    versao.current += 1;
    setAlterado(true);
    show("success", "Cópia criada com o período e a reunião da agenda atuais. Ela salva sozinha.");
  }

  // Sem nada aberto: a última reunião salva ou, sem nenhuma, uma nova pelo roteiro padrão.
  const inicial = useMemo<Rascunho | null>(() => {
    if (salvas === null || !dados.calendario || !dados.eventos) return null;
    return salvas[0] ?? reuniaoPadrao(periodoPadrao(dados.calendario, hoje), reuniaoDaAgenda(dados.eventos, hoje)?.id ?? null);
  }, [salvas, dados.calendario, dados.eventos, hoje]);
  const rascunho = rascunhoEditado ?? inicial;
  const pendente = alterado || (!rascunhoEditado && !!inicial && !inicial.id);

  function atualizar(campos: Partial<Rascunho>) {
    setRascunho((r) => {
      const base = r ?? inicial;
      return base ? { ...base, ...campos } : r;
    });
    versao.current += 1;
    setAlterado(true);
  }

  const eventoId = rascunho?.eventoId;
  const evento = useMemo(() => dados.eventos?.find((e) => e.id === eventoId) ?? null, [dados.eventos, eventoId]);

  const calculo = useMemo(() => {
    if (!dados.pronto || !rascunho) return null;
    const { periodo } = rascunho;
    const atletas = dados.atletas!;
    const novos = novosAtletas({ atletas, inicio: periodo.inicio, ate: hoje, incluir: rascunho.novosIncluir, excluir: rascunho.novosExcluir });
    const idsNovos = new Set(novos.map((a) => a.id));
    /**
     * Números de um período: resultados das equipes, o anterior para comparar,
     * destaques e desafios. Vale para o período da reunião e para o "ano até agora".
     */
    const calcularBloco = (p: { nome: string; inicio: string; fim: string }, antFixo?: { nome: string; inicio: string; fim: string }) => {
      const comum = { atletas, lancamentos: dados.lancamentos!, resumosMensais: dados.mensais!, inicio: p.inicio, fim: p.fim, regrasTreino: dados.regrasTreino!, novos: idsNovos };
      const corrida = resultadosDaEquipe({ modalidade: "corrida", ...comum });
      const bicicleta = resultadosDaEquipe({ modalidade: "bicicleta", ...comum });
      // Período anterior (trimestre de antes ou a mesma duração), para a variação e "quem mais evoluiu".
      const antInteiro = antFixo ?? periodoAnterior(p, dados.calendario!.trimestres);
      // Período ainda correndo: compara com o mesmo trecho do anterior (senão a queda é falsa).
      const ant = hoje < p.fim ? trechoEquivalente(antInteiro, p.inicio, hoje) : antInteiro;
      const comumAnt = { ...comum, inicio: ant.inicio, fim: ant.fim, novos: undefined };
      const anterior = { nome: ant.nome, corrida: resultadosDaEquipe({ modalidade: "corrida", ...comumAnt }), bicicleta: resultadosDaEquipe({ modalidade: "bicicleta", ...comumAnt }) };
      const temAnterior = anterior.corrida.totais.treinos + anterior.bicicleta.totais.treinos > 0;
      // Semanas seguidas treinando até o fim do período.
      const ate = p.fim < hoje ? p.fim : hoje;
      const porAtleta = agruparPorAtleta(dados.lancamentos!.filter((l) => !l.estornado && l.dataTreino <= ate));
      const sequencias = new Map<string, number>();
      for (const a of atletas) {
        if (!membroAtivoDaEquipe(a, "corrida") && !membroAtivoDaEquipe(a, "bicicleta")) continue;
        sequencias.set(a.id, calcularSequencia(porAtleta.get(a.id) ?? [], dados.regrasTreino!, ate).atual);
      }
      const atividades = consolidarAtividades(
        dados.lancamentos!.filter((l) => !l.estornado && l.dataTreino >= p.inicio && l.dataTreino <= ate),
        dados.regrasTreino!,
      );
      const itensDestaque = destaquesDoPeriodo({ atletas, atual: { corrida, bicicleta }, anterior: temAnterior ? anterior : null, sequencias, sequenciaAte: ate, atividades });
      const desafiosDoPeriodo = desafios
        .filter((d) => d.inicio <= p.fim && d.fim >= p.inicio && d.inicio <= hoje)
        .map((d) => {
          const part = participacaoNoDesafio({ desafio: d, atletas, porAtleta, regrasTreino: dados.regrasTreino!, hoje: ate });
          return { titulo: d.titulo, concluidos: part.concluidos, participantes: part.participantes.length };
        })
        .filter((d) => d.participantes > 0);
      return { corrida, bicicleta, anterior, temAnterior, ant, itensDestaque, desafiosDoPeriodo };
    };
    const { corrida, bicicleta, anterior, temAnterior, ant, itensDestaque, desafiosDoPeriodo } = calcularBloco(periodo);
    // "Ano até agora": só calcula se alguma seção ligada pedir.
    const pedeAno = rascunho.secoes.some((x) => x.ativo && x.periodo === "ano");
    const blocoAno = (() => {
      if (!pedeAno) return null;
      const pAno = periodoDoAnoAte(dados.calendario!.trimestres, periodo.fim);
      const menosUmAno = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`.replace(/-02-29$/, "-02-28");
      const b = calcularBloco(pAno, { nome: String(Number(pAno.inicio.slice(0, 4)) - 1), inicio: menosUmAno(pAno.inicio), fim: menosUmAno(pAno.fim) });
      return {
        periodo: pAno,
        corrida: b.corrida,
        bicicleta: b.bicicleta,
        anterior: b.temAnterior ? { nome: b.ant.nome, corrida: b.anterior.corrida.totais, bicicleta: b.anterior.bicicleta.totais } : null,
        destaques: { itens: b.itensDestaque, desafios: b.desafiosDoPeriodo },
      };
    })();
    // Premiações com critérios: mesmo motor das Análises, no período da reunião ou no ano até o fim dele.
    const dadosAnalise = { atletas, lancamentos: dados.lancamentos!, resumos: dados.mensais!, regrasTreino: dados.regrasTreino!, diasTreino, hoje };
    const premios: Record<string, ResultadoPremio> = {};
    for (const p of rascunho.premios ?? []) {
      if (!rascunho.secoes.some((x) => x.tipo === "premio" && x.id === p.id)) continue;
      premios[p.id] = calcularPremio(p, dadosAnalise, p.periodo === "ano" ? periodoDoAnoAte(dados.calendario!.trimestres, periodo.fim) : periodo);
    }
    const aniversariantes = aniversariantesDoPeriodo(atletas, periodo.inicio, periodo.fim);
    const pontosReuniao = Math.max(0, ...dados.regras!.filter((r) => r.tiposLancamento?.includes("reuniao")).map((r) => r.pontos)) || null;
    const slides = montarRoteiro({
      reuniao: rascunho,
      corrida,
      bicicleta,
      novos: novos.map((a) => ({ id: a.id, nome: a.nome, modalidade: a.equipe === "bicicleta" ? "bicicleta" : "corrida", fotoVersao: a.fotoVersao })),
      regras: regrasParaSlide(dados.regras!),
      periodos: periodosDeApuracao(dados.calendario!.trimestres, periodo.fim.slice(0, 4), hoje),
      agenda: agendaDoAno(dados.eventos!, periodo.fim.slice(0, 4), hoje),
      evento: evento
        ? {
            id: evento.id,
            titulo: evento.titulo,
            horario: `${formatShortDate(evento.data)} · ${horarioDoEvento(evento)}`,
            // Horário de Brasília (o portal inteiro trabalha nele).
            inicioEm: evento.horaInicio ? `${evento.data}T${evento.horaInicio}:00-03:00` : null,
          }
        : null,
      pontosReuniao,
      hoje,
      anterior: temAnterior ? { nome: ant.nome, corrida: anterior.corrida.totais, bicicleta: anterior.bicicleta.totais } : null,
      destaques: { itens: itensDestaque, desafios: desafiosDoPeriodo },
      aniversariantes,
      ano: blocoAno,
      premios,
    });
    const comFoto = [
      ...novos,
      ...[corrida, bicicleta].flatMap((e) => e.podio.flatMap((d) => d.atletas)),
      ...itensDestaque.map((d) => d.atleta),
      ...(blocoAno ? [...[blocoAno.corrida, blocoAno.bicicleta].flatMap((e) => e.podio.flatMap((d) => d.atletas)), ...blocoAno.destaques.itens.map((d) => d.atleta)] : []),
      ...aniversariantes,
      ...slides.flatMap((sl) => (sl.tipo === "premio" ? sl.colocados.map((c) => c.atleta) : [])),
    ];
    return { slides, novos, corrida, bicicleta, comFoto, itensDestaque, desafiosDoPeriodo, premios };
  }, [dados, rascunho, evento, hoje, desafios, diasTreino]);

  const presentes = usePresentesNaReuniao(evento?.id ?? null);
  const presentesSorteio = useMemo(() => presentes?.map((p) => ({ id: p.atletaId, nome: p.nome, equipe: p.equipe })) ?? null, [presentes]);
  const sorteio = useSorteio(presentesSorteio, evento?.id ?? null);
  const listaEnquetes = useMemo(
    () => (calculo?.slides ?? []).flatMap((sl) => (sl.tipo === "enquete" && sl.pesquisaId ? [{ pesquisaId: sl.pesquisaId, opcoes: sl.opcoes }] : [])),
    [calculo],
  );
  const enquetes = useEnquetes(listaEnquetes);
  // Fotos de quem aparece nos slides, mais os sorteados (aparecem na hora).
  const comFoto = useMemo(() => {
    const ganhadores = new Set(sorteio.estado.ganhadores);
    return [...(calculo?.comFoto ?? []), ...(dados.atletas ?? []).filter((a) => ganhadores.has(a.id))];
  }, [calculo, dados.atletas, sorteio.estado.ganhadores]);
  const fotos = useFotosAtletas(comFoto);
  const imagens = useImagensReuniao((rascunho?.livres ?? []).map((l) => l.imagemId).filter((x): x is string => !!x));
  const { qr: qrPresenca, semPermissao } = useQrPresenca(evento);
  const urlApp = typeof window !== "undefined" ? `${window.location.host}/instalar` : "/instalar";
  const qrApp = useQrDataUrl(typeof window !== "undefined" ? `${window.location.origin}/instalar` : "", 800) || null;

  const tema = useMemo(() => temaDaReuniao(rascunho?.tema), [rascunho?.tema]);
  const textos = rascunho?.textos;
  const renderSlide = useCallback(
    (i: number, paraPdf = false, aoVivo?: { passo?: number; aoVivo?: boolean }) =>
      calculo?.slides[i] ? (
        <SlideReuniao
          slide={calculo.slides[i]}
          fotos={fotos}
          imagens={imagens}
          qrPresenca={qrPresenca}
          presencaSemPermissao={semPermissao}
          qrApp={qrApp}
          urlApp={urlApp}
          presentes={paraPdf ? null : (presentes?.length ?? null)}
          sorteio={paraPdf ? undefined : sorteio.estado}
          tema={tema}
          passo={aoVivo && tema.revelarPodio ? aoVivo.passo : undefined}
          animar={!!aoVivo?.aoVivo && tema.animacoes}
          aoVivo={!!aoVivo?.aoVivo}
          textos={textos}
          enquetes={enquetes}
        />
      ) : null,
    [calculo, fotos, imagens, qrPresenca, semPermissao, qrApp, urlApp, presentes, sorteio.estado, tema, textos, enquetes],
  );
  const renderNaApresentacao = useCallback((i: number, opcoes?: { passo?: number; aoVivo?: boolean }) => renderSlide(i, false, opcoes ?? {}), [renderSlide]);
  const passosNaApresentacao = useCallback((i: number) => passosDoSlide(calculo?.slides[i], tema), [calculo, tema]);

  const rascunhoAtual = useRef(rascunho);
  useEffect(() => {
    rascunhoAtual.current = rascunho;
  }, [rascunho]);

  const salvar = useCallback(
    async (silencioso: boolean) => {
      const atual = rascunhoAtual.current;
      if (!atual) return;
      const v = versao.current;
      setSalvando(true);
      try {
        const id = await salvarReuniao(atual);
        setRascunho((r) => (r ? { ...r, id } : { ...atual, id }));
        if (versao.current === v) setAlterado(false);
        setErroSalvar(null);
        setSalvas((await listarReunioes()).map(completarSecoes));
        if (!silencioso) show("success", "Reunião salva.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Não foi possível salvar.";
        setErroSalvar(msg);
        if (!silencioso) show("error", msg);
      } finally {
        setSalvando(false);
      }
    },
    [show],
  );

  // Salva sozinho 2 s depois da última mudança (sem toast; o estado aparece no topo).
  useEffect(() => {
    if (!alterado || salvando || erroSalvar) return;
    const t = setTimeout(() => void salvar(true), 2000);
    return () => clearTimeout(t);
  }, [rascunho, alterado, salvando, erroSalvar, salvar]);

  // Saindo com algo por salvar: o navegador pergunta antes.
  useEffect(() => {
    if (!alterado && !salvando) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado, salvando]);

  // A faixa recolhida fica lembrada neste aparelho.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem("reuniao:faixa") === "recolhida") setRecolhida(true);
      } catch {
        /* sem armazenamento */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  function mudarRecolhida(r: boolean) {
    setRecolhida(r);
    try {
      window.localStorage.setItem("reuniao:faixa", r ? "recolhida" : "aberta");
    } catch {
      /* sem armazenamento */
    }
  }

  const acoes = useAcoesDoRoteiro(rascunho ?? { secoes: [], livres: [] }, (r) => atualizar(r), (secaoId) => {
    // Slide novo (ou cópia): fica escolhido e a faixa abre na edição dele.
    setSelecao({ secao: secaoId, chave: null });
    setAba("slide");
    mudarRecolhida(false);
  });

  // Slide escolhido: pela chave; se ela sumiu (números mudaram), o primeiro da seção; senão, o primeiro.
  const slides = calculo?.slides;
  const indiceAtual = useMemo(() => {
    if (!slides?.length) return 0;
    const porChave = selecao.chave ? slides.findIndex((x) => x.chave === selecao.chave) : -1;
    if (porChave >= 0) return porChave;
    const daSecao = selecao.secao ? slides.findIndex((x) => x.secaoId === selecao.secao) : -1;
    return daSecao >= 0 ? daSecao : 0;
  }, [slides, selecao]);
  const secaoSelecionada = selecao.secao ?? slides?.[indiceAtual]?.secaoId ?? null;

  const secoesDoPainel = useMemo(
    () =>
      (rascunho?.secoes ?? []).map((sec) => ({
        id: sec.id,
        nome: nomeDaSecao(sec, rascunho?.livres.find((l) => l.id === sec.id), rascunho?.premios?.find((p) => p.id === sec.id)),
        ativo: sec.ativo,
        slides: (slides ?? []).flatMap((sl, i) => (sl.secaoId === sec.id ? [{ indice: i, chave: sl.chave, rotulo: sl.rotulo ?? "" }] : [])),
      })),
    [rascunho, slides],
  );

  function selecionarSlide(i: number) {
    const sl = slides?.[i];
    if (!sl) return;
    setSelecao({ secao: sl.secaoId ?? null, chave: sl.chave });
    document.getElementById(`miniatura-${sl.chave}`)?.scrollIntoView({ block: "nearest" });
  }
  function selecionarSecao(id: string) {
    const primeiro = slides?.find((x) => x.secaoId === id);
    setSelecao({ secao: id, chave: primeiro?.chave ?? null });
  }
  function irPorSeta(d: number) {
    if (!slides?.length) return;
    selecionarSlide(Math.min(slides.length - 1, Math.max(0, indiceAtual + d)));
  }
  function excluirSecao(id: string) {
    const i = rascunho?.secoes.findIndex((x) => x.id === id) ?? -1;
    const vizinha = rascunho?.secoes[i + 1] ?? rascunho?.secoes[i - 1];
    acoes.remover(id);
    setSelecao({ secao: vizinha?.id ?? null, chave: null });
  }

  // Atalhos do PowerPoint: F5 apresenta do início, Shift+F5 deste slide, setas trocam o slide, Ctrl+D duplica.
  const atalhos = useRef({ irPorSeta, indiceAtual, secaoSelecionada, duplicar: acoes.duplicar, podeDuplicar: acoes.podeDuplicar, total: slides?.length ?? 0 });
  useEffect(() => {
    atalhos.current = { irPorSeta, indiceAtual, secaoSelecionada, duplicar: acoes.duplicar, podeDuplicar: acoes.podeDuplicar, total: slides?.length ?? 0 };
  });
  useEffect(() => {
    if (apresentando !== null) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=listbox]") || alvo.isContentEditable)) return;
      const a = atalhos.current;
      if (e.key === "F5" && a.total > 0) {
        e.preventDefault();
        setApresentando(e.shiftKey ? a.indiceAtual : 0);
      } else if ((e.key === "ArrowDown" || e.key === "PageDown") && !e.altKey) {
        e.preventDefault();
        a.irPorSeta(1);
      } else if ((e.key === "ArrowUp" || e.key === "PageUp") && !e.altKey) {
        e.preventDefault();
        a.irPorSeta(-1);
      } else if ((e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey) && a.secaoSelecionada && a.podeDuplicar(a.secaoSelecionada)) {
        e.preventDefault();
        a.duplicar(a.secaoSelecionada);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [apresentando]);

  const verificacoes = useMemo(() => {
    if (!calculo || !rascunho || !dados.eventos || !dados.lancamentos) return null;
    // Quem aparece com foto nos slides que vão ao telão (pódio, novos, destaques, aniversariantes).
    type Pessoa = { id: string; nome: string; fotoVersao?: number };
    const naTela = calculo.slides.flatMap((sl): Pessoa[] =>
      sl.tipo === "podio"
        ? sl.podio.flatMap((d) => d.atletas)
        : sl.tipo === "novos" || sl.tipo === "aniversariantes"
          ? sl.atletas
          : sl.tipo === "destaques"
            ? sl.itens.map((d) => d.atleta)
            : sl.tipo === "premio"
              ? sl.colocados.map((c) => c.atleta)
              : [],
    );
    const vistos = new Set<string>();
    const semFoto = naTela.filter((a) => !a.fotoVersao && !vistos.has(a.id) && vistos.add(a.id)).map((a) => ({ id: a.id, nome: a.nome }));
    return verificarAntesDeApresentar({ reuniao: rascunho, eventos: dados.eventos, lancamentos: dados.lancamentos, semFoto, hoje, podeEnquete });
  }, [calculo, rascunho, dados.eventos, dados.lancamentos, hoje, podeEnquete]);

  async function baixarPptx() {
    if (!calculo || !rascunho) return;
    setFormato("pptx");
    setExportando(0);
    try {
      await new Promise((r) => setTimeout(r, 400));
      const nos = nosPdf.current.slice(0, calculo.slides.length).filter((n): n is HTMLDivElement => !!n);
      const { gerarPptxDosSlides } = await import("@/lib/pptxReuniao");
      await gerarPptxDosSlides({
        slides: calculo.slides,
        nos,
        notas: notaDoSlide,
        imagens,
        temaFonte: tema.fonte,
        titulo: rascunho.titulo,
        nomeArquivo: `reuniao-resultados-${slug(rascunho.periodo.nome)}-${rascunho.periodo.inicio.slice(0, 4)}.pptx`,
        onProgresso: setExportando,
      });
      show("success", "PowerPoint gerado. Os slides escritos pelo comitê vêm com texto editável.");
    } catch {
      show("error", "Não foi possível gerar o PowerPoint agora. Tente novamente.");
    } finally {
      setExportando(null);
    }
  }

  async function baixarPdf() {
    if (!calculo || !rascunho) return;
    setFormato("pdf");
    setExportando(0);
    try {
      // Espera os slides fora da tela renderizarem (fotos e QR já em cache).
      await new Promise((r) => setTimeout(r, 400));
      const nos = nosPdf.current.slice(0, calculo.slides.length).filter((n): n is HTMLDivElement => !!n);
      await gerarPdfDosSlides(nos, `reuniao-resultados-${slug(rascunho.periodo.nome)}-${rascunho.periodo.inicio.slice(0, 4)}.pdf`, setExportando);
      show("success", "PDF gerado.");
    } catch {
      show("error", "Não foi possível gerar o PDF agora. Tente novamente.");
    } finally {
      setExportando(null);
    }
  }

  // Notas do apresentador: uma por seção do roteiro (vale para todas as páginas dela).
  function notaDoSlide(i: number) {
    const secaoId = calculo?.slides[i]?.secaoId;
    return secaoId ? (rascunho?.notas?.[secaoId] ?? "") : "";
  }
  function mudarNota(i: number, texto: string) {
    const secaoId = calculo?.slides[i]?.secaoId;
    if (!secaoId) return;
    atualizar({ notas: { ...(rascunhoAtual.current?.notas ?? {}), [secaoId]: texto } });
  }
  /** Seção do roteiro do slide, para o relógio "nesta parte" da tela do apresentador. */
  function secaoDoSlide(i: number) {
    const secaoId = calculo?.slides[i]?.secaoId;
    const sec = secaoId ? rascunho?.secoes.find((x) => x.id === secaoId) : undefined;
    if (!sec || !rascunho) return null;
    return { id: sec.id, nome: nomeDaSecao(sec, rascunho.livres.find((l) => l.id === sec.id), rascunho.premios?.find((p) => p.id === sec.id)), minutos: rascunho.tempos?.[sec.id] };
  }
  const minutosPlanejados = rascunho
    ? rascunho.secoes.filter((x) => x.ativo).reduce((soma, x) => soma + (rascunho.tempos?.[x.id] ?? 0), 0)
    : 0;

  /** Enquete: publica a pergunta como pesquisa (sem aviso no celular) e guarda o id no slide. */
  async function abrirEnquete(livreId: string, pergunta: string, opcoes: string[]) {
    if (opcoes.length < 2) {
      show("error", "A enquete precisa de pelo menos 2 opções.");
      return;
    }
    try {
      const ref = doc(collection(db, "pesquisas"));
      const agora = new Date();
      const dados = pesquisaDaEnquete({ id: ref.id, pergunta, opcoes, agora, uid, nome: eu.nome });
      await setDoc(ref, {
        ...dados,
        abreEmTs: Timestamp.fromDate(new Date(dados.abreEm)),
        fechaEmTs: Timestamp.fromDate(new Date(dados.fechaEm)),
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
      const atual = rascunhoAtual.current;
      if (atual) atualizar({ livres: atual.livres.map((l) => (l.id === livreId ? { ...l, pesquisaId: ref.id } : l)) });
    } catch {
      show("error", "Não foi possível abrir a votação. Confira se você tem a permissão Pesquisas.");
    }
  }
  async function mudarFimDaEnquete(pesquisaId: string, fim: Date) {
    try {
      await updateDoc(doc(db, "pesquisas", pesquisaId), { fechaEm: fim.toISOString(), fechaEmTs: Timestamp.fromDate(fim), atualizadoEm: serverTimestamp() });
    } catch {
      show("error", "Não foi possível mudar a votação agora.");
    }
  }

  function acaoDoSlide(i: number): AcaoDoSlide | null {
    const sl = calculo?.slides[i];
    if (sl?.tipo === "enquete") {
      if (!podeEnquete) return { rotulo: "Precisa da permissão Pesquisas", executar: () => undefined, desabilitado: true };
      const e = sl.pesquisaId ? enquetes[sl.pesquisaId] : undefined;
      if (!sl.pesquisaId || (e && !e.pesquisa)) return { rotulo: "Abrir votação", executar: () => void abrirEnquete(sl.livreId, sl.pergunta, sl.opcoes) };
      if (!e) return { rotulo: "Carregando…", executar: () => undefined, desabilitado: true };
      if (e.situacao === "aberta") return { rotulo: "Encerrar votação", executar: () => void mudarFimDaEnquete(sl.pesquisaId!, new Date()) };
      return { rotulo: "Reabrir votação", executar: () => void mudarFimDaEnquete(sl.pesquisaId!, new Date(Date.now() + DURACAO_ENQUETE_MS)) };
    }
    if (sl?.tipo !== "sorteio") return null;
    return {
      rotulo: sorteio.estado.ganhadores.length ? "Sortear de novo" : "Sortear",
      executar: sorteio.sortear,
      desabilitado: sorteio.girando || sorteio.elegiveis === 0,
    };
  }

  const resumoAtletas =
    calculo && rascunho
      ? resumoParaAtletas({
          periodo: rascunho.periodo,
          corrida: calculo.corrida,
          bicicleta: calculo.bicicleta,
          destaques: calculo.itensDestaque,
          desafios: calculo.desafiosDoPeriodo,
          novos: calculo.novos.length,
          parcial: hoje <= rascunho.periodo.fim,
        })
      : null;

  if (!pode) return <NotAuthorized />;

  const trimestres = dados.calendario ? ordenarTrimestres(dados.calendario.trimestres) : [];
  const reunioesAgenda = (dados.eventos ?? []).filter((e) => e.tipo === "reuniao").sort((a, b) => b.data.localeCompare(a.data));
  // Fechamento do ano: os anos do calendário e o ano corrente.
  const anos = [...new Set([...trimestres.map((t) => t.inicio.slice(0, 4)), hoje.slice(0, 4)])].sort().reverse();
  const periodosAnuais = anos.map((ano) => ({ ano, ...periodoDoAno(trimestres, ano) }));
  const anoEscolhido = rascunho ? periodosAnuais.find((p) => p.inicio === rascunho.periodo.inicio && p.fim === rascunho.periodo.fim) : undefined;
  const valorPeriodo = rascunho
    ? trimestres.find((t) => t.inicio === rascunho.periodo.inicio && t.fim === rascunho.periodo.fim)?.id ?? (anoEscolhido ? `ano:${anoEscolhido.ano}` : "personalizado")
    : "";
  const total = calculo?.slides.length ?? 0;

  const secaoAtual = rascunho?.secoes.find((x) => x.id === secaoSelecionada) ?? null;
  const nomeSecaoAtual = secaoAtual && rascunho ? nomeDaSecao(secaoAtual, acoes.livres.get(secaoAtual.id), acoes.premios.get(secaoAtual.id)) : "";
  const slideAtual = calculo?.slides[indiceAtual];
  const avisos = verificacoes?.filter((v) => v.nivel === "atencao").length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold text-text sm:truncate sm:text-xl">{rascunho?.titulo ?? "Reunião de resultados"}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-text-light">
            <span>{rascunho ? `${rascunho.periodo.nome} · ${formatShortDate(rascunho.periodo.inicio)} a ${formatShortDate(rascunho.periodo.fim)}` : "Carregando…"}</span>
            {calculo ? <span>· {plural(total, "slide")}</span> : null}
            {/* Salva sozinho: aqui só aparece o estado (e o botão quando precisa). */}
            {erroSalvar ? (
              <button type="button" onClick={() => void salvar(false)} className="inline-flex items-center gap-1 font-semibold text-danger hover:underline">
                <CloudOff className="size-3.5" aria-hidden="true" />
                Não salvou. Tentar de novo
              </button>
            ) : salvando || alterado ? (
              <span className="inline-flex items-center gap-1" role="status">
                · <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Salvando…
              </span>
            ) : pendente ? (
              <button type="button" onClick={() => void salvar(false)} disabled={!rascunho} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                · <Save className="size-3.5" aria-hidden="true" /> Salvar
              </button>
            ) : rascunho?.id ? (
              <span className="inline-flex items-center gap-1" role="status">
                · <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" /> Salvo
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => setApresentando(indiceAtual)} disabled={!calculo || total === 0} title="Apresentar a partir deste slide (Shift+F5)">
            Deste slide
          </Button>
          <Button onClick={() => setApresentando(0)} disabled={!calculo || total === 0} title="Apresentar do início (F5)">
            <MonitorPlay className="size-4" aria-hidden="true" />
            Apresentar
          </Button>
        </div>
      </div>

      {dados.erro ? <InlineAlert tone="danger">Não foi possível carregar todos os dados. Atualize a página.</InlineAlert> : null}

      <FaixaDeOpcoes
        abas={[
          { id: "inicio", rotulo: "Início" },
          { id: "slide", rotulo: "Editar slide" },
          { id: "design", rotulo: "Design" },
          { id: "reuniao", rotulo: "Reunião", aviso: avisos },
          { id: "arquivo", rotulo: "Arquivo" },
        ]}
        aba={aba}
        onAba={setAba}
        recolhida={recolhida}
        onRecolher={mudarRecolhida}
      >
        {!rascunho ? (
          <div className="h-20 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
        ) : aba === "inicio" ? (
          <div className="flex items-stretch gap-x-4 gap-y-3 overflow-x-auto pb-1">
            <GrupoDaFaixa nome="Slides">
              <BotaoDaFaixa icone={<Plus />} rotulo="Novo slide" onClick={() => setGaleria(true)} destaque />
              <BotaoDaFaixa icone={<Copy />} rotulo="Duplicar" onClick={() => secaoAtual && acoes.duplicar(secaoAtual.id)} disabled={!secaoAtual || !acoes.podeDuplicar(secaoAtual.id)} title="Duplicar (Ctrl+D). Vale para slides escritos e prêmios." />
              <BotaoDaFaixa
                icone={secaoAtual?.ativo === false ? <Eye /> : <EyeOff />}
                rotulo={secaoAtual?.ativo === false ? "Mostrar" : "Ocultar"}
                onClick={() => secaoAtual && acoes.mostrar(secaoAtual.id, !secaoAtual.ativo)}
                disabled={!secaoAtual}
                title="Ocultar na apresentação sem apagar"
              />
              <BotaoDaFaixa icone={<Trash2 />} rotulo="Excluir" onClick={() => secaoAtual && excluirSecao(secaoAtual.id)} disabled={!secaoAtual || !acoes.podeRemover(secaoAtual.id)} title="Excluir. Os slides automáticos únicos só se ocultam." />
            </GrupoDaFaixa>
            <SeparadorDaFaixa />
            <GrupoDaFaixa nome="Editar">
              <BotaoDaFaixa icone={<Pencil />} rotulo="Editar este slide" onClick={() => setAba("slide")} disabled={!secaoAtual} />
              <BotaoDaFaixa icone={<Palette />} rotulo="Aparência" onClick={() => setAba("design")} />
            </GrupoDaFaixa>
            <SeparadorDaFaixa />
            <GrupoDaFaixa nome="Apresentar">
              <BotaoDaFaixa icone={<MonitorPlay />} rotulo="Do início" onClick={() => setApresentando(0)} disabled={!calculo || total === 0} title="F5" />
              <BotaoDaFaixa icone={<Play />} rotulo="Deste slide" onClick={() => setApresentando(indiceAtual)} disabled={!calculo || total === 0} title="Shift+F5" />
            </GrupoDaFaixa>
            <p className="ml-auto hidden max-w-56 self-center text-xs text-text-light xl:block">
              Arraste as seções no painel à esquerda para mudar a ordem. Duplo clique numa miniatura abre a edição.
            </p>
          </div>
        ) : aba === "slide" ? (
          secaoAtual ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-bold text-text">
                {nomeSecaoAtual}
                {secaoAtual.ativo ? null : <span className="font-semibold text-text-muted"> · oculto na apresentação</span>}
              </p>
              <EditorDoSlide key={secaoAtual.id} secao={secaoAtual} roteiro={rascunho} imagens={imagens} resultados={calculo?.premios} onChange={(r) => atualizar(r)} />
            </div>
          ) : (
            <p className="text-sm text-text-light">Escolha um slide no painel à esquerda para editar.</p>
          )
        ) : aba === "design" ? (
          <div className="flex max-w-3xl flex-col gap-2">
            <p className="text-xs text-text-light">Fonte, transição e animações da apresentação inteira. A formatação de cada slide escrito fica em Editar slide.</p>
            <TemaApresentacao tema={rascunho.tema} onChange={(t) => atualizar({ tema: t })} />
          </div>
        ) : aba === "reuniao" ? (
          <div className="grid items-start gap-x-6 gap-y-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-text">Reunião</p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={criarNova} disabled={!dados.calendario}>
                    <Plus className="size-4" aria-hidden="true" />
                    Nova
                  </Button>
                  {rascunho.id ? (
                    <Button size="sm" variant="ghost" onClick={duplicar} disabled={!dados.calendario} title="Nova reunião com o mesmo roteiro, slides escritos, textos e aparência">
                      <Copy className="size-4" aria-hidden="true" />
                      Duplicar
                    </Button>
                  ) : null}
                  {rascunho.id ? (
                    <Button size="sm" variant="ghost" onClick={() => setApagando(true)} aria-label="Apagar esta reunião">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {salvas && salvas.length > 0 ? (
                <Select
                  aria-label="Reuniões salvas"
                  value={rascunho.id ?? ""}
                  onChange={(e) => {
                    const r = salvas.find((x) => x.id === e.target.value);
                    if (r) {
                      setRascunho(r);
                      setAlterado(false);
                    }
                  }}
                >
                  {!rascunho.id ? <option value="">Nova (não salva)</option> : null}
                  {salvas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.titulo}
                    </option>
                  ))}
                </Select>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text">Período dos resultados</span>
                <Select
                  aria-label="Período dos resultados"
                  value={valorPeriodo}
                  onChange={(e) => {
                    const t = trimestres.find((x) => x.id === e.target.value);
                    const a = periodosAnuais.find((x) => `ano:${x.ano}` === e.target.value);
                    if (t) atualizar({ periodo: { nome: t.nome, inicio: t.inicio, fim: t.fim }, titulo: `Reunião de resultados · ${t.nome}` });
                    else if (a) atualizar({ periodo: { nome: a.nome, inicio: a.inicio, fim: a.fim }, titulo: `Fechamento de ${a.ano}` });
                    else atualizar({ periodo: { ...rascunho.periodo, nome: rascunho.periodo.nome || "Período" } });
                  }}
                >
                  <optgroup label="Trimestres">
                    {trimestres.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} · {formatShortDate(t.inicio)} a {formatShortDate(t.fim)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ano inteiro">
                    {periodosAnuais.map((p) => (
                      <option key={p.ano} value={`ano:${p.ano}`}>
                        {hoje <= p.fim && hoje >= p.inicio ? `${p.ano} até agora` : `Fechamento de ${p.ano}`} · {formatShortDate(p.inicio)} a {formatShortDate(p.fim)}
                      </option>
                    ))}
                  </optgroup>
                  <option value="personalizado">Outras datas</option>
                </Select>
                {trimestres.length === 0 ? (
                  <p className="flex items-start gap-1.5 text-xs text-text-light">
                    <CalendarRange className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Cadastre os trimestres em{" "}
                      <Link href="/gestao/configuracoes" className="font-semibold text-primary hover:underline">
                        Configurar portal → Ranking e premiação
                      </Link>{" "}
                      para escolher com um toque.
                    </span>
                  </p>
                ) : null}
              </div>
              {valorPeriodo === "personalizado" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <TextField label="Nome do período" value={rascunho.periodo.nome} onChange={(e) => atualizar({ periodo: { ...rascunho.periodo, nome: e.target.value } })} />
                  </div>
                  <TextField label="Início" type="date" value={rascunho.periodo.inicio} onChange={(e) => atualizar({ periodo: { ...rascunho.periodo, inicio: e.target.value } })} />
                  <TextField label="Fim" type="date" value={rascunho.periodo.fim} onChange={(e) => atualizar({ periodo: { ...rascunho.periodo, fim: e.target.value } })} />
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text">Reunião da agenda (QR de presença)</span>
                <Select aria-label="Reunião da agenda" value={rascunho.eventoId ?? ""} onChange={(e) => atualizar({ eventoId: e.target.value || null })}>
                  <option value="">Sem QR de presença</option>
                  {reunioesAgenda.map((e) => (
                    <option key={e.id} value={e.id}>
                      {formatShortDate(e.data)} · {e.titulo}
                    </option>
                  ))}
                </Select>
                {semPermissao && evento ? <p className="text-xs text-warning">O QR ao vivo precisa da permissão Eventos.</p> : null}
              </div>
            </div>
            {verificacoes ? <AntesDeApresentar itens={verificacoes} /> : null}
            {calculo && dados.atletas ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-accent" aria-hidden="true" />
                  <p className="text-sm font-bold text-text">Novos atletas · {calculo.novos.length}</p>
                </div>
                <EditorNovos atletas={dados.atletas} novos={calculo.novos} rascunho={rascunho} onChange={atualizar} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-stretch gap-x-4 gap-y-3 overflow-x-auto pb-1">
            <GrupoDaFaixa nome="Baixar">
              <BotaoDaFaixa
                icone={exportando !== null && formato === "pdf" ? <Loader2 className="animate-spin" /> : <Download />}
                rotulo={exportando !== null && formato === "pdf" ? `PDF ${exportando}/${total}` : "PDF"}
                onClick={() => void baixarPdf()}
                disabled={!calculo || exportando !== null}
              />
              <BotaoDaFaixa
                icone={exportando !== null && formato === "pptx" ? <Loader2 className="animate-spin" /> : <Presentation />}
                rotulo={exportando !== null && formato === "pptx" ? `PowerPoint ${exportando}/${total}` : "PowerPoint"}
                onClick={() => void baixarPptx()}
                disabled={!calculo || exportando !== null}
                title="Slides escritos com texto editável, slides de números como imagem, anotações incluídas"
              />
            </GrupoDaFaixa>
            {podeEnviar ? (
              <>
                <SeparadorDaFaixa />
                <GrupoDaFaixa nome="Compartilhar">
                  <BotaoDaFaixa icone={<Send />} rotulo="Enviar aos atletas" onClick={() => setEnvio((e) => ({ versao: e.versao + 1, aberto: true }))} disabled={!resumoAtletas} title="Publica um resumo dos resultados como notícia" />
                </GrupoDaFaixa>
              </>
            ) : null}
            {calculo ? (
              <p className="ml-auto hidden max-w-60 self-center text-xs text-text-light sm:block">
                {calculo.corrida.ranking.length + calculo.bicicleta.ranking.length} atletas nos resultados
                {minutosPlanejados ? ` · ${String(minutosPlanejados).replace(".", ",")} min planejados` : ""}.
              </p>
            ) : null}
          </div>
        )}
      </FaixaDeOpcoes>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="order-last rounded-[var(--radius-lg)] border border-border bg-bg-card p-2 lg:sticky lg:top-[84px] lg:order-none lg:max-h-[calc(100dvh-100px)] lg:overflow-y-auto">
          {calculo && rascunho ? (
            <PainelDeSlides
              secoes={secoesDoPainel}
              secaoSelecionada={secaoSelecionada}
              indiceSelecionado={indiceAtual}
              miniatura={(i) => <SlideEscalado>{renderSlide(i)}</SlideEscalado>}
              onSelecionarSecao={selecionarSecao}
              onSelecionarSlide={selecionarSlide}
              onAbrir={(i) => {
                selecionarSlide(i);
                setAba("slide");
                mudarRecolhida(false);
              }}
              onMostrar={acoes.mostrar}
              onMover={acoes.mover}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-video animate-pulse rounded-[6px] bg-bg-inset" />
              ))}
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-[84px]">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm text-text-light">
              {slideAtual ? (
                <>
                  <span className="font-semibold text-text">Slide {indiceAtual + 1}</span> de {total} · {slideAtual.rotulo}
                </>
              ) : secaoAtual && !secaoAtual.ativo ? (
                <span className="font-semibold text-text">{nomeSecaoAtual} · oculto</span>
              ) : (
                "Calculando os resultados…"
              )}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => irPorSeta(-1)} disabled={!calculo || indiceAtual <= 0} aria-label="Slide anterior">
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => irPorSeta(1)} disabled={!calculo || indiceAtual >= total - 1} aria-label="Próximo slide">
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          {!calculo ? (
            <div className="aspect-video animate-pulse rounded-[var(--radius-lg)] bg-bg-inset" />
          ) : secaoAtual && !secaoAtual.ativo ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed border-border bg-bg-inset/40 p-6 text-center">
              <EyeOff className="size-8 text-text-muted" aria-hidden="true" />
              <p className="text-sm text-text-light">Esta seção está oculta e não entra na apresentação.</p>
              <Button size="sm" variant="secondary" onClick={() => acoes.mostrar(secaoAtual.id, true)}>
                <Eye className="size-4" aria-hidden="true" />
                Mostrar na apresentação
              </Button>
            </div>
          ) : slideAtual ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border shadow-[var(--shadow-elevated)]">
              <SlideEscalado>{renderSlide(indiceAtual)}</SlideEscalado>
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-border p-6 text-center text-sm text-text-light">
              Esta seção não tem slide agora (por exemplo, ninguém fez aniversário no período).
            </div>
          )}
          {slideAtual ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="notas-slide" className="text-xs font-semibold text-text-light">
                Anotações do apresentador <span className="font-normal text-text-muted">· só aparecem na sua tela, valem para toda a seção</span>
              </label>
              <textarea
                id="notas-slide"
                rows={3}
                value={notaDoSlide(indiceAtual)}
                onChange={(e) => mudarNota(indiceAtual, e.target.value.slice(0, 2000))}
                placeholder="Clique para adicionar anotações"
                className="w-full resize-y rounded-[var(--radius)] border border-border bg-bg-card px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
          ) : null}
        </div>
      </div>

      {rascunho ? (
        <GaleriaDeSlides
          aberta={galeria}
          onFechar={() => setGaleria(false)}
          onLivre={(layout) => {
            setGaleria(false);
            acoes.adicionarLivre(layout, secaoSelecionada);
          }}
          onSecao={(tipo, periodo) => {
            setGaleria(false);
            acoes.adicionarSecao(tipo, periodo, secaoSelecionada);
          }}
          onPremio={() => {
            setGaleria(false);
            acoes.adicionarPremio(secaoSelecionada);
          }}
        />
      ) : null}

      {apresentando !== null && calculo ? (
        <Apresentador
          total={total}
          inicial={apresentando}
          renderSlide={renderNaApresentacao}
          passos={passosNaApresentacao}
          transicao={tema.transicao}
          velocidade={FATOR_VELOCIDADE[tema.velocidade]}
          secao={secaoDoSlide}
          minutosPlanejados={minutosPlanejados}
          onFechar={() => setApresentando(null)}
          rotulo={(i) => calculo?.slides[i]?.rotulo ?? ""}
          nota={notaDoSlide}
          onNota={mudarNota}
          acao={acaoDoSlide}
        />
      ) : null}

      {podeEnviar && resumoAtletas ? (
        <NoticiaModal
          key={envio.versao}
          open={envio.aberto}
          inicial={{ ...resumoAtletas, notificar: true }}
          onClose={() => setEnvio((e) => ({ ...e, aberto: false }))}
        />
      ) : null}

      {/* Slides em tamanho real, fora da tela, só para gerar o PDF. */}
      {exportando !== null && calculo ? (
        <div aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
          {calculo.slides.map((s, i) => (
            <div key={s.chave} ref={(n) => { nosPdf.current[i] = n; }}>
              {renderSlide(i, true)}
            </div>
          ))}
        </div>
      ) : null}

      <ConfirmActionModal
        open={apagando}
        title="Apagar esta reunião?"
        description="O roteiro e as imagens dos slides livres desta reunião serão apagados. Os resultados do portal não mudam."
        confirmLabel="Apagar"
        onClose={() => setApagando(false)}
        onConfirm={async () => {
          if (!rascunho?.id) return;
          await apagarReuniao(rascunho.id);
          const lista = await listarReunioes();
          setSalvas(lista);
          setRascunho(null);
          setApagando(false);
          show("success", "Reunião apagada.");
        }}
      />
    </div>
  );
}
