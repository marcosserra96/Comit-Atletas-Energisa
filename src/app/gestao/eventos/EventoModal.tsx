"use client";

import { FormEvent, useId, useState } from "react";
import { collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { CalendarCheck, Link2, MapPin, UsersRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { dataIsoLocal } from "@/lib/date";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { gerarCodigoFixo, gerarSegredo } from "@/lib/reunioes";
import type { EventoDoc } from "@/lib/types";

/**
 * Cria (sem `evento`) ou edita um evento da agenda. As confirmações dos
 * atletas (`inscritos`) nunca são tocadas aqui.
 */
export function EventoModal({
  open,
  evento,
  onClose,
}: {
  open: boolean;
  evento?: EventoDoc | null;
  onClose: () => void;
}) {
  const { uid } = useActiveSession();
  const { show } = useToast();
  const editando = !!evento;
  const idModalidade = useId();
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [local, setLocal] = useState(evento?.local ?? "");
  const [modalidade, setModalidade] = useState<EventoDoc["modalidade"]>(evento?.modalidade ?? "ambas");
  const [data, setData] = useState(evento?.data ?? "");
  const [km, setKm] = useState(evento?.km != null ? String(evento.km) : "");
  const [tipo, setTipo] = useState<"evento" | "reuniao">(evento?.tipo === "reuniao" ? "reuniao" : "evento");
  const [horaInicio, setHoraInicio] = useState(evento?.horaInicio ?? "");
  const [horaFim, setHoraFim] = useState(evento?.horaFim ?? "");
  const [linkOnline, setLinkOnline] = useState(evento?.linkOnline ?? "");
  const reuniao = tipo === "reuniao";
  const [loading, setLoading] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const confirmados = evento?.inscritos?.length ?? 0;

  // Validação própria (o formulário usa noValidate): a validação nativa de
  // data/hora varia por navegador e acusava "valor inválido" em datas corretas.
  function validar() {
    const erros: Record<string, string> = {};
    if (!titulo.trim()) erros.titulo = "Informe o título.";
    if (!local.trim()) erros.local = "Informe o local.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) erros.data = "Escolha a data.";
    else if (!editando && data < dataIsoLocal()) erros.data = "A data já passou.";
    if (reuniao) {
      if (!/^\d{2}:\d{2}$/.test(horaInicio)) erros.horaInicio = "Informe o início.";
      if (!/^\d{2}:\d{2}$/.test(horaFim)) erros.horaFim = "Informe o fim.";
      else if (!erros.horaInicio && horaFim <= horaInicio) erros.horaFim = "Precisa ser depois do início.";
      const link = linkOnline.trim();
      if (link && !/^https?:\/\/\S+$/i.test(link)) erros.link = "Cole o link completo, começando com https://";
    }
    return erros;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const erros = validar();
    setErros(erros);
    if (Object.keys(erros).length > 0) return;
    const link = linkOnline.trim();
    setLoading(true);
    const dados = {
      titulo: titulo.trim(),
      local: local.trim(),
      modalidade,
      data,
      tipo,
      km: !reuniao && km ? Number(km.replace(",", ".")) : null,
      horaInicio: reuniao ? horaInicio : null,
      horaFim: reuniao ? horaFim : null,
      linkOnline: reuniao && link ? link : null,
    };
    try {
      if (evento) {
        await updateDoc(doc(db, "agenda_eventos", evento.id), {
          ...dados,
          atualizadoEm: serverTimestamp(),
        });
        show("success", reuniao ? "Reunião atualizada." : "Evento atualizado.");
      } else {
        const novoEvento = doc(collection(db, "agenda_eventos"));
        await setDoc(novoEvento, {
          id: novoEvento.id,
          ...dados,
          // Reunião já nasce com a confirmação pelo app ativa (janela padrão, código fixo).
          ...(reuniao ? { checkin: { ativo: true, dinamico: false } } : {}),
          criadoEm: serverTimestamp(),
          criadoPor: uid,
        });
        if (reuniao) {
          await setDoc(doc(db, "reunioes_checkin", novoEvento.id), {
            segredo: gerarSegredo(),
            codigoFixo: gerarCodigoFixo(),
            atualizadoEm: serverTimestamp(),
          });
        }
        show("success", reuniao ? "Reunião publicada na agenda." : "Evento publicado na agenda.");
      }
      onClose();
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? (reuniao ? "Editar reunião" : "Editar evento") : reuniao ? "Nova reunião" : "Novo evento"}
      mobileSheet
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Tipo</span>
          <SegmentedControl
            value={tipo}
            onChange={(valor) => setTipo(valor as "evento" | "reuniao")}
            options={[
              { value: "evento", label: "Evento esportivo", icon: CalendarCheck },
              { value: "reuniao", label: "Reunião", icon: UsersRound },
            ]}
          />
          {reuniao ? (
            <p className="text-xs text-text-muted">
              Reunião vale presença: os pontos vêm do critério do tipo Reunião e não contam como treino.
            </p>
          ) : null}
        </div>
        <TextField
          label="Título"
          placeholder={reuniao ? "Ex: Reunião mensal do programa" : "Ex: Circuito das Estações — Etapa 2"}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          error={erros.titulo}
          required
          autoFocus={!editando}
        />
        <TextField
          label="Local"
          icon={<MapPin className="size-[18px]" />}
          placeholder={reuniao ? "Sala, auditório ou \"Online\"" : "Local do evento"}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          error={erros.local}
          required
        />
        {reuniao ? (
          <TextField
            label="Link da reunião online"
            icon={<Link2 className="size-[18px]" />}
            type="url"
            inputMode="url"
            placeholder="Opcional · https://teams.microsoft.com/…"
            value={linkOnline}
            onChange={(e) => setLinkOnline(e.target.value)}
            error={erros.link}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={idModalidade} className="text-sm font-medium text-text">
              Modalidade
            </label>
            <Select
              id={idModalidade}
              value={modalidade}
              onChange={(e) => setModalidade(e.target.value as EventoDoc["modalidade"])}
            >
              <option value="ambas">Corrida e Bike</option>
              <option value="corrida">Corrida</option>
              <option value="bicicleta">Bike</option>
            </Select>
          </div>
          {reuniao ? (
            <TextField
              label="Data"
              type="date"
              value={data}
              min={editando ? undefined : dataIsoLocal()}
              onChange={(e) => setData(e.target.value)}
              error={erros.data}
              required
            />
          ) : (
            <TextField
              label="Distância (km)"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="Opcional"
              value={km}
              onChange={(e) => setKm(e.target.value)}
            />
          )}
        </div>
        {reuniao ? (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Início"
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              error={erros.horaInicio}
              required
            />
            <TextField
              label="Fim"
              type="time"
              value={horaFim}
              onChange={(e) => setHoraFim(e.target.value)}
              error={erros.horaFim}
              required
            />
          </div>
        ) : (
          <TextField
            label="Data"
            type="date"
            value={data}
            min={editando ? undefined : dataIsoLocal()}
            onChange={(e) => setData(e.target.value)}
            error={erros.data}
            required
          />
        )}
        {editando && confirmados > 0 && (
          <p className="text-xs text-text-muted">
            {confirmados === 1
              ? "A confirmação já feita continua valendo depois da alteração."
              : `As ${confirmados} confirmações já feitas continuam valendo depois da alteração.`}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {editando ? "Salvar alterações" : reuniao ? "Publicar reunião" : "Publicar evento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
