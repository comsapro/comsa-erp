"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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
import { formatMoney } from "@/lib/utils/format";
import { PeriodSelector, normalizePeriodParams, periodApiParams } from "@/components/kpis/PeriodSelector";
import { SimpleTable } from "@/components/kpis/ui";
import { useAssignableUsers } from "@/components/kpis/IncidentFormModal";
import {
  COST_CATEGORY_LABELS,
  COST_CONCEPTS,
  COST_CONCEPT_LABELS,
  DETECTION_STAGES,
  DETECTION_STAGE_LABELS,
  DETECTION_STAGE_SHORT,
} from "@/domains/kpis/constants";
import { errorCost } from "@/domains/kpis/calculations";
import { formatDayShort, periodQuery, todayKey } from "@/domains/kpis/periods";

const emptyLine = (category = "LABOR") => ({
  category,
  concept: COST_CONCEPTS[category][0].code,
  hours: "",
  hourlyRate: "",
  amount: "",
  notes: "",
});

function OrderPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  async function search() {
    setSearching(true);
    try {
      const res = await api.get(`/api/produccion${toQuery({ q, pageSize: 15 })}`);
      setResults(res?.data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-2 text-sm">
        <span>
          <span className="font-medium">{value.folio}</span> · {value.client || ""}
        </span>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label="Cambiar orden">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Folio de OP o cliente…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
        />
        <Button type="button" variant="secondary" loading={searching} onClick={search} aria-label="Buscar orden">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-[var(--radius-sm)] border border-border text-sm">
          {results.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-surface-muted"
                onClick={() => onChange({ id: o.id, folio: o.folio, client: o.client?.commercialName })}
              >
                <span className="font-medium">{o.folio}</span> · {o.client?.commercialName || ""}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ErrorModal({ open, error: editing, causes, areas, laborRate, onClose, onSaved }) {
  const users = useAssignableUsers(open);
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setError("");
    if (editing) {
      setOrder({ id: editing.productionOrderId, folio: editing.project, client: editing.client });
      setForm({
        productionItemId: editing.productionItemId || "",
        detectedAt: editing.detectedAt,
        detectionStage: editing.detectionStage,
        causeCode: editing.causeCode || "",
        areaCode: editing.areaCode || "",
        operatorUserId: editing.operatorUserId || "",
        operatorName: editing.operatorName || "",
        description: editing.description,
        costs: editing.costs.map((c) => ({
          ...c,
          hours: c.hours ?? "",
          hourlyRate: c.hourlyRate ?? "",
          amount: c.amount || "",
          notes: c.notes || "",
        })),
      });
    } else {
      setOrder(null);
      setForm({
        productionItemId: "",
        detectedAt: todayKey(),
        detectionStage: "QUALITY",
        causeCode: "",
        areaCode: "",
        operatorUserId: "",
        operatorName: "",
        description: "",
        costs: [],
      });
    }
  }, [open, editing]);

  useEffect(() => {
    if (!order?.id) {
      setItems([]);
      return;
    }
    api
      .get(`/api/produccion/${order.id}`)
      .then((res) => setItems(res?.items || []))
      .catch(() => setItems([]));
  }, [order?.id]);

  const preview = useMemo(
    () =>
      form
        ? errorCost(
            {
              costs: form.costs.map((c) => ({
                ...c,
                hours: c.hours === "" ? null : Number(c.hours),
                hourlyRate: c.hourlyRate === "" ? null : Number(c.hourlyRate),
                amount: Number(c.amount) || 0,
              })),
              linkedReworkHours: editing?.linkedReworkHours || 0,
            },
            laborRate
          )
        : null,
    [form, laborRate, editing]
  );

  if (!form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (i, patch) =>
    setForm((f) => ({ ...f, costs: f.costs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));

  async function save(e) {
    e.preventDefault();
    if (!order) {
      setError("Selecciona la orden de producción");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      productionItemId: form.productionItemId || null,
      causeCode: form.causeCode || null,
      areaCode: form.areaCode || null,
      operatorUserId: form.operatorUserId || null,
      operatorName: form.operatorName || null,
      costs: form.costs.map((c) => ({
        category: c.category,
        concept: c.concept,
        hours: c.category === "LABOR" && c.hours !== "" ? Number(c.hours) : null,
        hourlyRate: c.category === "LABOR" && c.hourlyRate !== "" ? Number(c.hourlyRate) : null,
        amount: Number(c.amount) || 0,
        notes: c.notes || null,
      })),
    };
    try {
      if (editing) await api.patch(`/api/calidad/errores/${editing.id}`, payload);
      else await api.post("/api/calidad/errores", { ...payload, productionOrderId: order.id });
      onSaved();
    } catch (err) {
      const fields = err.fieldErrors ? Object.values(err.fieldErrors).flat().join(" · ") : "";
      setError(`${err.message || "No se pudo guardar"}${fields ? `: ${fields}` : ""}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title={editing ? "Editar error" : "Registrar error"} size="xl">
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Proyecto (orden de producción)" required className="md:col-span-2">
            {editing ? (
              <p className="flex h-10 items-center text-sm font-medium">
                {order?.folio} · {order?.client}
              </p>
            ) : (
              <OrderPicker value={order} onChange={setOrder} />
            )}
          </Field>
          <Field label="Partida" htmlFor="qe-item">
            <Select id="qe-item" value={form.productionItemId} onChange={(e) => set({ productionItemId: e.target.value })}>
              <option value="">Toda la orden</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.position}. {i.description?.slice(0, 60)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha de detección" htmlFor="qe-date" required>
            <Input id="qe-date" type="date" value={form.detectedAt} onChange={(e) => set({ detectedAt: e.target.value })} />
          </Field>
          <Field label="¿Dónde se detectó?" htmlFor="qe-stage" required className="md:col-span-2">
            <Select id="qe-stage" value={form.detectionStage} onChange={(e) => set({ detectionStage: e.target.value })}>
              {DETECTION_STAGES.map((s) => (
                <option key={s} value={s}>
                  {DETECTION_STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Área" htmlFor="qe-area" hint={editing?.areaText && !form.areaCode ? `Capturado: “${editing.areaText}”` : undefined}>
            <Select id="qe-area" value={form.areaCode} onChange={(e) => set({ areaCode: e.target.value })}>
              <option value="">Sin clasificar</option>
              {areas.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Causa" htmlFor="qe-cause">
            <Select id="qe-cause" value={form.causeCode} onChange={(e) => set({ causeCode: e.target.value })}>
              <option value="">Sin clasificar</option>
              {causes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Operador" htmlFor="qe-operator" hint="Usuario del ERP o nombre libre">
            <div className="flex gap-2">
              <Select id="qe-operator" value={form.operatorUserId} onChange={(e) => set({ operatorUserId: e.target.value })}>
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              {!form.operatorUserId && (
                <Input value={form.operatorName} onChange={(e) => set({ operatorName: e.target.value })} placeholder="Nombre" aria-label="Nombre del operador" />
              )}
            </div>
          </Field>
          <Field label="Descripción del error" htmlFor="qe-desc" required className="md:col-span-3">
            <Textarea id="qe-desc" rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
        </div>

        <div className="rounded-[var(--radius-md)] border border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
            <p className="text-sm font-semibold text-content">Costo del error</p>
            <div className="flex gap-1">
              {Object.keys(COST_CONCEPTS).map((cat) => (
                <Button key={cat} type="button" size="sm" variant="subtle" onClick={() => set({ costs: [...form.costs, emptyLine(cat)] })}>
                  <Plus className="h-3.5 w-3.5" />
                  {COST_CATEGORY_LABELS[cat]}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2 p-3">
            {editing?.linkedReworkHours > 0 && (
              <p className="text-xs text-content-muted">
                Retrabajo ligado ({editing.reworkFolio || "retrabajo simple"}): {editing.linkedReworkHours} h — se suman como horas de retrabajo
                si no capturas una línea de “Horas de retrabajo”.
              </p>
            )}
            {form.costs.length === 0 && <p className="text-sm text-content-muted">Sin costos capturados.</p>}
            {form.costs.map((c, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[8rem_1fr_6rem_7rem_8rem_auto]">
                <span className="text-xs font-medium text-content-muted">{COST_CATEGORY_LABELS[c.category]}</span>
                <Select value={c.concept} onChange={(e) => setLine(i, { concept: e.target.value })} aria-label="Concepto">
                  {COST_CONCEPTS[c.category].map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                {c.category === "LABOR" ? (
                  <>
                    <Input type="number" step="0.25" min="0" placeholder="Horas" value={c.hours} onChange={(e) => setLine(i, { hours: e.target.value })} aria-label="Horas" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={`$${laborRate}/h`}
                      value={c.hourlyRate}
                      onChange={(e) => setLine(i, { hourlyRate: e.target.value })}
                      aria-label="Tarifa por hora"
                    />
                  </>
                ) : (
                  <span className="sm:col-span-2" />
                )}
                {c.category === "LABOR" ? (
                  <span className="text-right text-sm tabular-nums">
                    {formatMoney((Number(c.hours) || 0) * (c.hourlyRate === "" ? laborRate : Number(c.hourlyRate)))}
                  </span>
                ) : (
                  <Input type="number" step="0.01" min="0" placeholder="Monto" value={c.amount} onChange={(e) => setLine(i, { amount: e.target.value })} aria-label="Monto" />
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => set({ costs: form.costs.filter((_, idx) => idx !== i) })} aria-label="Quitar línea">
                  <Trash2 className="h-3.5 w-3.5 text-danger-700" />
                </Button>
              </div>
            ))}
          </div>
          {preview && (
            <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-sm">
              <span>Mano de obra: {formatMoney(preview.labor)}</span>
              <span>Materiales: {formatMoney(preview.material)}</span>
              <span>Otros: {formatMoney(preview.other)}</span>
              <span className="font-semibold">Total: {formatMoney(preview.total)}</span>
            </div>
          )}
        </div>

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

export default function QualityErrorsClient({ initialParams, canEdit }) {
  const router = useRouter();
  const { toast } = useToast();
  const [period, setPeriod] = useState(() => normalizePeriodParams(initialParams));
  const [stage, setStage] = useState("");
  const [onlyUnclassified, setOnlyUnclassified] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const apiParams = useMemo(() => periodApiParams(period), [period]);

  useEffect(() => {
    const qs = periodQuery(apiParams);
    router.replace(`/calidad/errores${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [apiParams, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await api.get(
          `/api/calidad/errores${toQuery({ ...apiParams, stage, unclassified: onlyUnclassified ? "1" : undefined })}`
        )
      );
    } catch (err) {
      setError(err.message || "No se pudieron cargar los errores");
    } finally {
      setLoading(false);
    }
  }, [apiParams, stage, onlyUnclassified]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  const total = (data?.data || []).reduce((s, e) => s + e.cost.total, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Errores y costos de calidad"
        description="Clasifica causas, áreas y operadores, y acumula horas, materiales y otros costos por error."
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Registrar error
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <PeriodSelector value={period} onChange={setPeriod} compact />
        <Select className="h-9 w-56!" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Detección">
          <option value="">Todas las detecciones</option>
          {DETECTION_STAGES.map((s) => (
            <option key={s} value={s}>
              {DETECTION_STAGE_SHORT[s]}
            </option>
          ))}
        </Select>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyUnclassified} onChange={(e) => setOnlyUnclassified(e.target.checked)} />
          Solo sin clasificar
        </label>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-sm">
          <span>
            {data?.period?.label} · {(data?.data || []).length} error(es)
          </span>
          <span className="font-semibold">Costo total: {formatMoney(total)}</span>
        </div>
        <div className="p-3 sm:p-5">
          {loading && !data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <SimpleTable
              rows={data?.data || []}
              empty="Sin errores en el periodo. Los retrabajos registrados en Calidad aparecen aquí automáticamente."
              columns={[
                { key: "detectedAt", header: "Fecha", render: (r) => formatDayShort(r.detectedAt) },
                {
                  key: "project",
                  header: "Proyecto",
                  render: (r) => (
                    <Link href={`/produccion/${r.productionOrderId}`} className="text-brand-700 hover:underline">
                      {r.project}
                    </Link>
                  ),
                },
                { key: "quoteFolio", header: "Cotización", render: (r) => r.quoteFolio || "—" },
                { key: "position", header: "Part.", align: "right", render: (r) => r.position ?? "—" },
                {
                  key: "stage",
                  header: "Detección",
                  render: (r) => (
                    <Badge tone={r.detectionStage === "CLIENT" ? "danger" : r.detectionStage === "QUALITY" ? "brand" : "neutral"}>
                      {DETECTION_STAGE_SHORT[r.detectionStage]}
                    </Badge>
                  ),
                },
                { key: "area", header: "Área", render: (r) => r.areaLabel || <span className="text-warning-700">Sin clasificar</span> },
                { key: "cause", header: "Causa", render: (r) => r.causeLabel || <span className="text-warning-700">Sin clasificar</span> },
                { key: "operatorLabel", header: "Operador" },
                {
                  key: "description",
                  header: "Descripción",
                  className: "min-w-[14rem]",
                  render: (r) => (
                    <div>
                      <p className="line-clamp-2">{r.description}</p>
                      {r.source !== "MANUAL" && <p className="text-xs text-content-muted">Desde retrabajo {r.reworkFolio || ""}</p>}
                    </div>
                  ),
                },
                {
                  key: "costs",
                  header: "Costo",
                  align: "right",
                  render: (r) => (
                    <span title={r.costs.map((c) => `${COST_CONCEPT_LABELS[c.concept] || c.concept}`).join(", ")}>
                      {formatMoney(r.cost.total)}
                      <span className="block text-xs text-content-muted">{r.cost.hours} h</span>
                    </span>
                  ),
                },
                ...(canEdit
                  ? [
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
                    ]
                  : []),
              ]}
            />
          )}
        </div>
      </Card>

      {data && (
        <ErrorModal
          open={creating || Boolean(editing)}
          error={editing}
          causes={data.causes || []}
          areas={data.areas || []}
          laborRate={data.laborHourRate || 0}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            toast({ variant: "success", title: "Error guardado" });
            load();
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar error"
        description="El registro se eliminará de los indicadores (borrado lógico, queda en bitácora)."
        confirmLabel="Eliminar"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await api.del(`/api/calidad/errores/${deleting.id}`);
          toast({ variant: "success", title: "Error eliminado" });
          load();
        }}
      />
    </div>
  );
}
