"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import {
  formatDateTime,
  formatMoney,
  formatMoneyInput,
  parseMoneyInput,
} from "@/lib/utils/format";
import {
  SALES_GOAL_PERIODS,
  SALES_GOAL_PERIOD_LABELS,
  periodKeyFor,
} from "@/domains/sales/constants";
import { salesGoalSchema } from "@/domains/sales/schemas";

const emptyDefaults = () => ({
  period: SALES_GOAL_PERIODS.MONTHLY,
  periodKey: periodKeyFor(SALES_GOAL_PERIODS.MONTHLY),
  amount: "",
  label: "",
  sellerIds: [],
  teamIds: [],
});

export default function SalesGoalsClient({ canManage = false }) {
  const [rows, setRows] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedSellers, setSelectedSellers] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [amountDisplay, setAmountDisplay] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(salesGoalSchema),
    defaultValues: emptyDefaults(),
  });

  const period = watch("period");

  useEffect(() => {
    if (!editingId) {
      setValue("periodKey", periodKeyFor(period));
    }
  }, [period, setValue, editingId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [goals, sellersRes, teamsRes] = await Promise.all([
        api.get("/api/ventas/metas"),
        canManage
          ? api.get(
              `/api/vendedores${toQuery({ pageSize: 100, sort: "name", order: "asc" })}`
            )
          : Promise.resolve({ data: [] }),
        canManage
          ? api
              .get(
                `/api/equipos${toQuery({
                  pageSize: 100,
                  status: "ACTIVE",
                  sort: "name",
                  order: "asc",
                })}`
              )
              .catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);
      setRows(goals?.data || []);
      setSellers(sellersRes?.data || []);
      setTeams(teamsRes?.data || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar las metas");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  function clearForm() {
    setEditingId(null);
    reset(emptyDefaults());
    setSelectedSellers([]);
    setSelectedTeams([]);
    setAmountDisplay("");
  }

  function toggleSeller(id) {
    setSelectedSellers((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setValue("sellerIds", next, { shouldValidate: true });
      return next;
    });
  }

  function toggleTeam(id) {
    setSelectedTeams((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setValue("teamIds", next, { shouldValidate: true });
      return next;
    });
  }

  function startEdit(goal) {
    setError("");
    setSuccess("");
    setEditingId(goal.id);
    const sellerIds = (goal.sellers || []).map((s) => s.sellerId).filter(Boolean);
    const teamIds = (goal.teams || []).map((t) => t.teamId).filter(Boolean);
    setSelectedSellers(sellerIds);
    setSelectedTeams(teamIds);
    setAmountDisplay(formatMoneyInput(goal.amount));
    reset({
      period: goal.period,
      periodKey: goal.periodKey,
      amount: Number(goal.amount),
      label: goal.label || "",
      sellerIds,
      teamIds,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(values) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const amount = parseMoneyInput(amountDisplay || values.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Indica un monto meta valido");
      }
      const payload = {
        ...values,
        amount,
        sellerIds: selectedSellers,
        teamIds: selectedTeams,
      };
      if (editingId) {
        await api.put(`/api/ventas/metas/${editingId}`, payload);
        setSuccess("Meta actualizada correctamente");
      } else {
        await api.post("/api/ventas/metas", payload);
        setSuccess("Meta creada correctamente");
      }
      clearForm();
      await load();
    } catch (err) {
      setError(err.message || "No se pudo guardar la meta");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas de ventas"
        description={
          canManage
            ? "Asigna la meta a uno o más equipos y/o vendedores individuales. Cada equipo puede tener su propia meta en el mismo periodo."
            : "Consulta la meta de tu equipo. Solo un supervisor puede cambiarla."
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {canManage && (
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-content">
            {editingId ? "Editar meta" : "Nueva meta"}
          </h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <Field label="Periodo" required error={errors.period?.message}>
              <Select {...register("period")}>
                {Object.entries(SALES_GOAL_PERIOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Clave de periodo" required error={errors.periodKey?.message}>
              <Input {...register("periodKey")} />
            </Field>
            <Field
              label="Monto meta (+ IVA)"
              required
              error={errors.amount?.message}
              hint="El monto incluye IVA. Ej: $850,000.50"
            >
              <Input
                inputMode="decimal"
                value={amountDisplay}
                placeholder="$850,000.00"
                onChange={(e) => {
                  const raw = e.target.value;
                  setAmountDisplay(raw);
                  const n = parseMoneyInput(raw);
                  setValue("amount", Number.isFinite(n) ? n : "", {
                    shouldValidate: true,
                  });
                }}
                onBlur={() => {
                  const n = parseMoneyInput(amountDisplay);
                  if (Number.isFinite(n) && n > 0) {
                    setAmountDisplay(formatMoneyInput(n));
                    setValue("amount", n, { shouldValidate: true });
                  }
                }}
              />
            </Field>
            <Field label="Etiqueta" error={errors.label?.message}>
              <Input {...register("label")} placeholder="Opcional" />
            </Field>
            <Field
              className="md:col-span-2"
              label="Equipos"
              error={errors.teamIds?.message}
              hint="La meta suma las facturas de todos los miembros activos del equipo."
            >
              {teams.length === 0 ? (
                <p className="text-sm text-content-muted">
                  No hay equipos activos. Puedes asignar vendedores individuales abajo.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {teams.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTeams.includes(t.id)}
                        onChange={() => toggleTeam(t.id)}
                      />
                      {t.name}
                      <span className="text-xs text-content-muted">
                        ({t._count?.members ?? 0})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </Field>
            <Field
              className="md:col-span-2"
              label="Vendedores adicionales"
              error={errors.sellerIds?.message}
              hint="Opcional si ya elegiste equipos. Útil para sumar personas sueltas."
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sellers.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSellers.includes(s.id)}
                      onChange={() => toggleSeller(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </Field>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" loading={saving}>
                {editingId ? "Actualizar meta" : "Guardar meta"}
              </Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={clearForm}>
                  Cancelar edicion
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-content">
            {canManage ? "Historial de metas" : "Meta de tu equipo"}
          </h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-content-muted">Aún no hay metas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-content-muted">
                    <th className="px-2 py-2 font-medium">Periodo</th>
                    <th className="px-2 py-2 font-medium">Monto (+ IVA)</th>
                    <th className="px-2 py-2 font-medium">Asignación</th>
                    <th className="px-2 py-2 font-medium">Creada</th>
                    <th className="px-2 py-2 font-medium">Modificada</th>
                    {canManage && <th className="px-2 py-2 font-medium">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((g) => {
                    const teamNames = (g.teams || [])
                      .map((t) => t.team?.name)
                      .filter(Boolean);
                    const sellerNames = (g.sellers || [])
                      .map((s) => s.seller?.name)
                      .filter(Boolean);
                    return (
                      <tr key={g.id}>
                        <td className="px-2 py-2">
                          {SALES_GOAL_PERIOD_LABELS[g.period]} · {g.periodKey}
                          {g.label ? ` · ${g.label}` : ""}
                        </td>
                        <td className="px-2 py-2">{formatMoney(g.amount)}</td>
                        <td className="px-2 py-2">
                          {teamNames.length > 0 && (
                            <div>Equipos: {teamNames.join(", ")}</div>
                          )}
                          {sellerNames.length > 0 && (
                            <div className="text-content-muted">
                              Vendedores: {sellerNames.join(", ")}
                            </div>
                          )}
                          {!teamNames.length && !sellerNames.length && "-"}
                        </td>
                        <td className="px-2 py-2">
                          {formatDateTime(g.createdAt)}
                          <div className="text-xs text-content-muted">
                            {g.createdByUser?.name}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          {formatDateTime(g.updatedAt)}
                          <div className="text-xs text-content-muted">
                            {g.updatedByUser?.name}
                          </div>
                        </td>
                        {canManage && (
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="subtle"
                            onClick={() => startEdit(g)}
                          >
                            Editar
                          </Button>
                        </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
