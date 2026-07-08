"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { Activity, CalendarCheck, PlusCircle, Target } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatShortDate } from "@/lib/format";
import { ImportarPontuacoesCard } from "./ImportarPontuacoesCard";
import type { AtletaDoc, EventoDoc, Modalidade, RegraPontuacaoDoc, TipoLancamento } from "@/lib/types";

const tipoOptions: { value: TipoLancamento; label: string; icon: typeof Activity }[] = [
  { value: "treino", label: "Treino", icon: Activity },
  { value: "evento", label: "Evento", icon: CalendarCheck },
  { value: "avulso", label: "Avulso", icon: PlusCircle },
];

export function LancarPontosTab() {
  const { uid, atleta: autor } = useActiveSession();
  const { show } = useToast();

  const [modalidade, setModalidade] = useState<Modalidade>("corrida");
  const [tipo, setTipo] = useState<TipoLancamento>("treino");
  const [dataTreino, setDataTreino] = useState(() => new Date().toISOString().slice(0, 10));
  const [descricaoLote, setDescricaoLote] = useState("");
  const [kmLote, setKmLote] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [atletas, setAtletas] = useState<AtletaDoc[] | null>(null);
  const [regras, setRegras] = useState<RegraPontuacaoDoc[] | null>(null);
  const [eventos, setEventos] = useState<EventoDoc[] | null>(null);
  const [eventosJaLancados, setEventosJaLancados] = useState<Set<string>>(new Set());
  const [marcados, setMarcados] = useState<Record<string, Set<string>>>({});
  const [faltosos, setFaltosos] = useState<Set<string>>(new Set());
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), where("equipe", "==", modalidade)),
      (snap) => {
        setAtletas(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as AtletaDoc)
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        );
      },
      () => setAtletas([]),
    );
    return unsubscribe;
  }, [modalidade]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "regras_pontuacao"), (snap) => {
      setRegras(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RegraPontuacaoDoc));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "agenda_eventos"), orderBy("data", "desc")),
      (snap) => setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EventoDoc)),
      () => setEventos([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, "historico_pontos"), where("eventoId", "!=", ""))).then((snap) => {
      const usados = new Set<string>();
      snap.docs.forEach((d) => {
        const eventoId = (d.data() as { eventoId?: string }).eventoId;
        if (eventoId) usados.add(eventoId);
      });
      setEventosJaLancados(usados);
    });
  }, []);

  const eventosDisponiveis = useMemo(() => {
    if (!eventos) return { proximos: [], recentes: [] };
    const hoje = new Date().toISOString().slice(0, 10);
    const limite = new Date();
    limite.setDate(limite.getDate() - 7);
    const limiteStr = limite.toISOString().slice(0, 10);

    const disponiveis = eventos.filter((e) => e.id === eventoId || !eventosJaLancados.has(e.id));
    const proximos = disponiveis
      .filter((e) => e.data >= hoje)
      .sort((a, b) => a.data.localeCompare(b.data));
    const recentes = disponiveis
      .filter((e) => e.data < hoje && e.data >= limiteStr)
      .sort((a, b) => b.data.localeCompare(a.data));
    return { proximos, recentes };
  }, [eventos, eventosJaLancados, eventoId]);

  const regrasCompativeis = useMemo(() => {
    if (!regras) return [];
    return regras.filter(
      (r) => (r.modalidade === "ambas" || r.modalidade === modalidade) &&
        r.tiposLancamento.includes(tipo),
    );
  }, [regras, modalidade, tipo]);

  function resetSelecao() {
    setMarcados({});
    setFaltosos(new Set());
    setObservacoes({});
  }

  function handleTipoChange(novoTipo: TipoLancamento) {
    setTipo(novoTipo);
    resetSelecao();
    setEventoId("");
    setDescricaoLote("");
    if (novoTipo === "treino") {
      setKmLote("");
      setDataTreino(new Date().toISOString().slice(0, 10));
    }
  }

  function handleEventoChange(id: string) {
    setEventoId(id);
    if (!id) return;
    const evento = eventos?.find((e) => e.id === id);
    if (!evento) return;
    setDescricaoLote(evento.titulo);
    setDataTreino(evento.data);
    if (evento.km) setKmLote(String(evento.km));
    if (evento.modalidade !== "ambas" && evento.modalidade !== modalidade) {
      setModalidade(evento.modalidade);
      resetSelecao();
    }
  }

  const descricaoPlaceholder =
    tipo === "evento"
      ? "A descrição será preenchida com o evento selecionado"
      : tipo === "avulso"
        ? "Ex: Ajuste aprovado pelo comitê / Participação externa"
        : "Ex: Treino de sábado / Treino especial";

  function toggleRegra(atletaId: string, regraId: string) {
    setMarcados((prev) => {
      const atual = new Set(prev[atletaId] ?? []);
      if (atual.has(regraId)) {
        atual.delete(regraId);
      } else {
        const regra = regrasCompativeis.find((r) => r.id === regraId);
        const excludentes = new Set(regra?.regrasExcludentes ?? []);
        for (const marcadaId of [...atual]) {
          const marcada = regrasCompativeis.find((r) => r.id === marcadaId);
          const marcadaExcludeEsta = marcada?.regrasExcludentes?.includes(regraId);
          if (excludentes.has(marcadaId) || marcadaExcludeEsta) {
            atual.delete(marcadaId);
          }
        }
        atual.add(regraId);
      }
      return { ...prev, [atletaId]: atual };
    });
  }

  function toggleFalta(atletaId: string) {
    setFaltosos((prev) => {
      const next = new Set(prev);
      if (next.has(atletaId)) next.delete(atletaId);
      else next.add(atletaId);
      return next;
    });
  }

  function toggleFaltaTodos() {
    if (!atletas) return;
    const todosMarcados = atletas.every((a) => faltosos.has(a.id));
    setFaltosos(todosMarcados ? new Set() : new Set(atletas.map((a) => a.id)));
  }

  function pontosDoAtleta(atletaId: string) {
    const marcadas = marcados[atletaId];
    if (!marcadas || marcadas.size === 0) return 0;
    return regrasCompativeis
      .filter((r) => marcadas.has(r.id))
      .reduce((sum, r) => sum + r.pontos, 0);
  }

  const totalAtletasEnvolvidos = atletas?.filter(
    (a) => faltosos.has(a.id) || pontosDoAtleta(a.id) > 0,
  ).length ?? 0;

  async function handleSalvar() {
    if (!atletas) return;
    if (dataTreino > new Date().toISOString().slice(0, 10)) {
      show("error", "A data não pode ser no futuro.");
      return;
    }
    if (!descricaoLote.trim()) {
      show("info", "Descreva o treino ou atividade antes de salvar.");
      return;
    }
    if (totalAtletasEnvolvidos === 0) {
      show("info", "Marque ao menos um atleta (pontuação ou falta) antes de salvar.");
      return;
    }

    setSalvando(true);
    try {
      const loteId = doc(collection(db, "historico_pontos")).id;
      const batch = writeBatch(db);
      const kmPercorrido = Number(kmLote.replace(",", ".")) || 0;
      const dadosLote = {
        dataTreino,
        loteId,
        descricaoLote: descricaoLote.trim(),
        ...(eventoId ? { eventoId } : {}),
        tipoLancamento: tipo,
        criadoPor: uid,
        criadoPorNome: autor.nome,
        criadoEm: serverTimestamp(),
        estornado: false,
      };

      for (const atletaDoc of atletas) {
        const isFalta = faltosos.has(atletaDoc.id);
        const marcadas = marcados[atletaDoc.id];
        const temPontos = !isFalta && marcadas && marcadas.size > 0;
        if (!isFalta && !temPontos) continue;

        let totalAtleta = 0;

        if (isFalta) {
          batch.set(doc(collection(db, "historico_pontos")), {
            id: doc(collection(db, "historico_pontos")).id,
            atletaId: atletaDoc.id,
            atletaNome: atletaDoc.nome,
            equipe: atletaDoc.equipe,
            regraId: "falta_justificada",
            regraDesc: "Falta justificada",
            pontos: 0,
            kmPercorrido: 0,
            ...dadosLote,
          });
        } else {
          for (const regraId of marcadas!) {
            const regra = regrasCompativeis.find((r) => r.id === regraId);
            if (!regra) continue;
            totalAtleta += regra.pontos;
            const lancamentoRef = doc(collection(db, "historico_pontos"));
            batch.set(lancamentoRef, {
              id: lancamentoRef.id,
              atletaId: atletaDoc.id,
              atletaNome: atletaDoc.nome,
              equipe: atletaDoc.equipe,
              regraId: regra.id,
              regraDesc: regra.descricao,
              pontos: regra.pontos,
              ...(kmPercorrido > 0 ? { kmPercorrido } : {}),
              ...dadosLote,
            });
          }
        }

        if (totalAtleta > 0) {
          batch.update(doc(db, "atletas", atletaDoc.id), {
            pontuacaoTotal: increment(totalAtleta),
            atualizadoEm: serverTimestamp(),
          });
        }
      }

      await batch.commit();

      const dataFormatada = formatShortDate(dataTreino);
      for (const [atletaId, texto] of Object.entries(observacoes)) {
        if (!texto.trim()) continue;
        const envolvido = faltosos.has(atletaId) || (marcados[atletaId]?.size ?? 0) > 0;
        if (!envolvido) continue;
        await addDoc(collection(db, "comentarios_atletas"), {
          atletaId,
          texto: `[Ref: ${dataFormatada} — ${descricaoLote.trim()}] ${texto.trim()}`,
          autorNome: autor.nome,
          autorUid: uid,
          criadoEm: serverTimestamp(),
        });
      }

      show("success", `Lançamento registrado para ${totalAtletasEnvolvidos} atleta(s).`);
      setMarcados({});
      setFaltosos(new Set());
      setObservacoes({});
    } catch {
      show("error", "Não foi possível salvar o lançamento agora. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ImportarPontuacoesCard />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-light">Tipo de lançamento</label>
          <SegmentedControl value={tipo} onChange={handleTipoChange} options={tipoOptions} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tipo === "evento" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-light">Vincular a evento</label>
              <Select value={eventoId} onChange={(e) => handleEventoChange(e.target.value)}>
                <option value="">Selecione um evento</option>
                {eventosDisponiveis.proximos.length > 0 && (
                  <optgroup label="Eventos de hoje e próximos">
                    {eventosDisponiveis.proximos.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.titulo} ({formatShortDate(e.data)})
                      </option>
                    ))}
                  </optgroup>
                )}
                {eventosDisponiveis.recentes.length > 0 && (
                  <optgroup label="Eventos realizados nos últimos 7 dias">
                    {eventosDisponiveis.recentes.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.titulo} ({formatShortDate(e.data)})
                      </option>
                    ))}
                  </optgroup>
                )}
                {eventosDisponiveis.proximos.length === 0 && eventosDisponiveis.recentes.length === 0 && (
                  <option value="" disabled>
                    Nenhum evento disponível para lançamento
                  </option>
                )}
              </Select>
              <p className="text-xs text-text-muted">
                Eventos já lançados são ocultados para evitar duplicidade.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-light">Descrição do treino / atividade</label>
            <input
              value={descricaoLote}
              onChange={(e) => setDescricaoLote(e.target.value)}
              placeholder={descricaoPlaceholder}
              className="h-10 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-light">Equipe alvo</label>
            <Select
              className="w-44"
              value={modalidade}
              onChange={(e) => {
                setModalidade(e.target.value as Modalidade);
                resetSelecao();
              }}
            >
              <option value="corrida">Corrida</option>
              <option value="bicicleta">Bicicleta</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-light">Data</label>
            <input
              type="date"
              value={dataTreino}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDataTreino(e.target.value)}
              className="h-10 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-light">KM percorridos por atleta</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={kmLote}
              onChange={(e) => setKmLote(e.target.value)}
              placeholder="Opcional"
              className="h-10 w-36 rounded-[var(--radius)] border border-border bg-bg-card px-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
      </Card>

      {atletas === null || regras === null ? (
        <Card className="h-64 animate-pulse" />
      ) : regrasCompativeis.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Nenhuma regra compatível"
            description="Cadastre uma regra de pontuação para esta modalidade e tipo de lançamento."
          />
        </Card>
      ) : atletas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Nenhum atleta nesta modalidade"
            description="Cadastre atletas em Gestão de atletas para lançar pontos aqui."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                <th className="sticky left-0 z-[1] bg-bg-card px-4 py-3 font-semibold">Atleta</th>
                {regrasCompativeis.map((r) => (
                  <th key={r.id} className="px-3 py-3 text-center font-semibold">
                    {r.descricao}
                    <span className="block font-normal normal-case text-text-muted">
                      {r.pontos} pts
                    </span>
                  </th>
                ))}
                <th className="border-l border-border px-3 py-3 text-center font-semibold text-accent">
                  Falta justificada
                  <label className="mt-1 flex items-center justify-center gap-1.5 font-normal normal-case text-text-muted">
                    <input
                      type="checkbox"
                      checked={atletas.length > 0 && atletas.every((a) => faltosos.has(a.id))}
                      onChange={toggleFaltaTodos}
                      className="size-3.5 rounded border-border accent-accent"
                    />
                    Todo time
                  </label>
                </th>
                <th className="w-[180px] border-l border-border px-3 py-3 text-left font-semibold">
                  Observação
                </th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {atletas.map((a) => {
                const isFalta = faltosos.has(a.id);
                const temMarcacao = isFalta || (marcados[a.id]?.size ?? 0) > 0;
                return (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-[1] bg-bg-card px-4 py-3 font-medium text-text">
                      {a.nome}
                    </td>
                    {regrasCompativeis.map((r) => (
                      <td key={r.id} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          disabled={isFalta}
                          checked={marcados[a.id]?.has(r.id) ?? false}
                          onChange={() => toggleRegra(a.id, r.id)}
                          className="size-4 rounded border-border accent-primary disabled:opacity-30"
                        />
                      </td>
                    ))}
                    <td className="border-l border-border px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isFalta}
                        onChange={() => toggleFalta(a.id)}
                        className="size-4 rounded border-border accent-accent"
                      />
                    </td>
                    <td className="w-[180px] border-l border-border px-3 py-3">
                      {temMarcacao ? (
                        <input
                          value={observacoes[a.id] ?? ""}
                          onChange={(e) =>
                            setObservacoes((prev) => ({ ...prev, [a.id]: e.target.value }))
                          }
                          placeholder="Lesão, atestado…"
                          className="h-8 w-full rounded-[var(--radius-sm)] border border-border bg-bg px-2 text-xs text-text outline-none placeholder:text-text-muted focus:border-primary"
                        />
                      ) : (
                        <div className="h-8" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-text">
                      {isFalta ? "—" : pontosDoAtleta(a.id)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-light">
          {totalAtletasEnvolvidos} atleta(s) receberão este lançamento (pontos ou falta justificada).
        </p>
        <Button onClick={handleSalvar} loading={salvando} disabled={!atletas || !regras}>
          Salvar lançamento
        </Button>
      </div>
    </div>
  );
}
