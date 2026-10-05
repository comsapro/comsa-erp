"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { upload } from "@vercel/blob/client";
import { ChevronDown, ChevronRight, FileText, X } from "lucide-react";
import { api, toQuery } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/forms/Field";
import { Alert } from "@/components/feedback/Alert";
import { QuoteStatusBadge } from "@/components/ui/Badge";
import { salesInvoiceSchema } from "@/domains/sales/schemas";
import { formatDate, formatMoney, toDateInputValue } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const MAX_FILE_MB = 25;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

function sanitizeFileName(name) {
  return String(name || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function QuoteResultAccordion({
  quotes,
  expandedId,
  onToggle,
  detailsById,
  onSelect,
}) {
  if (!quotes.length) return null;

  return (
    <ul className="divide-y divide-border overflow-hidden rounded border border-border">
      {quotes.map((q) => {
        const open = expandedId === q.id;
        const detail = detailsById[q.id];
        const Chevron = open ? ChevronDown : ChevronRight;
        return (
          <li key={q.id} className="bg-white">
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left hover:bg-surface-muted/60"
                onClick={() => onToggle(q.id)}
                aria-expanded={open}
              >
                <Chevron className="mt-0.5 h-4 w-4 shrink-0 text-content-muted" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-content">{q.folio}</span>
                    <QuoteStatusBadge status={q.status} />
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-content-muted">
                    {q.client?.commercialName || "Sin cliente"}
                    {q.seller?.name ? ` · ${q.seller.name}` : ""}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-content-muted">
                    <span>Emisión: {formatDate(q.elaborationDate) || "—"}</span>
                    <span>Vigencia: {formatDate(q.validUntil) || "—"}</span>
                    <span>
                      Total: {formatMoney(q.total, q.currency || "MXN")}
                    </span>
                  </span>
                </span>
              </button>
              <div className="flex items-center pr-3">
                <Button
                  type="button"
                  size="sm"
                  variant="subtle"
                  onClick={() => onSelect(q)}
                >
                  Seleccionar
                </Button>
              </div>
            </div>

            <div
              className={cn(
                "border-t border-border bg-surface-muted/40 px-3 py-3",
                !open && "hidden"
              )}
            >
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-content-muted">Creada</dt>
                  <dd>{formatDate(q.createdAt) || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-content-muted">Aprobada</dt>
                  <dd>{formatDate(q.approvedAt) || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-content-muted">PO cliente</dt>
                  <dd>{q.purchaseOrder || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-content-muted">Requisición</dt>
                  <dd>{q.requisition || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-content-muted">Moneda</dt>
                  <dd>{q.currency || "MXN"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-content-muted">Versión</dt>
                  <dd>{q.version || "—"}</dd>
                </div>
              </dl>

              <div className="mt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-content-muted">
                  Productos / partidas
                </p>
                {detail?.loading && (
                  <p className="text-sm text-content-muted">Cargando partidas...</p>
                )}
                {detail?.error && (
                  <p className="text-sm text-danger-700">{detail.error}</p>
                )}
                {!detail?.loading && !detail?.error && (
                  <ul className="space-y-1.5">
                    {(detail?.items || []).length === 0 ? (
                      <li className="text-sm text-content-muted">
                        Sin partidas activas.
                      </li>
                    ) : (
                      detail.items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded border border-border bg-white px-2.5 py-1.5 text-sm"
                        >
                          <span className="font-medium">
                            Partida {item.position}
                          </span>
                          <span className="text-content-muted">
                            {" "}
                            · {item.quantity} {item.unit || "pza"}
                          </span>
                          <span className="mt-0.5 block text-content">
                            {item.description}
                          </span>
                          {item.total != null && (
                            <span className="mt-0.5 block text-xs text-content-muted">
                              {formatMoney(item.total, q.currency || "MXN")}
                            </span>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function SalesInvoiceFormClient({
  canViewTeam,
  isAdmin = false,
  currentUserId,
  currentUserName,
}) {
  const router = useRouter();
  const pdfInputRef = useRef(null);
  const xmlInputRef = useRef(null);
  const [sellers, setSellers] = useState([]);
  const [quoteQuery, setQuoteQuery] = useState("");
  const [quoteResults, setQuoteResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [expandedQuoteId, setExpandedQuoteId] = useState(null);
  const [quoteDetailsById, setQuoteDetailsById] = useState({});
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [itemIds, setItemIds] = useState([]);
  const [skipQuoteLink, setSkipQuoteLink] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [xmlFile, setXmlFile] = useState(null);
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
      receptionDate: null,
      notes: "",
      quotes: [],
    },
  });

  const receivedByClient = watch("receivedByClient");

  useEffect(() => {
    if (!(receivedByClient === true || receivedByClient === "true")) {
      setValue("receptionDate", null, { shouldValidate: true });
    }
  }, [receivedByClient, setValue]);

  useEffect(() => {
    if (!canViewTeam) return;
    api
      .get(`/api/vendedores${toQuery({ pageSize: 100, sort: "name", order: "asc" })}`)
      .then((res) => setSellers(res?.data || []))
      .catch(() => setSellers([]));
  }, [canViewTeam]);

  useEffect(() => {
    if (skipQuoteLink) {
      setValue("quotes", [], { shouldValidate: true });
      return;
    }
    if (!selectedQuote || itemIds.length === 0) {
      setValue("quotes", [], { shouldValidate: true });
      return;
    }
    setValue(
      "quotes",
      [{ quoteId: selectedQuote.id, quoteItemIds: itemIds }],
      { shouldValidate: true }
    );
  }, [selectedQuote, itemIds, skipQuoteLink, setValue]);

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
          forLink: "1",
        })}`
      );
      setQuoteResults(res?.data || []);
      setExpandedQuoteId(null);
      setQuoteDetailsById({});
    } catch (err) {
      setError(err.message || "No se pudieron buscar cotizaciones");
    } finally {
      setSearching(false);
    }
  }

  const loadQuotePreview = useCallback(async (quoteId) => {
    setQuoteDetailsById((prev) => ({
      ...prev,
      [quoteId]: { ...(prev[quoteId] || {}), loading: true, error: null },
    }));
    try {
      const detail = await api.get(`/api/cotizaciones/${quoteId}`);
      const items = (detail?.items || [])
        .filter((i) => i.status === "ACTIVE")
        .map((i) => ({
          id: i.id,
          position: i.position,
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          total: i.total,
        }));
      setQuoteDetailsById((prev) => ({
        ...prev,
        [quoteId]: { loading: false, error: null, items },
      }));
    } catch (err) {
      setQuoteDetailsById((prev) => ({
        ...prev,
        [quoteId]: {
          loading: false,
          error: err.message || "No se pudieron cargar las partidas",
          items: [],
        },
      }));
    }
  }, []);

  function toggleQuotePreview(quoteId) {
    const closing = expandedQuoteId === quoteId;
    setExpandedQuoteId(closing ? null : quoteId);
    if (!closing && !quoteDetailsById[quoteId]) {
      loadQuotePreview(quoteId);
    }
  }

  async function selectQuote(quoteSummary) {
    setError("");
    try {
      const detail = await api.get(`/api/cotizaciones/${quoteSummary.id}`);
      const items = (detail?.items || [])
        .filter((i) => i.status === "ACTIVE")
        .map((i) => ({
          id: i.id,
          position: i.position,
          description: i.description,
        }));
      setSelectedQuote({
        id: detail.id,
        folio: detail.folio,
        clientName: detail.client?.commercialName || "",
        items,
      });
      setItemIds(items.map((i) => i.id));
      setQuoteResults([]);
      setQuoteQuery("");
    } catch (err) {
      setError(err.message || "No se pudo cargar la cotización");
    }
  }

  function toggleItem(itemId) {
    setItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  }

  function clearQuote() {
    setSelectedQuote(null);
    setItemIds([]);
  }

  function pickFile(kind, file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(`El archivo supera ${MAX_FILE_MB} MB`);
      return;
    }
    const name = file.name.toLowerCase();
    if (kind === "PDF" && !name.endsWith(".pdf")) {
      setError("El archivo PDF debe tener extensión .pdf");
      return;
    }
    if (kind === "XML" && !name.endsWith(".xml")) {
      setError("El archivo XML debe tener extensión .xml");
      return;
    }
    setError("");
    if (kind === "PDF") setPdfFile(file);
    else setXmlFile(file);
  }

  async function uploadInvoiceFile(invoiceId, kind, file) {
    const safeName = sanitizeFileName(file.name);
    const pathname = `sales-invoices/${invoiceId}/${kind.toLowerCase()}-${Date.now()}-${safeName}`;
    const blob = await upload(pathname, file, {
      access: "private",
      handleUploadUrl: `/api/ventas/facturas/${invoiceId}/adjuntos/upload`,
      clientPayload: JSON.stringify({ kind }),
      multipart: file.size > 5 * 1024 * 1024,
    });
    await api.post(`/api/ventas/facturas/${invoiceId}/adjuntos`, {
      kind,
      pathname: blob.pathname,
      url: blob.url,
      fileName: file.name,
      contentType: file.type || blob.contentType || "application/octet-stream",
      sizeBytes: file.size,
    });
  }

  async function onSubmit(values) {
    setSaving(true);
    setError("");
    try {
      if (!skipQuoteLink) {
        if (!selectedQuote) {
          throw new Error("Selecciona una cotización");
        }
        if (!itemIds.length) {
          throw new Error("Selecciona al menos una partida de la cotización");
        }
      } else if (!isAdmin) {
        throw new Error("No tienes permiso para facturar sin cotización");
      }

      const created = await api.post("/api/ventas/facturas", {
        ...values,
        sellerId: canViewTeam ? values.sellerId : currentUserId,
        receptionDate: values.receivedByClient ? values.receptionDate : null,
        quotes: skipQuoteLink
          ? []
          : [{ quoteId: selectedQuote.id, quoteItemIds: itemIds }],
      });

      if (pdfFile) await uploadInvoiceFile(created.id, "PDF", pdfFile);
      if (xmlFile) await uploadInvoiceFile(created.id, "XML", xmlFile);

      router.push("/ventas/facturas");
      router.refresh();
    } catch (err) {
      setError(err.message || "No se pudo registrar la factura");
    } finally {
      setSaving(false);
    }
  }

  function onInvalid() {
    setError("Revisa los campos marcados. Hay datos incompletos o invalidos.");
    const firstError = document.querySelector(
      "[aria-invalid='true'], .text-danger-700, [data-field-error]"
    );
    firstError?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }

  const selectedCount = itemIds.length;
  const quoteError =
    !skipQuoteLink && errors.quotes?.message
      ? errors.quotes.message
      : !skipQuoteLink && !selectedQuote
        ? "Relaciona una cotización"
        : !skipQuoteLink && selectedQuote && selectedCount === 0
          ? "Selecciona al menos una partida"
          : "";

  const sellerOptions = useMemo(() => sellers, [sellers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar factura"
        description="La factura se liga a una cotización; solo puedes seleccionar partidas de esa cotización."
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
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
                  {sellerOptions.map((s) => (
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
              Cotización y partidas
            </h2>
            <p className="mt-1 text-sm text-content-muted">
              {skipQuoteLink
                ? "Sin relación a cotización (solo administrador)"
                : selectedQuote
                  ? `Seleccionadas: ${selectedCount} partida(s) de ${selectedQuote.folio}`
                  : "Busca una cotización; expande el acordeón para ver fechas y productos"}
              {quoteError ? ` · ${quoteError}` : ""}
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            {isAdmin && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={skipQuoteLink}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSkipQuoteLink(checked);
                    if (checked) clearQuote();
                  }}
                />
                <span>
                  Registrar sin relacionar cotización ni partidas
                  <span className="block text-xs text-content-muted">
                    Solo disponible para administradores.
                  </span>
                </span>
              </label>
            )}

            {!skipQuoteLink && (
              <>
                {!selectedQuote && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="max-w-sm"
                        value={quoteQuery}
                        onChange={(e) => setQuoteQuery(e.target.value)}
                        placeholder="Buscar folio o cliente..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            searchQuotes();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        loading={searching}
                        onClick={searchQuotes}
                      >
                        Buscar cotización
                      </Button>
                    </div>
                    <p className="text-xs text-content-muted">
                      Haz clic en una fila para ver fechas, PO, requisición y partidas
                      antes de seleccionar.
                    </p>

                    {quoteResults.length > 0 && (
                      <QuoteResultAccordion
                        quotes={quoteResults}
                        expandedId={expandedQuoteId}
                        onToggle={toggleQuotePreview}
                        detailsById={quoteDetailsById}
                        onSelect={selectQuote}
                      />
                    )}
                  </>
                )}

                {selectedQuote && (
                  <div className="rounded border border-border p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-content">{selectedQuote.folio}</p>
                        <p className="text-sm text-content-muted">
                          {selectedQuote.clientName}
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={clearQuote}>
                        Cambiar cotización
                      </Button>
                    </div>
                    {selectedQuote.items.length === 0 ? (
                      <p className="text-sm text-content-muted">
                        Esta cotización no tiene partidas activas.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-content-muted">
                          Solo se muestran partidas de esta cotización.
                        </p>
                        {selectedQuote.items.map((item) => (
                          <label
                            key={item.id}
                            className="flex items-start gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={itemIds.includes(item.id)}
                              onChange={() => toggleItem(item.id)}
                            />
                            <span>
                              Partida {item.position} — {item.description}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-content">
              Archivos de la factura
            </h2>
            <p className="mt-1 text-sm text-content-muted">
              Opcional: adjunta el PDF y/o el XML de la factura (máx. {MAX_FILE_MB} MB).
            </p>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="rounded border border-border p-3">
              <p className="mb-2 text-sm font-medium">PDF</p>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  pickFile("PDF", e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
              {pdfFile ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-content-muted" />
                    <span className="truncate">{pdfFile.name}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPdfFile(null)}
                    aria-label="Quitar PDF"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => pdfInputRef.current?.click()}
                >
                  Seleccionar PDF
                </Button>
              )}
            </div>
            <div className="rounded border border-border p-3">
              <p className="mb-2 text-sm font-medium">XML</p>
              <input
                ref={xmlInputRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                className="hidden"
                onChange={(e) => {
                  pickFile("XML", e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
              {xmlFile ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-content-muted" />
                    <span className="truncate">{xmlFile.name}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setXmlFile(null)}
                    aria-label="Quitar XML"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => xmlInputRef.current?.click()}
                >
                  Seleccionar XML
                </Button>
              )}
            </div>
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
