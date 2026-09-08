"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { MonthCalendar } from "@/components/views/MonthCalendar";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/forms/Field";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/feedback/Alert";
import { Badge } from "@/components/ui/Badge";
import { formatDate, toDateInputValue } from "@/lib/utils/format";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_TONES,
} from "@/domains/production/constants";

export default function SalesCalendarClient({ canEditCommitment }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [commitmentDate, setCommitmentDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const res = await api.get(
        `/api/ventas/compromisos${toQuery({
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
        })}`
      );
      setRows(res?.data || []);
    } catch (err) {
      setError(err.message || "No se pudo cargar el calendario");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
  }, [load]);

  function openEdit(row) {
    setEditing(row);
    setCommitmentDate(toDateInputValue(row.commitmentDate));
    setReason("");
  }

  async function saveCommitment(e) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await api.patch(`/api/ventas/compromisos/${editing.id}`, {
        commitmentDate,
        reason: reason || null,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la fecha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario de compromisos"
        description="Fechas compromiso de partidas en producción de tus proyectos. No es el Gantt de planta."
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <MonthCalendar
        rows={rows}
        loading={loading}
        error={null}
        getDate={(r) => r.commitmentDate}
        getHref={(r) => `/produccion/${r.productionOrderId}`}
        getTitle={(r) => `${r.productionFolio} · ${r.client}`}
        getSubtitle={(r) => `P${r.position}: ${r.description}`}
        emptyTitle="Sin compromisos"
        emptyDescription="Las fechas aparecen al enviar cotizaciones a producción."
      />

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-content">Listado</h2>
        </CardHeader>
        <CardBody>
          {rows.length === 0 ? (
            <p className="text-sm text-content-muted">No hay compromisos en el rango.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-content-muted">
                    <th className="px-2 py-2 font-medium">Fecha</th>
                    <th className="px-2 py-2 font-medium">Cliente</th>
                    <th className="px-2 py-2 font-medium">Cotización</th>
                    <th className="px-2 py-2 font-medium">Producción</th>
                    <th className="px-2 py-2 font-medium">Partida</th>
                    <th className="px-2 py-2 font-medium">Estado</th>
                    <th className="px-2 py-2 font-medium">Avance</th>
                    {canEditCommitment && (
                      <th className="px-2 py-2 font-medium" />
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatDate(r.commitmentDate)}
                      </td>
                      <td className="px-2 py-2">{r.client}</td>
                      <td className="px-2 py-2">
                        {r.quoteId ? (
                          <Link
                            href={`/cotizaciones/${r.quoteId}`}
                            className="text-brand-700 hover:underline"
                          >
                            {r.quoteFolio}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/produccion/${r.productionOrderId}`}
                          className="text-brand-700 hover:underline"
                        >
                          {r.productionFolio}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        #{r.position} {r.description}
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone={PRODUCTION_STATUS_TONES[r.productionStatus] || "neutral"}>
                          {PRODUCTION_STATUS_LABELS[r.productionStatus] ||
                            r.productionStatus}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">{r.progressPercentage}%</td>
                      {canEditCommitment && (
                        <td className="px-2 py-2 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEdit(r)}
                          >
                            Editar fecha
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Editar fecha compromiso"
        description={
          editing
            ? `${editing.productionFolio} · partida #${editing.position}`
            : undefined
        }
      >
        <form onSubmit={saveCommitment} className="space-y-4">
          <Field label="Fecha compromiso" required>
            <Input
              type="date"
              value={commitmentDate}
              onChange={(e) => setCommitmentDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Motivo">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Opcional"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
