"use client";

import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/forms/Field";
import {
  ClientCatalogSelect,
  ContactCatalogSelect,
  SellerCatalogSelect,
} from "@/components/forms/catalog-selects";
import { useToast } from "@/components/feedback/ToastProvider";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { toDateInputValue, formatDate } from "@/lib/utils/format";

function clampPct(raw) {
  const n = Number(raw);
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

function ReadOnlyHeader({ quote }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-content">
        Informacion general
      </h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-content-muted">Cliente</dt>
          <dd className="font-medium">{quote.client?.commercialName || "-"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Contacto</dt>
          <dd>{quote.clientContact?.name || "-"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Empresa emisora</dt>
          <dd>{quote.issuingCompany?.commercialName || "-"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Vendedor</dt>
          <dd>{quote.seller?.name || "-"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Fecha de emision</dt>
          <dd>{formatDate(quote.elaborationDate)}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Vigencia</dt>
          <dd>{formatDate(quote.validUntil)}</dd>
        </div>
        <div>
          <dt className="text-content-muted">% Anticipo</dt>
          <dd>{Number(quote.advancePercentage) || 0}%</dd>
        </div>
        <div>
          <dt className="text-content-muted">% Liquidacion</dt>
          <dd>{Number(quote.settlementPercentage) || 0}%</dd>
        </div>
        <div>
          <dt className="text-content-muted">Moneda</dt>
          <dd>{quote.currency}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Version</dt>
          <dd>{quote.version || "A"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Orden de compra</dt>
          <dd>{quote.purchaseOrder || "-"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Requisicion</dt>
          <dd>{quote.requisition || "-"}</dd>
        </div>
        {quote.paymentNotes && (
          <div className="sm:col-span-2">
            <dt className="text-content-muted">Notas de pago</dt>
            <dd className="whitespace-pre-wrap">{quote.paymentNotes}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function QuoteHeaderEdit({ quote, onSaved }) {
  const { has } = usePermissions();
  const { toast } = useToast();
  const canEdit = quote?.status === "DRAFT" && has("quotes.edit");

  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState(quote.client ? [quote.client] : []);
  const [contacts, setContacts] = useState(
    quote.clientContact ? [quote.clientContact] : []
  );
  const [sellers, setSellers] = useState(quote.seller ? [quote.seller] : []);
  const [form, setForm] = useState({
    clientId: quote.clientId || "",
    clientContactId: quote.clientContactId || "",
    sellerId: quote.sellerId || "",
    elaborationDate: toDateInputValue(quote.elaborationDate),
    validUntil: toDateInputValue(quote.validUntil),
    advancePercentage: Number(quote.advancePercentage) || 0,
    settlementPercentage: Number(quote.settlementPercentage) || 100,
  });

  // Re-sincronizar cuando cambia la cotizacion cargada
  useEffect(() => {
    setForm({
      clientId: quote.clientId || "",
      clientContactId: quote.clientContactId || "",
      sellerId: quote.sellerId || "",
      elaborationDate: toDateInputValue(quote.elaborationDate),
      validUntil: toDateInputValue(quote.validUntil),
      advancePercentage: Number(quote.advancePercentage) || 0,
      settlementPercentage: Number(quote.settlementPercentage) || 100,
    });
    if (quote.client) setClients([quote.client]);
    if (quote.clientContact) setContacts([quote.clientContact]);
    if (quote.seller) setSellers([quote.seller]);
  }, [quote]);

  const loadContacts = useCallback(async (clientId) => {
    if (!clientId) {
      setContacts([]);
      return;
    }
    try {
      const detail = await api.get(`/api/clientes/${clientId}`);
      setContacts(detail?.contacts || []);
    } catch {
      setContacts([]);
    }
  }, []);

  useEffect(() => {
    if (!canEdit) return;
    loadContacts(form.clientId);
  }, [canEdit, form.clientId, loadContacts]);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    api
      .get(
        `/api/vendedores${toQuery({
          pageSize: 100,
          sort: "name",
          order: "asc",
        })}`
      )
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || [];
        setSellers((prev) => {
          const current = quote.seller;
          if (current && !data.some((u) => u.id === current.id)) {
            return [current, ...data];
          }
          return data.length ? data : prev;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canEdit, quote.seller]);

  const save = async () => {
    if (!form.clientId) {
      toast({
        variant: "error",
        title: "Cliente requerido",
        description: "Selecciona un cliente",
      });
      return;
    }
    if (!form.sellerId) {
      toast({
        variant: "error",
        title: "Vendedor requerido",
        description: "Selecciona un vendedor",
      });
      return;
    }
    if (!form.elaborationDate) {
      toast({
        variant: "error",
        title: "Fecha de emision requerida",
        description: "Indica la fecha de emision",
      });
      return;
    }
    if (!form.validUntil) {
      toast({
        variant: "error",
        title: "Vigencia requerida",
        description: "Indica la fecha de vigencia",
      });
      return;
    }

    setSaving(true);
    try {
      const updated = await api.put(`/api/cotizaciones/${quote.id}`, {
        clientId: form.clientId,
        clientContactId: form.clientContactId || null,
        sellerId: form.sellerId,
        elaborationDate: form.elaborationDate,
        validUntil: form.validUntil,
        advancePercentage: form.advancePercentage,
        settlementPercentage: form.settlementPercentage,
      });
      toast({ variant: "success", title: "Informacion actualizada" });
      onSaved?.(updated);
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo guardar",
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return <ReadOnlyHeader quote={quote} />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-content">
            Informacion general
          </h2>
          <p className="text-xs text-content-muted">
            Editable mientras la cotizacion este en borrador
          </p>
        </div>
        <Button type="button" size="sm" loading={saving} onClick={save}>
          <Save className="h-3.5 w-3.5" /> Guardar cambios
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ClientCatalogSelect
          value={form.clientId}
          onChange={(id) =>
            setForm((f) => ({
              ...f,
              clientId: id,
              clientContactId: "",
            }))
          }
          options={clients}
          onOptionsChange={setClients}
          required
          remoteSearch
        />
        <ContactCatalogSelect
          value={form.clientContactId}
          onChange={(id) => setForm((f) => ({ ...f, clientContactId: id }))}
          options={contacts}
          onOptionsChange={setContacts}
          clientId={form.clientId}
        />
        <SellerCatalogSelect
          value={form.sellerId}
          onChange={(id) => setForm((f) => ({ ...f, sellerId: id }))}
          options={sellers}
          required
        />
        <Field label="Fecha de emision" htmlFor="quote-elaborationDate" required>
          <Input
            id="quote-elaborationDate"
            type="date"
            value={form.elaborationDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, elaborationDate: e.target.value }))
            }
          />
        </Field>
        <Field label="Vigencia" htmlFor="quote-validUntil" required>
          <Input
            id="quote-validUntil"
            type="date"
            value={form.validUntil}
            onChange={(e) =>
              setForm((f) => ({ ...f, validUntil: e.target.value }))
            }
          />
        </Field>
        <Field label="% Anticipo" htmlFor="quote-advance">
          <Input
            id="quote-advance"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.advancePercentage}
            onChange={(e) => {
              const advance = clampPct(e.target.value);
              setForm((f) => ({
                ...f,
                advancePercentage: advance,
                settlementPercentage: clampPct(100 - advance),
              }));
            }}
          />
        </Field>
        <Field label="% Liquidacion" htmlFor="quote-settlement">
          <Input
            id="quote-settlement"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.settlementPercentage}
            onChange={(e) => {
              const settlement = clampPct(e.target.value);
              setForm((f) => ({
                ...f,
                settlementPercentage: settlement,
                advancePercentage: clampPct(100 - settlement),
              }));
            }}
          />
        </Field>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-content-muted">Empresa emisora</dt>
          <dd>{quote.issuingCompany?.commercialName || "-"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Moneda</dt>
          <dd>{quote.currency}</dd>
        </div>
        <div>
          <dt className="text-content-muted">Version</dt>
          <dd>{quote.version || "A"}</dd>
        </div>
      </dl>
    </div>
  );
}

export default QuoteHeaderEdit;
