"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/feedback/Alert";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/feedback/ToastProvider";
import { INSTRUMENT_STATUS_LABELS } from "@/domains/quality/constants";
import { formatDate } from "@/lib/utils/format";

export default function InstrumentsClient() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    type: "Calibrador",
    brand: "",
    model: "",
    serialNumber: "",
    unit: "mm",
    calibrationPeriodDays: 365,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/calidad/instrumentos");
      setRows(res?.data || []);
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

  async function addCalibration(id) {
    setSaving(true);
    try {
      const calibratedAt = new Date().toISOString().slice(0, 10);
      const next = new Date();
      next.setFullYear(next.getFullYear() + 1);
      await api.post(`/api/calidad/instrumentos/${id}`, {
        calibratedAt,
        nextDueAt: next.toISOString().slice(0, 10),
        provider: "Laboratorio externo",
      });
      toast({ variant: "success", title: "Calibracion registrada" });
      await load();
    } catch (err) {
      toast({ variant: "error", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instrumentos de medicion"
        description="Catalogo y control de calibraciones."
      />
      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <CardBody>
          <form onSubmit={createInstrument} className="grid gap-3 sm:grid-cols-3">
            <Input
              required
              placeholder="Codigo"
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
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-content-muted">
                  <th className="px-2 py-2">Codigo</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2">Serie</th>
                  <th className="px-2 py-2">Ultima cal.</th>
                  <th className="px-2 py-2">Proxima</th>
                  <th className="px-2 py-2">Estado</th>
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
                    <td className="px-2 py-2 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={saving}
                        onClick={() => addCalibration(r.id)}
                      >
                        Registrar calibracion
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
