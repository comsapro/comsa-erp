"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/feedback/Alert";
import { salesInvoiceSchema } from "@/domains/sales/schemas";
import { toDateInputValue } from "@/lib/utils/format";

export default function SalesInvoiceFormClient({
  canViewTeam,
  currentUserId,
  currentUserName,
}) {
  const router = useRouter();
  const [sellers, setSellers] = useState([]);
  const [quoteQuery, setQuoteQuery] = useState("");
  const [quoteResults, setQuoteResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedQuotes, setSelectedQuotes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(salesInvoiceSchema),
    defaultValues: {
      invoiceNumber: "",
      netAmount: "",
      invoiceDate: toDateInputValue(new Date()),
      sellerId: currentUserId,
      clientPoNumber: "",
      receivedByClient: false,
      receptionDate: "",
      notes: "",
      quotes: [],
    },
  });

  const receivedByClient = watch("receivedByClient");

  useEffect(() => {
    if (!canViewTeam) return;
    api
      .get(`/api/vendedores${toQuery({ pageSize: 100, sort: "name", order: "asc" })}`)
      .then((res) => setSellers(res?.data || []))
      .catch(() => setSellers([]));
  }, [canViewTeam]);

  useEffect(() => {
    const payload = selectedQuotes
      .filter((q) => q.itemIds.length > 0)
      .map((q) => ({
        quoteId: q.id,
        quoteItemIds: q.itemIds,
      }));
    setValue("quotes", payload, { shouldValidate: true });
  }, [selectedQuotes, setValue]);

  async function searchQuotes() {
    setSearching(true);
    setError("");
    try {
      const res = await api.get(
        `/api/cotizaciones${toQuery({
          q: quoteQuery || undefined,
          pageSize: 20,
          sort: "createdAt",
          order: "desc",
          sellerId: canViewTeam ? undefined : currentUserId,
        })}`
      );
      setQuoteResults(res?.data || []);
    } catch (err) {
      setError(err.message || "No se pudieron buscar cotizaciones");
    } finally {
      setSearching(false);
    }
  }

  async function addQuote(quoteSummary) {
    if (selectedQuotes.some((q) => q.id === quoteSummary.id)) return;
    try {
      const detail = await api.get(`/api/cotizaciones/${quoteSummary.id}`);
      const items = (detail?.items || [])
        .filter((i) => i.status === "ACTIVE")
        .map((i) => ({
          id: i.id,
          position: i.position,
          description: i.description,
        }));
      setSelectedQuotes((prev) => [
        ...prev,
        {
          id: detail.id,
          folio: detail.folio,
          clientName: detail.client?.commercialName || "",
          items,
          itemIds: items.map((i) => i.id),
        },
      ]);
    } catch (err) {
      setError(err.message || "No se pudo cargar la cotización");
    }
  }

  function toggleItem(quoteId, itemId) {
    setSelectedQuotes((prev) =>
      prev.map((q) => {
        if (q.id !== quoteId) return q;
        const has = q.itemIds.includes(itemId);
        return {
          ...q,
          itemIds: has
            ? q.itemIds.filter((id) => id !== itemId)
            : [...q.itemIds, itemId],
        };
      })
    );
  }

  function removeQuote(quoteId) {
    setSelectedQuotes((prev) => prev.filter((q) => q.id !== quoteId));
  }

  const selectedCount = useMemo(
    () => selectedQuotes.reduce((acc, q) => acc + q.itemIds.length, 0),
    [selectedQuotes]
  );

  async function onSubmit(values) {
    setSaving(true);
    setError("");
    try {
      await api.post("/api/ventas/facturas", {
        ...values,
        sellerId: canViewTeam ? values.sellerId : currentUserId,
        receptionDate: values.receivedByClient ? values.receptionDate : null,
      });
      router.push("/ventas/facturas");
      router.refresh();
    } catch (err) {
      setError(err.message || "No se pudo registrar la factura");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar factura"
        description="Relaciona cotizaciones y partidas. El monto debe incluir IVA."
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-content">Datos de la factura</h2>
          </CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Número de factura" required error={errors.invoiceNumber?.message}>
              <Input {...register("invoiceNumber")} />
            </Field>
            <Field
              label="Monto neto (con IVA)"
              required
              error={errors.netAmount?.message}
            >
              <Input type="number" step="0.01" min="0" {...register("netAmount")} />
            </Field>
            <Field label="Fecha de facturación" required error={errors.invoiceDate?.message}>
              <Input type="date" {...register("invoiceDate")} />
            </Field>
            <Field label="Número de PO del cliente" required error={errors.clientPoNumber?.message}>
              <Input {...register("clientPoNumber")} />
            </Field>
            <Field label="Vendedor" required>
              {canViewTeam ? (
                <Select {...register("sellerId")}>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input value={currentUserName || "Usuario actual"} disabled />
              )}
            </Field>
            <Field label="¿Recepcionada por el cliente?" required>
              <Select
                {...register("receivedByClient", {
                  setValueAs: (v) => v === true || v === "true",
                })}
              >
                <option value="false">No</option>
                <option value="true">Sí</option>
              </Select>
            </Field>
            {Boolean(receivedByClient === true || receivedByClient === "true") && (
              <Field
                label="Fecha de recepción"
                required
                error={errors.receptionDate?.message}
              >
                <Input type="date" {...register("receptionDate")} />
              </Field>
            )}
            <Field className="md:col-span-2" label="Notas" error={errors.notes?.message}>
              <Textarea rows={2} {...register("notes")} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-content">
              Cotizaciones y partidas
            </h2>
            <p className="mt-1 text-sm text-content-muted">
              Seleccionadas: {selectedCount} partida(s)
              {errors.quotes?.message ? ` · ${errors.quotes.message}` : ""}
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-sm"
                value={quoteQuery}
                onChange={(e) => setQuoteQuery(e.target.value)}
                placeholder="Buscar folio o cliente..."
              />
              <Button type="button" variant="secondary" loading={searching} onClick={searchQuotes}>
                Buscar
              </Button>
            </div>

            {quoteResults.length > 0 && (
              <div className="overflow-x-auto rounded border border-border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted text-left">
                      <th className="px-3 py-2 font-medium">Folio</th>
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium">Estatus</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {quoteResults.map((q) => (
                      <tr key={q.id}>
                        <td className="px-3 py-2">{q.folio}</td>
                        <td className="px-3 py-2">{q.client?.commercialName}</td>
                        <td className="px-3 py-2">{q.status}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="subtle"
                            onClick={() => addQuote(q)}
                          >
                            Agregar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedQuotes.map((q) => (
              <div key={q.id} className="rounded border border-border p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-content">{q.folio}</p>
                    <p className="text-sm text-content-muted">{q.clientName}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeQuote(q.id)}
                  >
                    Quitar
                  </Button>
                </div>
                <div className="space-y-2">
                  {q.items.map((item) => (
                    <label key={item.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={q.itemIds.includes(item.id)}
                        onChange={() => toggleItem(q.id, item.id)}
                      />
                      <span>
                        Partida {item.position} — {item.description}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" loading={saving}>
            Guardar factura
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
