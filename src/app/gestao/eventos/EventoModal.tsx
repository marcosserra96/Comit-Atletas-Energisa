"use client";

import { FormEvent, useId, useState } from "react";
import { collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { MapPin } from "lucide-react";
import { db } from "@/lib/firebase";
import { dataIsoLocal } from "@/lib/date";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
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
  const [loading, setLoading] = useState(false);
  const confirmados = evento?.inscritos?.length ?? 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const dados = {
      titulo: titulo.trim(),
      local: local.trim(),
      modalidade,
      data,
      km: km ? Number(km.replace(",", ".")) : null,
    };
    try {
      if (evento) {
        await updateDoc(doc(db, "agenda_eventos", evento.id), {
          ...dados,
          atualizadoEm: serverTimestamp(),
        });
        show("success", "Evento atualizado.");
      } else {
        const novoEvento = doc(collection(db, "agenda_eventos"));
        await setDoc(novoEvento, {
          id: novoEvento.id,
          ...dados,
          criadoEm: serverTimestamp(),
          criadoPor: uid,
        });
        show("success", "Evento publicado na agenda.");
      }
      onClose();
    } catch {
      show("error", "Não foi possível salvar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? "Editar evento" : "Novo evento"} mobileSheet>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Título"
          placeholder="Ex: Circuito das Estações — Etapa 2"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          autoFocus={!editando}
        />
        <TextField
          label="Local"
          icon={<MapPin className="size-[18px]" />}
          placeholder="Local do evento"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          required
        />
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
        </div>
        <TextField
          label="Data"
          type="date"
          value={data}
          min={editando ? undefined : dataIsoLocal()}
          onChange={(e) => setData(e.target.value)}
          required
        />
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
            {editando ? "Salvar alterações" : "Publicar evento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
