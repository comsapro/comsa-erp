"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/forms/Field";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/feedback/Alert";

export function CompleteInspectionModal({
  open,
  onClose,
  onComplete,
  summary,
  loading = false,
}) {
  const [comments, setComments] = useState("");
  const failed = summary?.measurementsFailed || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cerrar inspeccion"
      description="Elige el resultado final. Un fallo dimensional no bloquea la produccion."
      size="md"
    >
      {failed > 0 ? (
        <Alert variant="warning" title="Hay mediciones fuera de tolerancia">
          {failed} medicion(es) no pasan. Puedes completar o rechazar explicitamente.
        </Alert>
      ) : null}
      <div className="mt-3 text-sm text-content-muted">
        Mediciones: {summary?.measurementsPassed || 0} PASA / {failed} NO PASA ·
        Comentarios {summary?.comments || 0} · Observaciones {summary?.observations || 0}
      </div>
      <Field label="Comentarios generales" htmlFor="complete-comments" className="mt-4">
        <Textarea
          id="complete-comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
        />
      </Field>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          loading={loading}
          onClick={() => onComplete({ result: "REJECTED", generalComments: comments })}
        >
          Rechazar
        </Button>
        <Button
          loading={loading}
          onClick={() => onComplete({ result: "COMPLETED", generalComments: comments })}
        >
          Completar / Aprobar
        </Button>
      </div>
    </Modal>
  );
}

export default CompleteInspectionModal;
