"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/feedback/Alert";
import { formatDateTime } from "@/lib/utils/format";
import { CORRECTABLE_INVOICE_FIELDS } from "@/domains/kpis/constants";
import { formatDayShort } from "@/domains/kpis/periods";

function displayValue(field, value) {
  if (value == null || value === "") return "—";
  return CORRECTABLE_INVOICE_FIELDS[field]?.type === "date" ? formatDayShort(value) : value;
}

/**
 * Correccion manual de datos de una factura con auditoria: conserva dato
 * original, dato nuevo, quien, cuando y por que.
 */
export function CorrectionModal({ open, invoice, canCorrect, onClose, onSaved, defaultField = "receptionDate" }) {
  const [history, setHistory] = useState([]);
  const [field, setField] = useState(defaultField);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !invoice) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setField(defaultField);
    setValue(invoice[defaultField] ?? "");
    setReason("");
    setError("");
    api
      .get(`/api/kpis/correcciones${toQuery({ entityType: "SalesInvoice", entityId: invoice.id })}`)
      .then((res) => setHistory(res?.data || []))
      .catch(() => setHistory([]));
  }, [open, invoice, defaultField]);

  function changeField(next) {
    setField(next);
    setValue(invoice?.[next] ?? "");
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/api/kpis/correcciones", {
        invoiceId: invoice.id,
        field,
        value: value === "" ? null : value,
        reason,
      });
      onSaved?.();
    } catch (err) {
      setError(err.message || "No se pudo guardar la correccion");
    } finally {
      setSaving(false);
    }
  }

  const def = CORRECTABLE_INVOICE_FIELDS[field];

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={`Factura ${invoice?.invoiceNumber || ""}`}
      description={canCorrect ? "Corrección auditada: el dato original nunca se sobrescribe en silencio." : "Historial de correcciones"}
      size="lg"
    >
      {invoice && (
        <div className="flex flex-col gap-5">
          {canCorrect && (
            <form onSubmit={save} className="flex flex-col gap-4">
              {error && <Alert variant="danger">{error}</Alert>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dato a corregir" htmlFor="corr-field">
                  <Select id="corr-field" value={field} onChange={(e) => changeField(e.target.value)}>
                    {Object.entries(CORRECTABLE_INVOICE_FIELDS).map(([k, d]) => (
                      <option key={k} value={k}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Valor actual">
                  <p className="flex h-10 items-center text-sm">{displayValue(field, invoice[field])}</p>
                </Field>
                <Field label="Nuevo valor" htmlFor="corr-value" hint="Vacío = quitar el dato (excepto fecha de factura).">
                  <Input
                    id="corr-value"
                    type={def?.type === "date" ? "date" : "number"}
                    min={def?.type === "int" ? 0 : undefined}
                    value={value ?? ""}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </Field>
                <Field label="Motivo" htmlFor="corr-reason" required>
                  <Textarea
                    id="corr-reason"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej. Cliente confirmó recepción posteriormente."
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                  Cerrar
                </Button>
                <Button type="submit" loading={saving} disabled={reason.trim().length < 5}>
                  Guardar corrección
                </Button>
              </div>
            </form>
          )}

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-content">
              <History className="h-4 w-4" aria-hidden />
              Historial de correcciones
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-content-muted">Sin correcciones registradas.</p>
            ) : (
              <ul className="divide-y divide-border rounded-[var(--radius-sm)] border border-border text-sm">
                {history.map((h) => (
                  <li key={h.id} className="px-3 py-2">
                    <p className="font-medium">{h.fieldLabel}</p>
                    <p>
                      <span className="text-content-muted">Dato original:</span> {displayValue(h.field, h.originalValue)}{" "}
                      <span className="text-content-muted">→ Dato modificado:</span> {displayValue(h.field, h.newValue)}
                    </p>
                    <p className="text-xs text-content-muted">
                      {h.correctedByUser?.name || "Sistema"} · {formatDateTime(h.correctedAt)} · Motivo: {h.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default CorrectionModal;
