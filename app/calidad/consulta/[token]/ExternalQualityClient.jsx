"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

export default function ExternalQualityClient({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/calidad/consulta/${token}`)
      .then(setData)
      .catch((err) => setError(err.message || "No disponible"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-sm text-content-muted">
        Cargando consulta...
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-lg font-semibold">Consulta no disponible</h1>
        <p className="mt-2 text-sm text-content-muted">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold text-content">Consulta de Calidad</h1>
      <p className="text-sm text-content-muted">
        Vista de solo lectura. Sin costos, horas ni datos internos.
      </p>
      <dl className="grid gap-2 rounded border border-border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-content-muted">Proyecto / OP</dt>
          <dd className="font-medium">{data.project || "—"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Cliente</dt>
          <dd className="font-medium">{data.clientName || "—"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Partida</dt>
          <dd className="font-medium">{data.position ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Pieza</dt>
          <dd className="font-medium">{data.pieceLabel || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-content-muted">Descripcion</dt>
          <dd className="font-medium">{data.description || "—"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Resultado</dt>
          <dd className="font-medium">{data.result || "—"}</dd>
        </div>
      </dl>

      {(data.inspections || []).map((ins, idx) => (
        <section key={idx} className="rounded border border-border p-4">
          <h2 className="text-sm font-semibold">
            Inspeccion {idx + 1} · {ins.result} · {ins.closedAt || ""}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(ins.measurements || []).map((m, i) => (
              <li key={i}>
                {m.label}: {m.measuredValue || "—"} {m.unit || ""} (nom.{" "}
                {m.nominal || "—"} +{m.tolerancePlus || "0"}/-
                {m.toleranceMinus || "0"}) · {m.result}
              </li>
            ))}
          </ul>
          {(ins.evidences || []).length > 0 && (
            <ul className="mt-2 text-sm text-brand-700">
              {ins.evidences.map((e, i) => (
                <li key={i}>
                  <a
                    href={`/api/blob?pathname=${encodeURIComponent(e.pathname)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {e.fileName}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}
