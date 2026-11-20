"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { Tabs, SimpleTable } from "@/components/kpis/ui";
import {
  KPI_CATALOG_TYPES,
  KPI_CATALOG_TYPE_LABELS,
  KPI_MODULES,
  SUGGESTED_RESPONSIBLE_OPTIONS,
} from "@/domains/kpis/constants";

const EMPTY = {
  code: "",
  label: "",
  description: "",
  relatedModules: [],
  suggestedResponsible: "NONE",
  requiredAction: "",
  sortOrder: 0,
  status: "ACTIVE",
};

function EntryModal({ open, type, entry, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setForm(entry ? { ...EMPTY, ...entry, description: entry.description || "", requiredAction: entry.requiredAction || "" } : EMPTY);
    setError("");
  }, [open, entry]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isStop = type === "STOP_REASON";

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      label: form.label,
      description: form.description || null,
      relatedModules: form.relatedModules,
      suggestedResponsible: form.suggestedResponsible,
      requiredAction: form.requiredAction || null,
      sortOrder: Number(form.sortOrder) || 0,
      status: form.status,
    };
    try {
      if (entry) await api.patch(`/api/kpis/catalogos/${entry.id}`, payload);
      else await api.post("/api/kpis/catalogos", { ...payload, type, code: form.code });
      onSaved();
    } catch (err) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title={entry ? "Editar entrada" : "Nueva entrada"} description={KPI_CATALOG_TYPE_LABELS[type]} size="lg">
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="cat-label" required>
            <Input id="cat-label" value={form.label} onChange={(e) => set({ label: e.target.value })} required />
          </Field>
          <Field label="Código" htmlFor="cat-code" required hint={entry ? "El código no se puede cambiar." : "Mayúsculas, sin espacios."}>
            <Input id="cat-code" value={form.code} disabled={Boolean(entry)} onChange={(e) => set({ code: e.target.value.toUpperCase() })} required />
          </Field>
          <Field label="Orden" htmlFor="cat-order">
            <Input id="cat-order" type="number" min="0" value={form.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />
          </Field>
          <Field label="Estatus" htmlFor="cat-status">
            <Select id="cat-status" value={form.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="ACTIVE">Activo</option>
              <option value="INACTIVE">Inactivo</option>
            </Select>
          </Field>
        </div>
        {isStop && (
          <>
            <Field label="Ruta de módulos responsables" hint="En orden: quién detecta → quién resuelve.">
              <div className="flex flex-wrap gap-3">
                {Object.entries(KPI_MODULES).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.relatedModules.includes(k)}
                      onChange={(e) =>
                        set({
                          relatedModules: e.target.checked
                            ? [...form.relatedModules, k]
                            : form.relatedModules.filter((m) => m !== k),
                        })
                      }
                    />
                    {l}
                  </label>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Responsable sugerido" htmlFor="cat-suggest">
                <Select id="cat-suggest" value={form.suggestedResponsible} onChange={(e) => set({ suggestedResponsible: e.target.value })}>
                  {Object.entries(SUGGESTED_RESPONSIBLE_OPTIONS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Acción requerida (texto de la notificación)" htmlFor="cat-action">
                <Textarea id="cat-action" rows={2} value={form.requiredAction} onChange={(e) => set({ requiredAction: e.target.value })} />
              </Field>
            </div>
          </>
        )}
        <Field label="Descripción" htmlFor="cat-desc">
          <Textarea id="cat-desc" rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SettingsCard() {
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/kpis/configuracion")
      .then(setForm)
      .catch((err) => setError(err.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      setForm(await api.put("/api/kpis/configuracion", form));
      toast({ variant: "success", title: "Parámetros guardados" });
    } catch (err) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <Skeleton className="h-40 w-full" />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card>
      <form onSubmit={save} className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-content">Parámetros de cálculo</h2>
          <p className="text-sm text-content-muted">Se aplican a todos los indicadores.</p>
        </div>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="IVA (%)" htmlFor="set-tax" hint="Metas y facturas con/sin IVA">
            <Input id="set-tax" type="number" step="0.01" min="0" value={form.taxRate} onChange={set("taxRate")} />
          </Field>
          <Field label="Costo hora mano de obra" htmlFor="set-rate" hint="Costo de horas en errores">
            <Input id="set-rate" type="number" step="0.01" min="0" value={form.laborHourRate} onChange={set("laborHourRate")} />
          </Field>
          <Field label="Crédito por defecto (días)" htmlFor="set-credit" hint="Si el cliente no tiene">
            <Input id="set-credit" type="number" min="0" value={form.defaultCreditDays} onChange={set("defaultCreditDays")} />
          </Field>
          <Field label="Próximos a vencer (días)" htmlFor="set-upcoming" hint="Compromisos de producción">
            <Input id="set-upcoming" type="number" min="1" value={form.upcomingDays} onChange={set("upcomingDays")} />
          </Field>
          <Field label="Cobranza por vencer (días)" htmlFor="set-due" hint="Aviso antes del vencimiento">
            <Input id="set-due" type="number" min="1" value={form.dueSoonDays} onChange={set("dueSoonDays")} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Guardar parámetros
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function KpiCatalogsClient() {
  const { toast } = useToast();
  const [type, setType] = useState(KPI_CATALOG_TYPES.STOP_REASON);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/api/kpis/catalogos${toQuery({ type, all: "1" })}`);
      setRows(res?.data || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el catálogo");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  const isStop = type === "STOP_REASON";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catálogos KPI"
        description="Razones de paro, causas y áreas de error, y parámetros del Dashboard gerencial."
      />
      <SettingsCard />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-3">
          <Tabs
            tabs={Object.values(KPI_CATALOG_TYPES).map((k) => ({ key: k, label: KPI_CATALOG_TYPE_LABELS[k] }))}
            value={type}
            onChange={setType}
          />
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nueva entrada
          </Button>
        </div>
        <div className="p-3 sm:p-5">
          {error && <Alert variant="danger">{error}</Alert>}
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <SimpleTable
              rows={rows}
              columns={[
                { key: "sortOrder", header: "#", align: "right" },
                { key: "label", header: "Nombre", render: (r) => <span className="font-medium">{r.label}</span> },
                { key: "code", header: "Código", render: (r) => <code className="text-xs">{r.code}</code> },
                ...(isStop
                  ? [
                      {
                        key: "route",
                        header: "Ruta",
                        render: (r) =>
                          r.relatedModules?.length ? (
                            <span className="flex flex-wrap gap-1">
                              {r.relatedModules.map((m) => (
                                <Badge key={m} tone="brand">
                                  {KPI_MODULES[m] || m}
                                </Badge>
                              ))}
                            </span>
                          ) : (
                            "—"
                          ),
                      },
                      {
                        key: "suggest",
                        header: "Responsable sugerido",
                        render: (r) => SUGGESTED_RESPONSIBLE_OPTIONS[r.suggestedResponsible] || "—",
                      },
                    ]
                  : []),
                { key: "status", header: "Estatus", render: (r) => <StatusBadge status={r.status} /> },
                {
                  key: "actions",
                  header: "",
                  render: (r) => (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)} aria-label="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(r)} aria-label="Eliminar">
                        <Trash2 className="h-3.5 w-3.5 text-danger-700" />
                      </Button>
                    </div>
                  ),
                },
              ]}
              empty="Catálogo vacío."
            />
          )}
        </div>
      </Card>

      <EntryModal
        open={creating || Boolean(editing)}
        type={type}
        entry={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          toast({ variant: "success", title: "Catálogo actualizado" });
          load();
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar entrada"
        description={`¿Eliminar "${deleting?.label}"? Los registros históricos conservan el dato.`}
        confirmLabel="Eliminar"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await api.del(`/api/kpis/catalogos/${deleting.id}`);
            toast({ variant: "success", title: "Entrada eliminada" });
            load();
          } catch (err) {
            toast({ variant: "error", title: err.message });
          } finally {
            setDeleting(null);
          }
        }}
      />
    </div>
  );
}
