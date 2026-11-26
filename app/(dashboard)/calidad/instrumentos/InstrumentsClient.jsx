"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { useAssignableUsers } from "@/components/kpis/IncidentFormModal";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/feedback/ToastProvider";
import { INSTRUMENT_STATUS_LABELS } from "@/domains/quality/constants";
import { formatDate } from "@/lib/utils/format";

const MAX_CERTIFICATE_BYTES = 20 * 1024 * 1024;

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeFileName(name) {
  return String(name || "certificado")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 180);
}

function assigneeLabel(r, operators) {
  if (r.assignedUser) return r.assignedUser.name;
  if (r.assignedOperatorCode) {
    return operators.find((o) => o.code === r.assignedOperatorCode)?.label || r.assignedOperatorCode;
  }
  return null;
}

// Condicion (catalogo) y resguardo: operador del catalogo o usuario del ERP.
function InstrumentEditModal({ instrument, conditions, operators, onClose, onSaved }) {
  const users = useAssignableUsers(Boolean(instrument));
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!instrument) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setError("");
    setForm({
      conditionCode: instrument.conditionCode || "",
      assignee: instrument.assignedUserId
        ? `user:${instrument.assignedUserId}`
        : instrument.assignedOperatorCode
          ? `op:${instrument.assignedOperatorCode}`
          : "",
      assignedAt: instrument.assignedAt ? String(instrument.assignedAt).slice(0, 10) : "",
      notes: instrument.notes || "",
    });
  }, [instrument]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.patch(`/api/calidad/instrumentos/${instrument.id}`, {
        conditionCode: form.conditionCode || null,
        assignedUserId: form.assignee.startsWith("user:") ? form.assignee.slice(5) : null,
        assignedOperatorCode: form.assignee.startsWith("op:") ? form.assignee.slice(3) : null,
        ...(form.assignedAt ? { assignedAt: form.assignedAt } : {}),
        notes: form.notes || null,
      });
      onSaved();
    } catch (err) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(instrument && form)}
      onClose={saving ? undefined : onClose}
      title={`Condición y resguardo · ${instrument?.code || ""}`}
      description="Estatus del equipo y a quién está asignado."
      size="md"
    >
      {form && (
        <form onSubmit={save} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <label className="block text-sm">
            <span className="mb-1 block text-content-muted">Condición</span>
            <Select value={form.conditionCode} onChange={(e) => setForm((f) => ({ ...f, conditionCode: e.target.value }))}>
              <option value="">Sin indicar</option>
              {conditions
                .filter((c) => c.status === "ACTIVE" || c.code === form.conditionCode)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
            </Select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-content-muted">Asignado a</span>
              <Select value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}>
                <option value="">Sin asignar (almacén)</option>
                <optgroup label="Operadores">
                  {operators
                    .filter((o) => o.status === "ACTIVE" || `op:${o.code}` === form.assignee)
                    .map((o) => (
                      <option key={o.code} value={`op:${o.code}`}>
                        {o.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Usuarios (vendedores y personal)">
                  {users.map((u) => (
                    <option key={u.id} value={`user:${u.id}`}>
                      {u.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-content-muted">Fecha de entrega</span>
              <Input
                type="date"
                value={form.assignedAt}
                onChange={(e) => setForm((f) => ({ ...f, assignedAt: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-content-muted">Notas</span>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function InstrumentsClient() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [operators, setOperators] = useState([]);
  const [editingInstrument, setEditingInstrument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [calibratingInstrument, setCalibratingInstrument] = useState(null);
  const [calibrationForm, setCalibrationForm] = useState(null);
  const [form, setForm] = useState({
    code: "",
    type: "Calibrador",
    brand: "",
    model: "",
    serialNumber: "",
    unit: "mm",
    calibrationPeriodDays: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/calidad/instrumentos");
      setRows(res?.data || []);
      setConditions(res?.conditions || []);
      setOperators(res?.operators || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createInstrument(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/calidad/instrumentos", form);
      toast({ variant: "success", title: "Instrumento creado" });
      setForm((f) => ({ ...f, code: "", serialNumber: "" }));
      await load();
    } catch (err) {
      toast({ variant: "error", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  }

  function openCalibrationForm(instrument) {
    setCalibratingInstrument(instrument);
    setCalibrationForm({
      calibratedAt: localDateInputValue(),
      nextDueAt: "",
      calibrationPeriodDays: instrument.calibrationPeriodDays || "",
      provider: "",
      notes: "",
      certificate: null,
    });
  }

  async function addCalibration(event) {
    event.preventDefault();
    if (!calibratingInstrument || !calibrationForm) return;
    setSaving(true);
    try {
      if (
        new Date(calibrationForm.nextDueAt) <=
        new Date(calibrationForm.calibratedAt)
      ) {
        throw new Error(
          "La próxima calibración debe ser posterior a la fecha realizada"
        );
      }
      if (
        calibrationForm.certificate &&
        calibrationForm.certificate.size > MAX_CERTIFICATE_BYTES
      ) {
        throw new Error("El certificado supera 20 MB");
      }

      let certificateData = {};
      if (calibrationForm.certificate) {
        const file = calibrationForm.certificate;
        const safeName = sanitizeFileName(file.name);
        const pathname = `quality/instruments/${calibratingInstrument.id}/calibrations/${Date.now()}-${safeName}`;
        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: `/api/calidad/instrumentos/${calibratingInstrument.id}/certificado/upload`,
          multipart: file.size > 5 * 1024 * 1024,
        });
        certificateData = {
          certificatePathname: blob.pathname,
          certificateFileName: file.name,
          certificateUrl: blob.url || null,
        };
      }

      await api.post(
        `/api/calidad/instrumentos/${calibratingInstrument.id}`,
        {
          calibratedAt: calibrationForm.calibratedAt,
          nextDueAt: calibrationForm.nextDueAt,
          calibrationPeriodDays: Number(calibrationForm.calibrationPeriodDays),
          provider: calibrationForm.provider || null,
          notes: calibrationForm.notes || null,
          ...certificateData,
        }
      );
      toast({ variant: "success", title: "Calibración registrada" });
      setCalibratingInstrument(null);
      setCalibrationForm(null);
      await load();
    } catch (err) {
      toast({ variant: "error", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  }

  function updateCalibrationField(field, value) {
    setCalibrationForm((current) => ({ ...current, [field]: value }));
  }

  function certificateHref(pathname) {
    return `/api/blob?pathname=${encodeURIComponent(pathname)}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instrumentos de medición"
        description="Catálogo, control de calibraciones, condición y resguardo."
      />
      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardBody>
          <form onSubmit={createInstrument} className="grid gap-3 sm:grid-cols-3">
            <Input
              required
              placeholder="Código"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            <Input
              required
              placeholder="Tipo"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            />
            <Input
              placeholder="Marca"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            />
            <Input
              placeholder="Modelo"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            />
            <Input
              placeholder="Serie"
              value={form.serialNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, serialNumber: e.target.value }))
              }
            />
            <Input
              placeholder="Unidad"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
            <label className="text-sm">
              <span className="mb-1 block text-content-muted">
                Periodicidad de calibración (días)
              </span>
              <Input
                type="number"
                min="1"
                required
                value={form.calibrationPeriodDays}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    calibrationPeriodDays: e.target.value,
                  }))
                }
              />
            </label>
            <Button type="submit" loading={saving}>
              Nuevo instrumento
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-content-muted">Sin instrumentos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-content-muted">
                    <th className="px-2 py-2">Código</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Serie</th>
                    <th className="px-2 py-2">Cada</th>
                    <th className="px-2 py-2">Última cal.</th>
                    <th className="px-2 py-2">Próxima</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Condición</th>
                    <th className="px-2 py-2">Asignado a</th>
                    <th className="px-2 py-2">Certificados recientes</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 font-medium">{r.code}</td>
                      <td className="px-2 py-2">{r.type}</td>
                      <td className="px-2 py-2">{r.serialNumber || "—"}</td>
                      <td className="px-2 py-2">
                        {r.calibrationPeriodDays
                          ? `${r.calibrationPeriodDays} días`
                          : "—"}
                      </td>
                      <td className="px-2 py-2">
                        {formatDate(r.lastCalibrationAt) || "—"}
                      </td>
                      <td className="px-2 py-2">
                        {formatDate(r.nextCalibrationAt) || "—"}
                      </td>
                      <td className="px-2 py-2">
                        <Badge>
                          {INSTRUMENT_STATUS_LABELS[r.status] || r.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">
                        {r.conditionCode ? (
                          <Badge
                            tone={
                              ["DADO_DE_BAJA", "EXTRAVIADO"].includes(r.conditionCode)
                                ? "danger"
                                : r.conditionCode === "EN_REPARACION"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {conditions.find((c) => c.code === r.conditionCode)?.label || r.conditionCode}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {assigneeLabel(r, operators) || <span className="text-content-muted">Sin asignar</span>}
                        {r.assignedAt && (
                          <span className="block text-xs text-content-muted">desde {formatDate(r.assignedAt)}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {(r.calibrations || []).some(
                          (calibration) => calibration.certificatePathname
                        ) ? (
                          <ul className="space-y-1">
                            {r.calibrations
                              .filter((calibration) => calibration.certificatePathname)
                              .map((calibration) => (
                                <li key={calibration.id}>
                                  <a
                                    href={certificateHref(
                                      calibration.certificatePathname
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-brand-700 hover:underline"
                                  >
                                    {formatDate(calibration.calibratedAt)} ·{" "}
                                    {calibration.certificateFileName || "Certificado"}
                                  </a>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="subtle" onClick={() => setEditingInstrument(r)}>
                            Condición / asignar
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={saving}
                            onClick={() => openCalibrationForm(r)}
                          >
                            Registrar calibración
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <InstrumentEditModal
        instrument={editingInstrument}
        conditions={conditions}
        operators={operators}
        onClose={() => setEditingInstrument(null)}
        onSaved={() => {
          setEditingInstrument(null);
          toast({ variant: "success", title: "Instrumento actualizado" });
          load();
        }}
      />

      <Modal
        open={Boolean(calibratingInstrument && calibrationForm)}
        onClose={saving ? undefined : () => setCalibratingInstrument(null)}
        title={`Registrar calibración · ${calibratingInstrument?.code || ""}`}
        description="Indica las fechas de calibración y adjunta el certificado si está disponible."
        size="md"
      >
        {calibrationForm && (
          <form onSubmit={addCalibration} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-content-muted">
                  Fecha de calibración
                </span>
                <Input
                  type="date"
                  required
                  value={calibrationForm.calibratedAt}
                  onChange={(e) =>
                    updateCalibrationField("calibratedAt", e.target.value)
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-content-muted">
                  Próxima calibración
                </span>
                <Input
                  type="date"
                  required
                  value={calibrationForm.nextDueAt}
                  onChange={(e) =>
                    updateCalibrationField("nextDueAt", e.target.value)
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-content-muted">
                  Periodicidad (días)
                </span>
                <Input
                  type="number"
                  min="1"
                  required
                  value={calibrationForm.calibrationPeriodDays}
                  onChange={(e) =>
                    updateCalibrationField(
                      "calibrationPeriodDays",
                      e.target.value
                    )
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-content-muted">
                  Laboratorio / proveedor
                </span>
                <Input
                  value={calibrationForm.provider}
                  onChange={(e) =>
                    updateCalibrationField("provider", e.target.value)
                  }
                  placeholder="Nombre del laboratorio"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-content-muted">
                Certificado de calibración (PDF, JPG o PNG)
              </span>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(e) =>
                  updateCalibrationField(
                    "certificate",
                    e.target.files?.[0] || null
                  )
                }
              />
              {calibrationForm.certificate && (
                <span className="mt-1 block text-xs text-content-muted">
                  {calibrationForm.certificate.name}
                </span>
              )}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-content-muted">Notas</span>
              <Textarea
                rows={3}
                value={calibrationForm.notes}
                onChange={(e) => updateCalibrationField("notes", e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setCalibratingInstrument(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                Guardar calibración
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
