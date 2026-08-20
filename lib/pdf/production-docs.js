import { workOrderProcessSections } from "../../domains/production/process-rules.js";
import { getFormLogoPath, PDF_OPTIONS } from "./forms/iso-form.js";
import { drawDimensionalControlForm } from "./forms/control-dimensional-form.js";
import { drawWorkOrderForm } from "./forms/work-order-form.js";

export { PDF_OPTIONS };

// Los formatos de piso son documentos controlados: solo se prellenan los campos que ya
// existen en el sistema y el resto se imprime en blanco para llenarse a mano.
function fmtDate(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function fmtQuantity(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return decimals === 2 ? "0.00" : "0";
  return n.toFixed(decimals);
}

function fmtHours(value) {
  const n = Number(value) || 0;
  if (n <= 0) return "";
  return String(Math.round(n * 1000) / 1000);
}

function pieceWithQuantity(item) {
  const description = item.description || "";
  const quantity = Number(item.quantity) || 0;
  if (!quantity) return description;
  const pieces = Number.isInteger(quantity) ? String(quantity) : fmtQuantity(quantity);
  return `${description} (${pieces} pz)`;
}

export function buildDimensionalControlModel(order, item) {
  return {
    workCode: order.folio || "",
    pieceName: pieceWithQuantity(item),
    client: order.client?.commercialName || "",
    startDate: fmtDate(item.startedAt || order.startedAt),
    endDate: fmtDate(item.completedAt || order.completedAt),
    operators: (item.operators || []).slice(0, 4),
    logoPath: getFormLogoPath(),
  };
}

export function buildWorkOrderModel(order, item) {
  const sections = workOrderProcessSections(item.processes || []);
  const isQuoted = order.sourceType === "QUOTE";
  return {
    title: isQuoted ? "ORDEN DE TRABAJO COTIZADO" : "ORDEN DE TRABAJO",
    workCode: order.folio || "",
    requestDate: fmtDate(
      order.quote?.requestDate || order.directOrder?.requestDate || order.approvalDate || order.createdAt
    ),
    expectedDate: fmtDate(item.commitmentDate || item.plannedEndAt),
    pieceName: item.description || "",
    seller: order.quote?.seller?.name || order.directOrder?.seller?.name || "",
    company: order.client?.commercialName || "",
    quantity: fmtQuantity(item.quantity),
    observations: item.sellerObservations || item.observations || "",
    processNames: sections.map((section) => section.name),
    materials: (item.sourceMaterials || []).map((material) => ({
      unit: material.unit || "",
      quantity: fmtQuantity(material.quantity),
      description: material.descriptionSnapshot || "",
      dimensions: material.dimensions || "",
      presentation: material.presentation || "",
      supplier: material.supplierName || "",
    })),
    extraMaterials: (item.extraMaterials || []).map((extra) => ({
      summary: [
        extra.description,
        `${fmtQuantity(extra.quantity, 2)} ${extra.unit || ""}`.trim(),
        extra.supplier?.name || "",
      ]
        .filter(Boolean)
        .join(" · "),
      reason: extra.reason || "",
    })),
    processes: sections.map((section) => ({
      name: section.name,
      startDate: fmtDate(section.startedAt),
      endDate: fmtDate(section.completedAt),
      hours: fmtHours(section.realHours),
      operator: section.assignedTo || "",
    })),
    logoPath: getFormLogoPath(),
  };
}

export function drawDimensionalControl(doc, model) {
  drawDimensionalControlForm(doc, model);
}

export function drawWorkOrder(doc, model) {
  drawWorkOrderForm(doc, model);
}
