"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { AlertTriangle, CalendarRange, CheckCircle2, CloudOff, Download, Info, Loader2, MonitorPlay, Plus, Save, Search, Send, Star, Trash2, UserPlus, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { NotAuthorized } from "@/components/ui/NotAuthorized";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { SlideReuniao } from "@/components/reuniao/SlidesReuniao";
import { Apresentador, SlideEscalado, gerarPdfDosSlides, type AcaoDoSlide } from "@/components/reuniao/Apresentador";
import { EditorRoteiro } from "@/components/reuniao/EditorRoteiro";
import { useSorteio } from "@/components/reuniao/useSorteio";
import { NoticiaModal } from "@/app/gestao/noticias/NoticiaModal";
import { AvatarAtleta } from "@/components/atletas/AvatarAtleta";
import { temPermissao } from "@/lib/permissoes";
import { carregarTodosLancamentos } from "@/lib/lancamentosCache";
import { useRegrasDeTreino } from "@/lib/useRegrasDeTreino";
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
import {
  agendaDoAno,
  aniversariantesDoPeriodo,
  completarSecoes,
  destaquesDoPeriodo,
  membroAtivoDaEquipe,
  montarRoteiro,
  periodoAnterior,
  trechoEquivalente,
  novosAtletas,
  periodosDeApuracao,
  regrasParaSlide,
  resultadosDaEquipe,
  reuniaoPadrao,
  verificarAntesDeApresentar,
  resumoParaAtletas,
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
  const { usuario } = useActiveSession();
  const { show } = useToast();
  const pode = temPermissao(usuario, "informativo");
  const dados = useDadosReuniao();
  const hoje = hojeBrasil();

  const [salvas, setSalvas] = useState<ReuniaoResultadosDoc[] | null>(null);
  const [desafios, setDesafios] = useState<DesafioDoc[]>([]);
  const [rascunhoEditado, setRascunho] = useState<Rascunho | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  // Cada edição sobe a versão: um salvamento só limpa o "alterado" se nada mudou enquanto salvava.
  const versao = useRef(0);
  const [salvando, setSalvando] = useState(false);
  const [apresentando, setApresentando] = useState<number | null>(null);
  const [exportando, setExportando] = useState<number | null>(null);
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

  const evento = useMemo(() => dados.eventos?.find((e) => e.id === rascunho?.eventoId) ?? null, [dados.eventos, rascunho?.eventoId]);

  const calculo = useMemo(() => {
    if (!dados.pronto || !rascunho) return null;
    const { periodo } = rascunho;
    const atletas = dados.atletas!;
    const novos = novosAtletas({ atletas, inicio: periodo.inicio, ate: hoje, incluir: rascunho.novosIncluir, excluir: rascunho.novosExcluir });
    const idsNovos = new Set(novos.map((a) => a.id));
    const comum = { atletas, lancamentos: dados.lancamentos!, resumosMensais: dados.mensais!, inicio: periodo.inicio, fim: periodo.fim, regrasTreino: dados.regrasTreino!, novos: idsNovos };
    const corrida = resultadosDaEquipe({ modalidade: "corrida", ...comum });
    const bicicleta = resultadosDaEquipe({ modalidade: "bicicleta", ...comum });
    // Período anterior (trimestre de antes ou a mesma duração), para a variação e "quem mais evoluiu".
    const antInteiro = periodoAnterior(periodo, dados.calendario!.trimestres);
    // Período ainda correndo: compara com o mesmo trecho do anterior (senão a queda é falsa).
    const ant = hoje < periodo.fim ? trechoEquivalente(antInteiro, periodo.inicio, hoje) : antInteiro;
    const comumAnt = { ...comum, inicio: ant.inicio, fim: ant.fim, novos: undefined };
    const anterior = { nome: ant.nome, corrida: resultadosDaEquipe({ modalidade: "corrida", ...comumAnt }), bicicleta: resultadosDaEquipe({ modalidade: "bicicleta", ...comumAnt }) };
    const temAnterior = anterior.corrida.totais.treinos + anterior.bicicleta.totais.treinos > 0;
    // Semanas seguidas treinando até o fim do período.
    const ate = periodo.fim < hoje ? periodo.fim : hoje;
    const porAtleta = agruparPorAtleta(dados.lancamentos!.filter((l) => !l.estornado && l.dataTreino <= ate));
    const sequencias = new Map<string, number>();
    for (const a of atletas) {
      if (!membroAtivoDaEquipe(a, "corrida") && !membroAtivoDaEquipe(a, "bicicleta")) continue;
      sequencias.set(a.id, calcularSequencia(porAtleta.get(a.id) ?? [], dados.regrasTreino!, ate).atual);
    }
    const itensDestaque = destaquesDoPeriodo({ atletas, atual: { corrida, bicicleta }, anterior: temAnterior ? anterior : null, sequencias });
    const desafiosDoPeriodo = desafios
      .filter((d) => d.inicio <= periodo.fim && d.fim >= periodo.inicio && d.inicio <= hoje)
      .map((d) => {
        const p = participacaoNoDesafio({ desafio: d, atletas, porAtleta, regrasTreino: dados.regrasTreino!, hoje: ate });
        return { titulo: d.titulo, concluidos: p.concluidos, participantes: p.participantes.length };
      })
      .filter((d) => d.participantes > 0);
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
      evento: evento ? { id: evento.id, titulo: evento.titulo, horario: `${formatShortDate(evento.data)} · ${horarioDoEvento(evento)}` } : null,
      pontosReuniao,
      hoje,
      anterior: temAnterior ? { nome: ant.nome, corrida: anterior.corrida.totais, bicicleta: anterior.bicicleta.totais } : null,
      destaques: { itens: itensDestaque, desafios: desafiosDoPeriodo },
      aniversariantes,
    });
    const comFoto = [
      ...novos,
      ...[corrida, bicicleta].flatMap((e) => e.podio.flatMap((d) => d.atletas)),
      ...itensDestaque.map((d) => d.atleta),
      ...aniversariantes,
    ];
    return { slides, novos, corrida, bicicleta, comFoto, itensDestaque, desafiosDoPeriodo };
  }, [dados, rascunho, evento, hoje, desafios]);

  const presentes = usePresentesNaReuniao(evento?.id ?? null);
  const presentesSorteio = useMemo(() => presentes?.map((p) => ({ id: p.atletaId, nome: p.nome, equipe: p.equipe })) ?? null, [presentes]);
  const sorteio = useSorteio(presentesSorteio, evento?.id ?? null);
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

  const renderSlide = useCallback(
    (i: number, paraPdf = false) =>
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
        />
      ) : null,
    [calculo, fotos, imagens, qrPresenca, semPermissao, qrApp, urlApp, presentes, sorteio.estado],
  );

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

  /** Do roteiro para a prévia: rola até o primeiro slide da seção e destaca os dela. */
  function irPara(secaoId: string) {
    const primeiro = calculo?.slides.find((sl) => sl.secaoId === secaoId);
    if (!primeiro) return;
    document.getElementById(`slide-${primeiro.chave}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setDestaque(secaoId);
    window.setTimeout(() => setDestaque((d) => (d === secaoId ? null : d)), 1800);
  }

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
            : [],
    );
    const vistos = new Set<string>();
    const semFoto = naTela.filter((a) => !a.fotoVersao && !vistos.has(a.id) && vistos.add(a.id)).map((a) => ({ id: a.id, nome: a.nome }));
    return verificarAntesDeApresentar({ reuniao: rascunho, eventos: dados.eventos, lancamentos: dados.lancamentos, semFoto, hoje });
  }, [calculo, rascunho, dados.eventos, dados.lancamentos, hoje]);

  async function baixarPdf() {
    if (!calculo || !rascunho) return;
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
  function acaoDoSlide(i: number): AcaoDoSlide | null {
    if (calculo?.slides[i]?.tipo !== "sorteio") return null;
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
  const valorPeriodo = rascunho ? trimestres.find((t) => t.inicio === rascunho.periodo.inicio && t.fim === rascunho.periodo.fim)?.id ?? "personalizado" : "";
  const total = calculo?.slides.length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 lg:flex-1">
          <h1 className="text-2xl font-extrabold text-text">Reunião de resultados</h1>
          <p className="text-sm text-text-light">
            A apresentação monta sozinha com os números do período. Ajuste o roteiro, apresente no telão ou baixe em PDF.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Salva sozinho: aqui só aparece o estado (e o botão quando precisa). */}
          {erroSalvar ? (
            <Button variant="secondary" onClick={() => void salvar(false)} loading={salvando}>
              <CloudOff className="size-4 text-danger" aria-hidden="true" />
              Não salvou. Tentar de novo
            </Button>
          ) : salvando || alterado ? (
            <span className="flex min-h-11 items-center gap-1.5 px-2 text-sm text-text-light" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Salvando…
            </span>
          ) : pendente ? (
            <Button variant="secondary" onClick={() => void salvar(false)} disabled={!rascunho}>
              <Save className="size-4" aria-hidden="true" />
              Salvar
            </Button>
          ) : rascunho?.id ? (
            <span className="flex min-h-11 items-center gap-1.5 px-2 text-sm text-text-light" role="status">
              <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              Salvo
            </span>
          ) : null}
          <Button variant="secondary" onClick={() => void baixarPdf()} disabled={!calculo || exportando !== null}>
            {exportando !== null ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
            {exportando !== null ? `PDF ${exportando}/${total}` : "Baixar PDF"}
          </Button>
          {podeEnviar ? (
            <Button variant="secondary" onClick={() => setEnvio((e) => ({ versao: e.versao + 1, aberto: true }))} disabled={!resumoAtletas}>
              <Send className="size-4" aria-hidden="true" />
              Enviar aos atletas
            </Button>
          ) : null}
          <Button onClick={() => setApresentando(0)} disabled={!calculo || total === 0}>
            <MonitorPlay className="size-4" aria-hidden="true" />
            Apresentar
          </Button>
        </div>
      </div>

      {dados.erro ? <InlineAlert tone="danger">Não foi possível carregar todos os dados. Atualize a página.</InlineAlert> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-[84px] lg:max-h-[calc(100dvh-100px)] lg:overflow-y-auto lg:pb-4">
          {verificacoes ? <AntesDeApresentar itens={verificacoes} /> : null}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-text">Reunião</p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={criarNova} disabled={!dados.calendario}>
                  <Plus className="size-4" aria-hidden="true" />
                  Nova
                </Button>
                {rascunho?.id ? (
                  <Button size="sm" variant="ghost" onClick={() => setApagando(true)} aria-label="Apagar esta reunião">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>
            {salvas && salvas.length > 0 ? (
              <Select
                aria-label="Reuniões salvas"
                value={rascunho?.id ?? ""}
                onChange={(e) => {
                  const r = salvas.find((x) => x.id === e.target.value);
                  if (r) {
                    setRascunho(r);
                    setAlterado(false);
                  }
                }}
              >
                {rascunho && !rascunho.id ? <option value="">Nova (não salva)</option> : null}
                {salvas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.titulo}
                  </option>
                ))}
              </Select>
            ) : null}

            {rascunho ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-text">Período dos resultados</span>
                  <Select
                    aria-label="Período dos resultados"
                    value={valorPeriodo}
                    onChange={(e) => {
                      const t = trimestres.find((x) => x.id === e.target.value);
                      if (t) atualizar({ periodo: { nome: t.nome, inicio: t.inicio, fim: t.fim }, titulo: `Reunião de resultados · ${t.nome}` });
                      else atualizar({ periodo: { ...rascunho.periodo, nome: rascunho.periodo.nome || "Período" } });
                    }}
                  >
                    {trimestres.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} · {formatShortDate(t.inicio)} a {formatShortDate(t.fim)}
                      </option>
                    ))}
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
              </>
            ) : (
              <div className="h-40 animate-pulse rounded-[var(--radius)] bg-bg-inset" />
            )}
          </Card>

          {rascunho ? (
            <Card className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-bold text-text">Roteiro</p>
                <p className="text-xs text-text-light">Ligue, desligue e mude a ordem. Os slides livres você escreve.</p>
              </div>
              <EditorRoteiro roteiro={rascunho} imagens={imagens} onChange={(r) => atualizar(r)} onIrPara={irPara} />
            </Card>
          ) : null}

          {rascunho && calculo && dados.atletas ? (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Star className="size-4 text-accent" aria-hidden="true" />
                <p className="text-sm font-bold text-text">Novos atletas · {calculo.novos.length}</p>
              </div>
              <EditorNovos atletas={dados.atletas} novos={calculo.novos} rascunho={rascunho} onChange={atualizar} />
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text-light">
              {calculo ? `${plural(total, "slide")} · toque para apresentar a partir dele` : "Calculando os resultados…"}
            </p>
            {calculo ? (
              <p className="hidden items-center gap-1.5 text-xs text-text-muted sm:flex">
                <Search className="size-3.5" aria-hidden="true" />
                {calculo.corrida.ranking.length + calculo.bicicleta.ranking.length} atletas nos resultados
              </p>
            ) : null}
          </div>
          {!calculo ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-video animate-pulse rounded-[var(--radius-lg)] bg-bg-inset" />
              ))}
            </div>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {calculo.slides.map((s, i) => (
                <li key={s.chave} id={`slide-${s.chave}`} className="scroll-mt-24">
                  <button
                    type="button"
                    onClick={() => setApresentando(i)}
                    className={cn(
                      "group block w-full overflow-hidden rounded-[var(--radius-lg)] border bg-bg-card text-left shadow-sm transition-[box-shadow,border-color] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      destaque && s.secaoId === destaque ? "border-primary ring-2 ring-primary" : "border-border",
                    )}
                    aria-label={`Apresentar a partir do slide ${i + 1}: ${s.rotulo ?? ""}`}
                  >
                    <SlideEscalado>{renderSlide(i)}</SlideEscalado>
                    <span className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                      <span className="min-w-0 truncate font-semibold text-text">
                        <span className="tabular-nums text-text-muted">{i + 1}</span> {s.rotulo}
                      </span>
                      <span className="shrink-0 font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Apresentar daqui</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {apresentando !== null && calculo ? (
        <Apresentador
          total={total}
          inicial={apresentando}
          renderSlide={renderSlide}
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
