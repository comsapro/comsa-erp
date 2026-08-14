import { workOrderProcessSections } from "../../domains/production/process-rules.js";

function fmtDate(value) {
  if (!value) return "Pendiente";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return String(value);
  }
}

function fmtHours(n) {
  return `${Number(n || 0).toFixed(3)} h`;
}

export function buildDimensionalControlModel(order, item) {
  return {
    title: "Control dimensional",
    productionFolio: order.folio,
    sourceFolio: order.quote?.folio || order.directOrder?.folio || "—",
    client: order.client?.commercialName || "—",
    pieceName: item.description,
    quantity: Number(item.quantity) || 0,
    startDate: fmtDate(item.startedAt || order.startedAt || order.approvalDate),
    expectedDate: fmtDate(order.completedAt) === "Pendiente" ? "Pendiente" : fmtDate(order.completedAt),
    itemStatus: item.status,
    orderStatus: order.status,
  };
}

export function buildWorkOrderModel(order, item) {
  const sections = workOrderProcessSections(item.processes || []);
  return {
    title: "Orden de trabajo",
    productionFolio: order.folio,
    requestDate: fmtDate(order.approvalDate || order.createdAt),
    expectedDate: fmtDate(order.completedAt),
    pieceName: item.description,
    client: order.client?.commercialName || "—",
    seller: order.quote?.seller?.name || "—",
    quantity: Number(item.quantity) || 0,
    observations: item.observations || "",
    materials: (item.sourceMaterials || []).map((m) => ({
      description: m.descriptionSnapshot,
      quantity: Number(m.quantity) || 0,
      unit: m.unit || "",
      dimensions: m.dimensions || "",
    })),
    processes: sections,
  };
}

function ensureSpace(doc, needed = 80) {
  if (doc.y + needed > 720) {
    doc.addPage();
  }
}

export function drawDimensionalControl(doc, model) {
  doc.fontSize(16).text(model.title);
  doc.moveDown(0.4);
  doc.fontSize(10);
  const rows = [
    ["Folio de produccion", model.productionFolio],
    ["Referencia origen", model.sourceFolio],
    ["Cliente", model.client],
    ["Pieza / partida", model.pieceName],
    ["Cantidad", String(model.quantity)],
    ["Fecha de inicio", model.startDate],
    ["Fecha esperada / final", model.expectedDate],
    ["Estatus partida", model.itemStatus],
    ["Estatus orden", model.orderStatus],
  ];
  for (const [label, value] of rows) {
    ensureSpace(doc, 24);
    doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
    doc.font("Helvetica").text(String(value || "—"));
  }
  doc.moveDown();
  doc.fontSize(9).fillColor("#555");
  doc.text(
    "Registro de mediciones (llenado en piso). Conserve este documento con la orden de produccion."
  );
  doc.fillColor("#000");
}

export function drawWorkOrder(doc, model) {
  doc.fontSize(16).text(model.title);
  doc.moveDown(0.4);
  doc.fontSize(10);
  const header = [
    ["Codigo de produccion", model.productionFolio],
    ["Fecha de solicitud", model.requestDate],
    ["Fecha esperada", model.expectedDate],
    ["Pieza", model.pieceName],
    ["Cliente / empresa", model.client],
    ["Vendedor / origen", model.seller],
    ["Cantidad", String(model.quantity)],
  ];
  for (const [label, value] of header) {
    ensureSpace(doc, 22);
    doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
    doc.font("Helvetica").text(String(value || "—"));
  }

  if (model.observations) {
    ensureSpace(doc, 40);
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text("Observaciones");
    doc.font("Helvetica").text(model.observations);
  }

  doc.moveDown();
  doc.font("Helvetica-Bold").fontSize(12).text("Materiales");
  doc.font("Helvetica").fontSize(9);
  if (!model.materials.length) {
    doc.text("Sin materiales de origen capturados.");
  } else {
    for (const mat of model.materials) {
      ensureSpace(doc, 20);
      doc.text(
        `- ${mat.description} · ${mat.quantity} ${mat.unit}${
          mat.dimensions ? ` · ${mat.dimensions}` : ""
        }`
      );
    }
  }

  doc.moveDown();
  doc.font("Helvetica-Bold").fontSize(12).text("Procesos de manufactura");
  doc.font("Helvetica").fontSize(9);
  if (!model.processes.length) {
    ensureSpace(doc, 20);
    doc.text("Sin procesos registrados.");
  } else {
    for (const proc of model.processes) {
      ensureSpace(doc, 70);
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text(`${proc.index}. ${proc.name} (${proc.sourceType})`);
      doc.font("Helvetica").fontSize(9);
      doc.text(
        `Horas cotizadas: ${fmtHours(proc.quotedHours)} · Esperadas: ${fmtHours(
          proc.expectedHours
        )} · Reales: ${fmtHours(proc.realHours)} · Estatus: ${proc.status}`
      );
      if (proc.notes) doc.text(`Notas: ${proc.notes}`);
      doc.text("Espacio de trabajo / visto bueno: ___________________________");
    }
  }
}
