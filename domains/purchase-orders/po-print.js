import path from "path";
import { toNumber } from "../../lib/quotes/calculations.js";

export const PO_DOC_CODE = "COM-ALM-R-01";
export const PO_REVISION_LABEL = "Revisión 1.1";
export const PO_REVISION_DATE = "Fecha de revisión: 9 de enero del 2025";

const COMSA_TEL = "(871) 538 5508";
const COMSA_CEL = "(871) 167 5229";
const COMSA_EMAIL = "comsamaquinados@comsapro.com.mx";
const COMSA_LEGAL =
  "COMERCIALIZADORA, OPERACIONES Y MANUFACTURA, S.A. DE C.V.";
const COMSA_RFC = "COM070417GW6";
const COMSA_HEADER_ADDRESS =
  "Calle Lirios No. 43, Col, Ana Establo, C.P. 27405, Torreón, Coahuila.";

export const PO_DEFAULT_DELIVERY_LINES = [
  "Calle Lirios #43 Colonia sin especificar Ana Establo Torreón",
  "Coahuila Mex. Entre calles petunias y Heliotropos",
];

export const PO_INVOICE_INSTRUCTIONS = {
  title: "Instrucciones para facturar y recepcionar las facturas:",
  intro:
    "Todas las facturas realizadas a comercializadora, operaciones y manufactura SA de CV deberán contener los siguientes datos:",
  bullets: [
    "- Núm. de la orden de compra",
    "- Las líneas de los descrito deberán hacer referencia a las partidas de lo mencionado en la orden de compra",
    "- La cantidad y precio mencionados en la factura deben coincidir con los de la orden de compra",
    "- Se deberán entregar todos los materiales con una copia de la factura y de la orden de compra",
    "- La programación de pago se determinara a partir de que el material o servicio haya sido entregado o realizado en caso de los servicios",
    "- Todas las facturas se deberán enviar al coreo de comsamaquinados@comsapro.com.mx adjuntando también una copia de la factura firmada y sellada por almacén de materia prima",
  ],
  closing:
    "En caso de las facturas no especifiquen o no contengan la información antes mencionada esta no se programara a pago si no hasta que tenga la información correcta.",
};

export function getComsaLogoPath() {
  return path.join(process.cwd(), "public", "branding", "comsa-logo.jpeg");
}

function formatQuoteMoney(value) {
  const n = toNumber(value);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
  return `$${formatted}`;
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return String(value || "").trim();
}

function isLegacySku(sku) {
  const value = String(sku || "").trim();
  if (!value) return true;
  return /^LEGACY-/i.test(value);
}

export function formatPoDateTime(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 19);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function formatPoQuantity(value) {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

export function partNumberOf(item) {
  const sku = item?.item?.sku || item?.sku;
  return isLegacySku(sku) ? "NA" : sku;
}

export function mapPurchaseOrderLine(item, index, material) {
  const catalog = item.item || {};
  const snapshot = String(item.descriptionSnapshot || "").trim();
  const materialType = String(
    material?.descriptionSnapshot || catalog.name || ""
  ).trim();
  const description = String(
    material?.presentation || snapshot || catalog.description || ""
  ).trim();
  const dimensions = String(material?.dimensions || "").trim();

  return {
    position: index + 1,
    partNumber: partNumberOf(item),
    materialType: materialType || "NA",
    description,
    dimensions,
    quantity: formatPoQuantity(item.quantity),
    unitPrice: formatQuoteMoney(item.unitPrice),
    subtotal: formatQuoteMoney(item.subtotal),
  };
}

function resolveCompany(issuingCompany = {}) {
  return {
    legalName: issuingCompany.legalName || issuingCompany.commercialName || COMSA_LEGAL,
    phone: formatPhone(issuingCompany.phone) || COMSA_TEL,
    cellPhone: formatPhone(issuingCompany.cellPhone) || COMSA_CEL,
    email: issuingCompany.email || COMSA_EMAIL,
    address: issuingCompany.fiscalAddress || COMSA_HEADER_ADDRESS,
    rfc: issuingCompany.rfc || COMSA_RFC,
  };
}

function billToText(company) {
  const name =
    company.legalName
      .replace(/\s*S\.?\s*A\.?\s*DE\s*C\.?\s*V\.?/gi, " SA DE CV")
      .replace(/,\s*SA DE CV/i, " SA DE CV")
      .replace(/\s+/g, " ")
      .trim() || COMSA_LEGAL;
  return company.rfc ? `${name} RFC: ${company.rfc}` : name;
}

function deliveryLines(po, company) {
  const warehouse = (po.items || []).find((row) => row.warehouse?.location)?.warehouse;
  if (warehouse?.location) {
    return String(warehouse.location)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (
    company.address &&
    company.address !== COMSA_HEADER_ADDRESS &&
    !/Lirios No\. 43/i.test(company.address)
  ) {
    return [company.address];
  }
  return PO_DEFAULT_DELIVERY_LINES;
}

export function buildPurchaseOrderPrintModel(po, { materialsById = {}, issuingCompany } = {}) {
  const company = resolveCompany(
    issuingCompany || po.quote?.issuingCompany || po.productionOrder?.quote?.issuingCompany || {}
  );
  const currency = po.quote?.currency || po.productionOrder?.quote?.currency || "MXN";
  const quoteFolio =
    po.quote?.folio || po.productionOrder?.quote?.folio || "-";

  return {
    folio: po.folio,
    revisionLabel: PO_REVISION_LABEL,
    revisionDate: PO_REVISION_DATE,
    docCode: PO_DOC_CODE,
    currencyBanner: currency === "USD" ? "PRECIOS EN USD" : "PRECIOS EN MXN",
    company,
    logoPath: getComsaLogoPath(),
    meta: {
      proveedor: po.supplier?.legalName || po.supplier?.name || "-",
      solicitante: po.requestedByUser?.name || "-",
      fecha: formatPoDateTime(po.createdAt || po.requestDate),
      cotizacion: quoteFolio,
    },
    deliveryLines: deliveryLines(po, company),
    billTo: billToText(company),
    items: (po.items || []).map((item, index) =>
      mapPurchaseOrderLine(item, index, materialsById[item.sourceMaterialId] || null)
    ),
    totals: {
      subtotal: formatQuoteMoney(po.subtotal),
      tax: formatQuoteMoney(po.tax),
      total: formatQuoteMoney(po.total),
    },
    notes: String(po.comments || "").trim(),
    instructions: PO_INVOICE_INSTRUCTIONS,
  };
}
