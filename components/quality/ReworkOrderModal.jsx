"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/feedback/Alert";

export function ReworkOrderModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  pieceLabel = "",
  processes = [],
}) {
  const [cause, setCause] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selected, setSelected] = useState([]);
  const [extraProcess, setExtraProcess] = useState("");
  const [error, setError] = useState("");

  const options = useMemo(() => {
    const seen = new Set();
    const rows = [];
    for (const p of processes || []) {
      const name = p.processNameSnapshot || p.name || "";
      if (!name || seen.has(name)) continue;
      seen.add(name);
      rows.push({ id: p.id || null, name });
    }
    return rows;
  }, [processes]);

  useEffect(() => {
    if (!open) return;
    setCause("");
    setInstructions("");
    setExtraProcess("");
    setError("");
    setSelected([]);
  }, [open, pieceLabel]);

  function toggle(name) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  function addExtra() {
    const name = extraProcess.trim();
    if (!name) return;
    setSelected((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setExtraProcess("");
  }

  async function handleSubmit() {
    setError("");
    if (cause.trim().length < 3) {
      setError("Indica el motivo del retrabajo");
      return;
    }
    if (selected.length === 0) {
      setError("Selecciona al menos un proceso que necesitara la pieza");
      return;
    }
    const processesPayload = selected.map((name) => {
      const match = options.find((o) => o.name === name);
      return { id: match?.id || null, name };
    });
    await onSubmit?.({
      cause: cause.trim(),
      instructions: instructions.trim() || null,
      processes: processesPayload,
    });
  }

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title="Orden de retrabajo"
      description={
        pieceLabel
          ? `Indica el motivo y los procesos necesarios para ${pieceLabel}.`
          : "Indica el motivo y los procesos necesarios para el retrabajo."
      }
      size="lg"
    >
      <div className="space-y-4">
        {error ? <Alert variant="danger">{error}</Alert> : null}

        <label className="block text-sm">
          <span className="mb-1 block text-content-muted">Motivo del retrabajo</span>
          <Textarea
            rows={3}
            value={cause}
            onChange={(e) => setCause(e.target.value)}
            placeholder="Ej. Dimension fuera de tolerancia en diametro exterior"
            disabled={loading}
          />
        </label>

        <div className="space-y-2">
          <p className="text-sm text-content-muted">
            Procesos que necesitara la pieza
          </p>
          {options.length === 0 ? (
            <p className="text-xs text-content-muted">
              Esta partida no tiene procesos cargados. Agrega los que apliquen.
            </p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-auto rounded-[var(--radius-md)] border border-border p-2">
              {options.map((opt) => (
                <li key={opt.id || opt.name}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-muted/60">
                    <input
                      type="checkbox"
                      checked={selected.includes(opt.name)}
                      onChange={() => toggle(opt.name)}
                      disabled={loading}
                    />
                    <span>{opt.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[12rem] flex-1"
              value={extraProcess}
              onChange={(e) => setExtraProcess(e.target.value)}
              placeholder="Otro proceso..."
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addExtra();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={loading || !extraProcess.trim()}
              onClick={addExtra}
            >
              Agregar
            </Button>
          </div>
          {selected.length > 0 ? (
            <p className="text-xs text-content-muted">
              Seleccionados: {selected.join(", ")}
            </p>
          ) : null}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-content-muted">
            Instrucciones (opcional)
          </span>
          <Textarea
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Indicaciones para produccion / hoja viajera"
            disabled={loading}
          />
        </label>

        <p className="text-xs text-content-muted">
          Al guardar se notificara a supervisores de produccion y podras imprimir
          la orden de retrabajo.
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={loading} onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} onClick={handleSubmit}>
            Crear e imprimir
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ReworkOrderModal;
