"use client";

import { useState } from "react";
import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { MATERIAL_SKIP_REASON_LABELS } from "@/domains/sales/constants";

export function SkipPurchaseModal({ open, onClose, onConfirm, loading }) {
  const [skipReason, setSkipReason] = useState("");
  const [observations, setObservations] = useState("");
  const [error, setError] = useState("");

  function handleClose() {
    setSkipReason("");
    setObservations("");
    setError("");
    onClose?.();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!skipReason) {
      setError("Selecciona una razón");
      return;
    }
    await onConfirm?.({ skipReason, observations });
    handleClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="No se comprará"
      description="Indica la razón por la cual este material no se comprará."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Razón" required error={error}>
          <Select
            value={skipReason}
            onChange={(e) => {
              setSkipReason(e.target.value);
              setError("");
            }}
          >
            <option value="">Selecciona...</option>
            {Object.entries(MATERIAL_SKIP_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observaciones">
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
            placeholder="Detalle adicional (opcional)"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default SkipPurchaseModal;
