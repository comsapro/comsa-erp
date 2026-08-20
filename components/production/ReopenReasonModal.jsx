"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PRODUCTION_REOPEN_REASONS } from "@/domains/production/constants";

// Quitar un cierre y regresar a fabricacion son operaciones distintas: la primera solo
// deshace el terminado, la segunda manda la partida a retrabajo.
export const REOPEN_MODES = {
  uncomplete: {
    action: "uncomplete",
    title: "Deshacer terminado",
    description:
      "Se quita el cierre de la partida sin perder el avance capturado ni los procesos ya terminados.",
    confirmLabel: "Deshacer terminado",
    defaultReason: "CAPTURA_ERRONEA",
  },
  rework: {
    action: "reopen",
    title: "Regresar a fabricacion",
    description:
      "La partida pasa a retrabajo y sus procesos vuelven a pendiente. El historial de terminado se conserva.",
    confirmLabel: "Regresar a fabricacion",
    defaultReason: "RECHAZO_CLIENTE",
  },
};

export function ReopenReasonModal({ open, mode = "rework", loading = false, onClose, onConfirm }) {
  const config = REOPEN_MODES[mode] || REOPEN_MODES.rework;
  const [reasonCode, setReasonCode] = useState(config.defaultReason);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setReasonCode(config.defaultReason);
    setNote("");
  }, [open, config.defaultReason]);

  const noteRequired = reasonCode === "OTRO";
  const invalid = noteRequired && note.trim().length < 8;

  return (
    <Modal open={open} onClose={onClose} title={config.title} description={config.description}>
      <div className="space-y-3">
        <div>
          <label
            htmlFor="reopen-reason-code"
            className="mb-1 block text-xs font-medium text-content-muted"
          >
            Motivo
          </label>
          <Select
            id="reopen-reason-code"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
          >
            {PRODUCTION_REOPEN_REASONS.map((reason) => (
              <option key={reason.code} value={reason.code}>
                {reason.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="reopen-reason-note" className="mb-1 block text-xs font-medium text-content-muted">
            {noteRequired ? "Detalle (obligatorio)" : "Detalle (opcional)"}
          </label>
          <Textarea
            id="reopen-reason-note"
            rows={3}
            placeholder={noteRequired ? "Describe el motivo (min. 8 caracteres)" : "Comentario para la bitacora"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          loading={loading}
          disabled={invalid}
          onClick={() => onConfirm({ reasonCode, reason: note.trim() })}
        >
          {config.confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
