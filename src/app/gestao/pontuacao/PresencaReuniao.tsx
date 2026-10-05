"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { Check, Search, UsersRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { dataIsoLocal } from "@/lib/date";
import { atletaPublicoRef } from "@/lib/publicAthletes";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SportBadge } from "@/components/ui/SportBadge";
import { cn } from "@/lib/cn";
import { formatPontos, formatShortDate, plural } from "@/lib/format";
import { perfilAtletaVisivel } from "@/lib/athleteVisibility";
import { atualizarRankingAutomaticamente } from "@/lib/rankingAutoUpdate";
import { ehReuniao, horarioDoEvento } from "@/lib/eventos";
import { idPresencaReuniao, loteDaReuniao } from "@/lib/reunioes";
import type { AtletaDoc, EventoDoc, HistoricoPontoDoc, Modalidade, RegraPontuacaoDoc } from "@/lib/types";

type FiltroEquipe = "todas" | Modalidade;

const campo =
  "h-10 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15";

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Presença em reunião: um check por atleta. Cada presença vale os pontos do
 * critério do tipo Reunião e não conta como treino. Com reunião da agenda, o id
 * do lançamento é fixo por atleta (também usado pela confirmação por QR code),
 * então ninguém recebe a mesma presença duas vezes.
 */
