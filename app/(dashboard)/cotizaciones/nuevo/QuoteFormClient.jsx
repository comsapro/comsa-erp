"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  quoteCreateSchema,
} from "@/domains/quotes/schemas";
import {
  ORDER_TYPES,
  ORDER_TYPE_LABELS,
  CURRENCIES,
  CURRENCY_LABELS,
} from "@/domains/quotes/constants";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  TextField,
  TextareaField,
  SelectField,
  CheckboxField,
} from "@/components/forms/fields";
import {
  ClientCatalogSelect,
  ContactCatalogSelect,
  IssuingCompanyCatalogSelect,
  SellerCatalogSelect,
} from "@/components/forms/catalog-selects";
import { usePermissions } from "@/components/permissions/PermissionsProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { toDateInputValue } from "@/lib/utils/format";

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function clampPct(raw) {
  const n = Number(raw);
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

export default function QuoteFormClient({ currentUser }) {
  const router = useRouter();
  const { has } = usePermissions();
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = toDateInputValue(new Date());
  const defaultValid = toDateInputValue(addDays(new Date(), 30));

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(quoteCreateSchema),
    defaultValues: {
      clientId: "",
      clientContactId: "",
      sellerId: currentUser?.id || "",
      issuingCompanyId: "",
      orderType: "GENERAL",
      currency: "MXN",
      elaborationDate: today,
      requestDate: "",
      validUntil: defaultValid,
      requisition: "",
      internalObservations: "",
      clientDesignProvided: false,
      advancePercentage: 0,
      settlementPercentage: 100,
      paymentNotes: "",
    },
  });

  const clientId = useWatch({ control, name: "clientId" });
  const clientContactId = useWatch({ control, name: "clientContactId" });
  const issuingCompanyId = useWatch({ control, name: "issuingCompanyId" });
  const sellerId = useWatch({ control, name: "sellerId" });

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoadingOptions(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    const load = async () => {
      try {
        const [clientsRes, companiesRes] = await Promise.all([
          api.get(`/api/clientes${toQuery({ status: "ACTIVE", pageSize: 50, sort: "commercialName", order: "asc" })}`),
          api.get(
            `/api/empresas-emisoras${toQuery({ status: "ACTIVE", pageSize: 100 })}`
          ),
        ]);
        if (cancelled) return;
        setClients(clientsRes?.data || []);
        setCompanies(companiesRes?.data || []);

        if (has("quotes.create") || has("quotes.edit") || has("users.view")) {
          const usersRes = await api.get(
            `/api/vendedores${toQuery({ pageSize: 100, sort: "name", order: "asc" })}`
          );
          if (cancelled) return;
          setSellers(usersRes?.data || []);
        } else if (currentUser) {
          setSellers([currentUser]);
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            variant: "error",
            title: "No se pudieron cargar opciones",
            description: error.message,
          });
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, has, toast]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!clientId) {
      setContacts([]);
      setValue("clientContactId", "");
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    let cancelled = false;
    api
      .get(`/api/clientes/${clientId}`)
      .then((detail) => {
        if (cancelled) return;
        setContacts(detail?.contacts || []);
        const primary = (detail?.contacts || []).find((c) => c.isPrimary);
        setValue("clientContactId", primary?.id || "");
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        clientContactId: values.clientContactId || null,
        sellerId: values.sellerId || currentUser?.id || null,
        requestDate: values.requestDate || null,
        purchaseOrder: null,
        requisition: values.requisition || null,
        internalObservations: values.internalObservations || null,
        paymentNotes: values.paymentNotes || null,
      };
      const created = await api.post("/api/cotizaciones", payload);
      toast({ variant: "success", title: "Cotizacion creada" });
      router.push(`/cotizaciones/${created.id}`);
    } catch (error) {
      if (error.status === 422 && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field, { message: messages[0] });
        }
      } else {
        toast({
          variant: "error",
          title: "No se pudo crear",
          description: error.message,
        });
      }
    } finally {
      setSaving(false);
    }
  });

  return (
    <div>
      <PageHeader
        title="Nueva cotizacion"
        description="Captura la informacion general. Los items se agregan despues."
        actions={
          <Button as={Link} href="/cotizaciones" variant="secondary">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        }
      />

      <Card>
        <CardBody>
          {loadingOptions ? (
            <p className="text-sm text-content-muted">Cargando catalogos...</p>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <ClientCatalogSelect
                  value={clientId || ""}
                  onChange={(id) => setValue("clientId", id, { shouldValidate: true })}
                  options={clients}
                  onOptionsChange={setClients}
                  error={errors.clientId?.message}
                  required
                  remoteSearch
                />
                <ContactCatalogSelect
                  value={clientContactId || ""}
                  onChange={(id) => setValue("clientContactId", id)}
                  options={contacts}
                  onOptionsChange={setContacts}
                  clientId={clientId}
                  error={errors.clientContactId?.message}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <IssuingCompanyCatalogSelect
                  value={issuingCompanyId || ""}
                  onChange={(id) =>
                    setValue("issuingCompanyId", id, { shouldValidate: true })
                  }
                  options={companies}
                  onOptionsChange={setCompanies}
                  error={errors.issuingCompanyId?.message}
                  required
                />
                <SellerCatalogSelect
                  value={sellerId || ""}
                  onChange={(id) => setValue("sellerId", id)}
                  options={sellers}
                  error={errors.sellerId?.message}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Tipo de orden"
                  name="orderType"
                  register={register}
                  error={errors.orderType?.message}
                >
                  {ORDER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ORDER_TYPE_LABELS[t]}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Moneda"
                  name="currency"
                  register={register}
                  error={errors.currency?.message}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCY_LABELS[c]}
                    </option>
                  ))}
                </SelectField>
                <CheckboxField
                  label="Cliente proporciono diseno"
                  name="clientDesignProvided"
                  register={register}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="Fecha de elaboracion"
                  name="elaborationDate"
                  type="date"
                  register={register}
                  error={errors.elaborationDate?.message}
                  required
                />
                <TextField
                  label="Fecha de solicitud"
                  name="requestDate"
                  type="date"
                  register={register}
                  error={errors.requestDate?.message}
                />
                <TextField
                  label="Vigencia"
                  name="validUntil"
                  type="date"
                  register={register}
                  error={errors.validUntil?.message}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Requisicion"
                  name="requisition"
                  register={register}
                  error={errors.requisition?.message}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="% Anticipo"
                  name="advancePercentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  register={register}
                  error={errors.advancePercentage?.message}
                  onChange={(e) => {
                    const advance = clampPct(e.target.value);
                    setValue("advancePercentage", advance, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                    setValue("settlementPercentage", clampPct(100 - advance), {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                />
                <TextField
                  label="% Liquidacion"
                  name="settlementPercentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  register={register}
                  error={errors.settlementPercentage?.message}
                  onChange={(e) => {
                    const settlement = clampPct(e.target.value);
                    setValue("settlementPercentage", settlement, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                    setValue("advancePercentage", clampPct(100 - settlement), {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                />
              </div>

              <TextareaField
                label="Notas de pago"
                name="paymentNotes"
                register={register}
                error={errors.paymentNotes?.message}
              />
              <TextareaField
                label="Observaciones internas"
                name="internalObservations"
                register={register}
                error={errors.internalObservations?.message}
              />

              <div className="mt-2 flex justify-end gap-2">
                <Button as={Link} href="/cotizaciones" variant="secondary">
                  Cancelar
                </Button>
                <Button type="submit" loading={saving}>
                  Crear cotizacion
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
