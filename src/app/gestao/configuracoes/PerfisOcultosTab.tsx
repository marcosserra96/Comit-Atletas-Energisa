"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { EyeOff, RotateCcw, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import { atualizarVisibilidadePerfil } from "@/lib/athleteVisibilityClient";
import { equipeLabel, roleLabel } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AtletaDoc } from "@/lib/types";

export function PerfisOcultosTab() {
  const { show } = useToast();
  const [perfis, setPerfis] = useState<AtletaDoc[] | null>(null);
  const [busca, setBusca] = useState("");
  const [reativandoIds, setReativandoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "atletas"), where("visivelNasListas", "==", false)),
      (snapshot) => {
        setPerfis(
          snapshot.docs
            .map((documento) => ({ id: documento.id, ...documento.data() }) as AtletaDoc)
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        );
      },
      () => setPerfis([]),
    );
    return unsubscribe;
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return perfis ?? [];
    return (perfis ?? []).filter(
      (perfil) =>
        perfil.nome.toLocaleLowerCase("pt-BR").includes(termo) ||
        (perfil.email ?? "").toLocaleLowerCase("pt-BR").includes(termo),
    );
  }, [busca, perfis]);

  async function handleReativar(perfil: AtletaDoc) {
    setReativandoIds((atuais) => new Set(atuais).add(perfil.id));
    try {
      const resultado = await atualizarVisibilidadePerfil(perfil.id, true);
      show(
        resultado.rankingAtualizado ? "success" : "info",
        resultado.rankingAtualizado
          ? `${perfil.nome} voltou a aparecer nas visões do portal.`
          : `${perfil.nome} foi reativado, mas o ranking não atualizou. Use “Recalcular agora”.`,
      );
    } catch (error) {
      show(
        "error",
        error instanceof Error ? error.message : "Não foi possível reativar este perfil.",
      );
    } finally {
      setReativandoIds((atuais) => {
        const proximos = new Set(atuais);
        proximos.delete(perfil.id);
        return proximos;
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-warning/25 bg-warning/[0.04]">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning/10 text-ranking-gold-text">
            <EyeOff className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-bold text-text">Perfis fora das visões do portal</h3>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-light">
              Estes perfis não aparecem em listas, seletores, indicadores, relatórios nem no
              ranking. Login, cadastro e histórico permanecem preservados para testes ou uso futuro.
            </p>
          </div>
        </div>
      </Card>

      {perfis !== null && perfis.length > 0 && (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-md">
            <label htmlFor="buscar-perfil-oculto" className="mb-1.5 block text-xs font-semibold text-text">
              Buscar perfil oculto
            </label>
            <div className="flex h-11 items-center gap-2 rounded-[var(--radius)] border border-border bg-bg-card px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <Search className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
              <input
                id="buscar-perfil-oculto"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Nome ou e-mail"
                className="h-full min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-muted sm:text-sm"
              />
            </div>
          </div>
          <Badge tone="neutral">
            {perfis.length} {perfis.length === 1 ? "perfil oculto" : "perfis ocultos"}
          </Badge>
        </Card>
      )}

      {perfis === null ? (
        <Card className="h-44 animate-pulse" />
      ) : perfis.length === 0 ? (
        <Card>
          <EmptyState
            icon={EyeOff}
            title="Nenhum perfil oculto"
            description="Quando você ocultar um atleta pela ficha, ele ficará disponível aqui para reativação."
          />
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="Nenhum perfil encontrado"
            description="Tente buscar por outro nome ou e-mail."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtrados.map((perfil) => (
            <Card key={perfil.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning/10 text-sm font-extrabold text-ranking-gold-text">
                {perfil.nome.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-text">{perfil.nome}</p>
                <p className="truncate text-sm text-text-light">{perfil.email || "Sem e-mail vinculado"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{equipeLabel[perfil.equipe]}</Badge>
                  {perfil.role && <Badge tone="neutral">{roleLabel[perfil.role]}</Badge>}
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  Ocultado em {formatDateTime(perfil.ocultadoEm)}
                </p>
              </div>
              <Button
                variant="outline"
                className="h-11 w-full shrink-0 sm:w-auto"
                onClick={() => handleReativar(perfil)}
                loading={reativandoIds.has(perfil.id)}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reativar perfil
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