export function PresencaReuniao() {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [regras, setRegras] = useState<RegraPontuacaoDoc[] | null>(null);
  const [reunioes, setReunioes] = useState<EventoDoc[] | null>(null);
  const [reuniaoId, setReuniaoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [equipe, setEquipe] = useState<FiltroEquipe>("todas");
  const [regraEscolhida, setRegraEscolhida] = useState("");
  const [busca, setBusca] = useState("");
  const [presentes, setPresentes] = useState<Set<string>>(new Set());
  const [jaRegistrados, setJaRegistrados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "atletas"), where("equipe", "in", ["corrida", "bicicleta"])),
        (snap) =>
          setAtletas(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
              .filter((a) => a.ativo && perfilAtletaVisivel(a))
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
          ),
        () => setAtletas([]),
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        collection(db, "regras_pontuacao"),
        (snap) => setRegras(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc)),
        () => setRegras([]),
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "agenda_eventos"), orderBy("data", "desc")),
        (snap) =>
          setReunioes(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc).filter((e) => ehReuniao(e)),
          ),
        () => setReunioes([]),
      ),
    [],
  );

  // Presenças já registradas para a reunião escolhida (manual ou QR code), ao vivo.
  useEffect(() => {
    if (!reuniaoId) return;
    return onSnapshot(
      query(collection(db, "historico_pontos"), where("eventoId", "==", reuniaoId)),
      (snap) =>
        setJaRegistrados(
          new Set(
            snap.docs
              .map((d) => d.data() as HistoricoPontoDoc)
              .filter((l) => !l.estornado && l.tipoLancamento === "reuniao")
              .map((l) => l.atletaId),
          ),
        ),
      () => setJaRegistrados(new Set()),
    );
  }, [reuniaoId]);
  const registrados = reuniaoId ? jaRegistrados : new Set<string>();

  const regrasReuniao = useMemo(
    () => (regras ?? []).filter((r) => r.tiposLancamento.includes("reuniao")),
    [regras],
  );
  const regra = regrasReuniao.find((r) => r.id === regraEscolhida) ?? regrasReuniao[0];

  const reunioesRecentes = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    const hoje = dataIsoLocal();
    const desde = dataIsoLocal(limite);
    return (reunioes ?? []).filter((r) => r.data <= hoje && r.data >= desde);
  }, [reunioes]);

  const atletasElegiveis = useMemo(() => {
    if (!atletas) return [];
    return atletas.filter(
      (a) =>
        (equipe === "todas" || a.equipe === equipe) &&
        (!regra || regra.modalidade === "ambas" || regra.modalidade === a.equipe),
    );
  }, [atletas, equipe, regra]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return termo ? atletasElegiveis.filter((a) => normalizar(a.nome).includes(termo)) : atletasElegiveis;
  }, [atletasElegiveis, busca]);

  const novos = atletasElegiveis.filter((a) => presentes.has(a.id) && !registrados.has(a.id));
  const todosVisiveisMarcados =
    visiveis.length > 0 && visiveis.every((a) => presentes.has(a.id) || registrados.has(a.id));

  function escolherReuniao(id: string) {
    setReuniaoId(id);
    setPresentes(new Set());
    setJaRegistrados(new Set());
    const reuniao = reunioes?.find((r) => r.id === id);
    if (!reuniao) return;
    setDescricao(reuniao.titulo);
    setData(reuniao.data);
    setEquipe(reuniao.modalidade === "ambas" ? "todas" : reuniao.modalidade);
  }

  function alternar(id: string) {
    setPresentes((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  function alternarTodos() {
    setPresentes((atual) => {
      const proximo = new Set(atual);
      for (const a of visiveis) {
        if (registrados.has(a.id)) continue;
        if (todosVisiveisMarcados) proximo.delete(a.id);
        else proximo.add(a.id);
      }
      return proximo;
    });
  }

  async function salvar() {
    if (!regra) return;
    if (!data) return show("info", "Escolha a data da reunião.");
    if (data > dataIsoLocal()) return show("error", "A data não pode ser no futuro.");
    if (!descricao.trim()) return show("info", "Descreva a reunião antes de salvar.");
    if (novos.length === 0) return show("info", "Marque ao menos um atleta presente.");

    setSalvando(true);
    try {
      const loteId = reuniaoId ? loteDaReuniao(reuniaoId) : doc(collection(db, "historico_pontos")).id;
      // Cada presença usa até 3 escritas; o lote do Firestore aceita 500.
      for (let i = 0; i < novos.length; i += 150) {
        const batch = writeBatch(db);
        for (const a of novos.slice(i, i + 150)) {
          const ref = reuniaoId
            ? doc(db, "historico_pontos", idPresencaReuniao(reuniaoId, a.id))
            : doc(collection(db, "historico_pontos"));
          batch.set(ref, {
            id: ref.id,
            atletaId: a.id,
            atletaNome: a.nome,
            equipe: a.equipe,
            regraId: regra.id,
            regraDesc: regra.descricao,
            pontos: regra.pontos,
            tipoLancamento: "reuniao",
            dataTreino: data,
            loteId,
            descricaoLote: descricao.trim(),
            ...(reuniaoId ? { eventoId: reuniaoId } : {}),
            origemPresenca: "manual",
            criadoPor: uid,
            criadoPorNome: autor.nome,
            criadoEm: serverTimestamp(),
            estornado: false,
          });
          if (regra.pontos > 0) {
            batch.update(doc(db, "atletas", a.id), {
              pontuacaoTotal: increment(regra.pontos),
              atualizadoEm: serverTimestamp(),
            });
            batch.set(atletaPublicoRef(a.id), { pontuacaoTotal: increment(regra.pontos) }, { merge: true });
          }
        }
        await batch.commit();
      }
      const ok = await atualizarRankingAutomaticamente(
        novos.map((a) => a.id),
        "presenca_reuniao",
      );
      show(
        ok ? "success" : "info",
        ok
          ? `${plural(novos.length, "presença registrada", "presenças registradas")}. Ranking atualizado.`
          : `${plural(novos.length, "presença registrada", "presenças registradas")}, mas o ranking não atualizou. Use "Recalcular agora".`,
      );
      setPresentes(new Set());
      if (!reuniaoId) {
        setDescricao("");
        setData("");
      }
    } catch {
      show("error", "Não foi possível registrar as presenças agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  if (atletas === null || regras === null || reunioes === null) return <Card className="h-64 animate-pulse" />;

  if (!regra) {
    return (
      <Card>
        <EmptyState
          icon={UsersRound}
          title="Nenhum critério de reunião"
          description="Cadastre em Critérios uma regra com o tipo Reunião e os pontos da presença."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Reunião da agenda</span>
            <Select value={reuniaoId} onChange={(e) => escolherReuniao(e.target.value)}>
              <option value="">Sem reunião na agenda (lançamento livre)</option>
              {reunioesRecentes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.titulo} · {formatShortDate(r.data)}
                  {horarioDoEvento(r) ? ` · ${horarioDoEvento(r)}` : ""}
                </option>
              ))}
            </Select>
            <span className="text-xs text-text-muted">Reuniões de hoje e dos últimos 30 dias.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Descrição</span>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Reunião mensal do programa"
              className={campo}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Data</span>
            <input
              type="date"
              value={data}
              max={dataIsoLocal()}
              onChange={(e) => setData(e.target.value)}
              disabled={Boolean(reuniaoId)}
              className={cn(campo, "disabled:opacity-70")}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-light">Equipe</span>
            <Select className="w-44" value={equipe} onChange={(e) => setEquipe(e.target.value as FiltroEquipe)}>
              <option value="todas">Corrida e Bike</option>
              <option value="corrida">Corrida</option>
              <option value="bicicleta">Bike</option>
            </Select>
          </label>
          {regrasReuniao.length > 1 ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-text-light">Critério</span>
              <Select className="w-60" value={regra.id} onChange={(e) => setRegraEscolhida(e.target.value)}>
                {regrasReuniao.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.descricao} · {formatPontos(r.pontos)} pts
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-text-light">Critério</span>
              <span className="flex h-10 items-center text-sm text-text">
                {regra.descricao} · <strong className="ml-1">{formatPontos(regra.pontos)} pts</strong>
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar atleta"
              aria-label="Buscar atleta"
              className={cn(campo, "h-11 w-full pl-9 text-base sm:text-sm")}
            />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-text">
            <input
              type="checkbox"
              checked={todosVisiveisMarcados}
              onChange={alternarTodos}
              className="size-5 rounded border-border accent-primary"
            />
            Marcar todos {busca.trim() ? "da busca" : ""}
          </label>
        </div>
        {visiveis.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">Nenhum atleta encontrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visiveis.map((a) => {
              const registrado = registrados.has(a.id);
              const marcado = registrado || presentes.has(a.id);
              return (
                <li key={a.id}>
                  <label
                    className={cn(
                      "flex min-h-12 items-center gap-3 px-4 py-2 transition-colors",
                      registrado ? "cursor-default bg-success/5" : "cursor-pointer hover:bg-bg-subtle",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={registrado}
                      onChange={() => alternar(a.id)}
                      className="size-5 shrink-0 rounded border-border accent-primary disabled:opacity-60"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-text">{a.nome}</span>
                    {registrado ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
                        <Check className="size-3.5" aria-hidden="true" />
                        Presença registrada
                      </span>
                    ) : null}
                    {equipe === "todas" && (a.equipe === "corrida" || a.equipe === "bicicleta") ? (
                      <SportBadge modalidade={a.equipe} size="sm" />
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-bg-card/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(7,25,45,0.25)] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
        <p className="text-sm text-text-light">
          {novos.length === 0
            ? registrados.size > 0
              ? `${plural(registrados.size, "presença já registrada", "presenças já registradas")} nesta reunião.`
              : "Marque quem esteve presente."
            : `${plural(novos.length, "presença", "presenças")} · ${formatPontos(regra.pontos)} pts cada`}
        </p>
        <Button onClick={salvar} loading={salvando} disabled={novos.length === 0} className="w-full sm:w-auto">
          Registrar presenças
        </Button>
      </div>
    </div>
  );
}
