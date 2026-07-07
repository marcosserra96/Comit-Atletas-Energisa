"use client";

import { FormEvent, useState } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { MapPin } from "lucide-react";
import { db } from "@/lib/firebase";
import { useActiveSession } from "@/lib/session/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export function NovoEventoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { uid } = useActiveSession();
  const { show } = useToast();
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [modalidade, setModalidade] = useState<"ambas" | "corrida" | "bicicleta">("ambas");
  const [data, setData] = useState("");
  const [km, setKm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const novoEvento = doc(collection(db, "agenda_eventos"));
      await setDoc(novoEvento, {
        id: novoEvento.id,
        titulo,
        local,
        modalidade,
        data,
        km: km ? Number(km) : null,
        criadoEm: serverTimestamp(),
        criadoPor: uid,
      });
      show("success", "Evento publicado na agenda.");
      setTitulo("");
      setLocal("");
      setModalidade("ambas");
      setData("");
      setKm("");
      onClose();
    } catch {
      show("error", "Não foi possível publicar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo evento">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Título"
          placeholder="Ex: Circuito das Estações — Etapa 2"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          autoFocus
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
            <label className="text-sm font-medium text-text">Modalidade</label>
            <Select
              value={modalidade}
              onChange={(e) => setModalidade(e.target.value as typeof modalidade)}
            >
              <option value="ambas">Ambas</option>
              <option value="corrida">Corrida</option>
              <option value="bicicleta">Bicicleta</option>
            </Select>
          </div>
          <TextField
            label="Distância (km)"
            type="number"
            placeholder="Opcional"
            value={km}
            onChange={(e) => setKm(e.target.value)}
          />
        </div>
        <TextField
          label="Data"
          type="date"
          value={data}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setData(e.target.value)}
          required
        />
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Publicar evento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
