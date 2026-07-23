"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Can } from "@/components/permissions/Can";
import { toQuery } from "@/lib/api/client";

const REPORTS = [
  {
    key: "quotations",
    title: "Reporte de cotizaciones",
    permission: "reports.quotations_pdf",
    endpoint: "/api/reportes/cotizaciones",
    fields: ["dateFrom", "dateTo", "status", "currency"],
  },
  {
    key: "production",
    title: "Reporte de produccion",
    permission: "reports.production_pdf",
    endpoint: "/api/reportes/produccion",
    fields: ["dateFrom", "dateTo", "status", "sourceType"],
  },
  {
    key: "inventory",
    title: "Reporte de movimientos",
    permission: "reports.inventory_pdf",
    endpoint: "/api/reportes/inventario",
    fields: ["dateFrom", "dateTo", "movementType", "referenceType"],
  },
  {
    key: "purchases",
    title: "Reporte de ordenes de compra",
    permission: "reports.purchases_pdf",
    endpoint: "/api/reportes/compras",
    fields: ["dateFrom", "dateTo", "status"],
  },
];

export default function ReportsClient() {
  const [filters, setFilters] = useState({});

  function setField(reportKey, field, value) {
    setFilters((prev) => ({
      ...prev,
      [reportKey]: { ...(prev[reportKey] || {}), [field]: value },
    }));
  }

  function openReport(report) {
    const q = filters[report.key] || {};
    const url = `${report.endpoint}${toQuery(q)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reportes PDF"
        description="Genera reportes operativos con los filtros activos."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {REPORTS.map((report) => (
          <Can key={report.key} permission={report.permission}>
            <Card className="space-y-3 p-5">
              <h2 className="text-base font-semibold">{report.title}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {report.fields.includes("dateFrom") && (
                  <label className="text-sm">
                    <span className="text-content-muted">Desde</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-md border border-border px-2 py-1.5"
                      onChange={(e) =>
                        setField(report.key, "dateFrom", e.target.value)
                      }
                    />
                  </label>
                )}
                {report.fields.includes("dateTo") && (
                  <label className="text-sm">
                    <span className="text-content-muted">Hasta</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-md border border-border px-2 py-1.5"
                      onChange={(e) =>
                        setField(report.key, "dateTo", e.target.value)
                      }
                    />
                  </label>
                )}
                {report.fields.includes("status") && (
                  <label className="text-sm sm:col-span-2">
                    <span className="text-content-muted">Estatus</span>
                    <input
                      className="mt-1 w-full rounded-md border border-border px-2 py-1.5"
                      placeholder="Ej. APPROVED"
                      onChange={(e) =>
                        setField(report.key, "status", e.target.value)
                      }
                    />
                  </label>
                )}
                {report.fields.includes("currency") && (
                  <label className="text-sm">
                    <span className="text-content-muted">Moneda</span>
                    <select
                      className="mt-1 w-full rounded-md border border-border px-2 py-1.5"
                      onChange={(e) =>
                        setField(report.key, "currency", e.target.value)
                      }
                    >
                      <option value="">Todas</option>
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                )}
                {report.fields.includes("sourceType") && (
                  <label className="text-sm">
                    <span className="text-content-muted">Origen</span>
                    <select
                      className="mt-1 w-full rounded-md border border-border px-2 py-1.5"
                      onChange={(e) =>
                        setField(report.key, "sourceType", e.target.value)
                      }
                    >
                      <option value="">Todos</option>
                      <option value="QUOTE">Cotizacion</option>
                      <option value="DIRECT_ORDER">Orden directa</option>
                    </select>
                  </label>
                )}
                {report.fields.includes("movementType") && (
                  <label className="text-sm">
                    <span className="text-content-muted">Tipo movimiento</span>
                    <input
                      className="mt-1 w-full rounded-md border border-border px-2 py-1.5"
                      placeholder="ENTRY / EXIT..."
                      onChange={(e) =>
                        setField(report.key, "movementType", e.target.value)
                      }
                    />
                  </label>
                )}
                {report.fields.includes("referenceType") && (
                  <label className="text-sm">
                    <span className="text-content-muted">Tipo referencia</span>
                    <input
                      className="mt-1 w-full rounded-md border border-border px-2 py-1.5"
                      onChange={(e) =>
                        setField(report.key, "referenceType", e.target.value)
                      }
                    />
                  </label>
                )}
              </div>
              <Button onClick={() => openReport(report)}>Descargar PDF</Button>
            </Card>
          </Can>
        ))}
      </div>
    </div>
  );
}
