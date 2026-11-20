import "server-only";
import { getActor } from "@/lib/api/actor";
import { getCurrentUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/permissions/require-permission";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { buildPdfBuffer, pdfResponse } from "@/lib/pdf/helpers";
import { buildXlsx, xlsxResponse } from "@/lib/export/xlsx";
import {
  COST_CATEGORY_LABELS,
  DETECTION_STAGE_SHORT,
  INCIDENT_PRIORITY_LABELS,
  KPI_SECTIONS,
  TRACKING_STATUS_LABELS,
} from "./constants";
import { formatDayMonth, formatDayShort, previousPeriod, todayKey } from "./periods";
import {
  computeCollection,
  computeCommitments,
  computeQuality,
  computeReception,
  computeSales,
  computeSummary,
  periodFromRequest,
} from "./service";
import { historySinceKey, loadGoals, loadInvoices } from "./data";
import { getCatalogMaps, getKpiSettings } from "./settings";

const SECTION_KEYS = KPI_SECTIONS.map((s) => s.key);

export async function buildReportData(period, { date } = {}) {
  const settings = await getKpiSettings();
  const catalogs = await getCatalogMaps();
  const prev = previousPeriod(period);
  const [summary, commitments, goals, invoices, quality] = await Promise.all([
    computeSummary(period, { date }),
    computeCommitments({ dateKey: date || todayKey(), settings }),
    loadGoals(),
    loadInvoices({ sinceKey: historySinceKey(prev.from) }),
    computeQuality({ period, settings, catalogs }),
  ]);
  return {
    period,
    settings,
    summary,
    commitments,
    sales: computeSales({ goals, invoices, period, settings }),
    reception: computeReception({ invoices, period, groupBy: "month" }),
    collection: computeCollection({ invoices, period, settings }),
    quality,
    stopReasons: catalogs.STOP_REASON,
  };
}

// -----------------------------------------------------------------------------
// Formatos
// -----------------------------------------------------------------------------

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  const sign = n < 0 ? "-" : "";
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  return `${sign}$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`;
}

function pct(value) {
  return value == null ? "—" : `${Number(value).toFixed(1)}%`;
}

function days(value) {
  return value == null ? "—" : `${value} días`;
}

function deltaText(d, { money: isMoney = false } = {}) {
  if (!d || d.diff == null) return "";
  const sign = d.diff > 0 ? "+" : "";
  return `${sign}${isMoney ? money(d.diff) : d.diff} vs periodo anterior`;
}

function trackingLabel(row) {
  return TRACKING_STATUS_LABELS[row.tracking.status] || row.tracking.status;
}

const COMMITMENT_GROUPS = [
  { key: "overdue", label: "Vencidos" },
  { key: "thisWeek", label: "Esta semana" },
  { key: "lastWeek", label: "Semana anterior" },
  { key: "nextWeek", label: "Próxima semana" },
  { key: "stopped", label: "Detenidos" },
  { key: "inProgress", label: "En proceso" },
  { key: "pending", label: "Pendientes" },
];

// -----------------------------------------------------------------------------
// Excel
// -----------------------------------------------------------------------------

function excelSheets(report, sections) {
  const { period, summary, commitments, sales, reception, collection, quality } = report;
  const sub = [`Periodo: ${period.label} (${formatDayShort(period.from)} – ${formatDayShort(period.to)})`, `Generado: ${new Date().toLocaleString("es-MX")}`];
  const sheets = [];
  const b = summary.blocks;

  sheets.push({
    name: "Resumen",
    title: "COMSA — Dashboard gerencial",
    subtitle: sub,
    columns: [
      { header: "Indicador", key: "label", width: 40 },
      { header: "Valor", key: "value", width: 18 },
      { header: "Periodo anterior", key: "previous", width: 18 },
      { header: "Variación", key: "diff", width: 16 },
    ],
    rows: [
      { label: "Compromisos vencidos", value: b.commitments.overdue },
      { label: "Compromisos esta semana", value: b.commitments.thisWeek },
      { label: "Compromisos próxima semana", value: b.commitments.nextWeek },
      { label: "Trabajos detenidos", value: b.commitments.stopped },
      { label: "Meta de ventas (c/IVA)", value: money(b.sales.goal) },
      { label: "Facturado (c/IVA)", value: money(b.sales.billed), previous: money(b.sales.compare.billed.previous), diff: money(b.sales.compare.billed.diff) },
      { label: "Avance de meta", value: pct(b.sales.percent), previous: pct(b.sales.compare.percent.previous) },
      { label: "Facturas por recibir (monto)", value: money(b.reception.pendingAmount), previous: money(b.reception.compare.pendingAmount.previous) },
      { label: "Facturas por recibir (número)", value: b.reception.pendingCount },
      { label: "Tiempo medio de recepción", value: days(b.reception.avgDays), previous: days(b.reception.compare.avgDays.previous), diff: b.reception.compare.avgDays.diff },
      { label: "Saldo vencido", value: money(b.collection.overdueAmount), previous: money(b.collection.compare.overdueAmount.previous) },
      { label: "Facturas vencidas", value: b.collection.overdueCount },
      { label: "Tiempo medio de cobro (desde factura)", value: days(b.collection.avgInvoiceToPayment), previous: days(b.collection.compare.avgInvoiceToPayment.previous) },
      { label: "Tiempo medio de cobro (desde recepción)", value: days(b.collection.avgReceptionToPayment), previous: days(b.collection.compare.avgReceptionToPayment.previous) },
      { label: "Errores", value: b.quality.errors, previous: b.quality.compare.errors.previous, diff: b.quality.compare.errors.diff },
      { label: "Retrabajos", value: b.quality.reworks, previous: b.quality.compare.reworks.previous, diff: b.quality.compare.reworks.diff },
      { label: "Horas de retrabajo", value: b.quality.reworkHours, previous: b.quality.compare.reworkHours.previous, diff: b.quality.compare.reworkHours.diff },
      { label: "Costo de errores", value: money(b.quality.cost), previous: money(b.quality.compare.cost.previous), diff: money(b.quality.compare.cost.diff) },
      { label: "Escapes al cliente", value: b.quality.escapes, previous: b.quality.compare.escapes.previous, diff: b.quality.compare.escapes.diff },
    ],
  });

  if (sections.includes("compromisos")) {
    const rows = [];
    for (const g of COMMITMENT_GROUPS) {
      for (const r of commitments.groups[g.key]) rows.push({ group: g.label, ...r });
    }
    sheets.push({
      name: "Compromisos",
      title: `Trabajos y compromisos — Semana ${commitments.weekNumber}`,
      subtitle: [`Semana ${formatDayShort(commitments.week.from)} – ${formatDayShort(commitments.week.to)}`],
      columns: [
        { header: "Vista", key: "group", width: 16 },
        { header: "Proyecto", key: "project", width: 14 },
        { header: "Cotización", key: "quoteFolio", width: 14 },
        { header: "Cliente", key: "client", width: 28 },
        { header: "Partida", key: "position", type: "int", width: 9 },
        { header: "Descripción", key: "description", width: 40 },
        { header: "Responsable", key: "responsible", width: 20 },
        { header: "Vendedor", key: "sellerName", width: 20 },
        { header: "Compromiso", value: (r) => r.commitmentDate || "", width: 13 },
        { header: "Estado", value: trackingLabel, width: 15 },
        { header: "Días de retraso", value: (r) => r.tracking.daysLate || "", type: "int", width: 10 },
        { header: "Incidencias abiertas", value: (r) => r.openIncidents.map((i) => i.title).join(" | "), width: 40 },
      ],
      rows,
    });
  }

  if (sections.includes("ventas")) {
    sheets.push({
      name: "Ventas",
      title: "Proyección y avance de ventas",
      subtitle: sub,
      columns: [
        { header: "Vendedor / equipo", key: "label", width: 36 },
        { header: "Meta c/IVA", key: "goalWithTax", type: "money", width: 16 },
        { header: "Meta s/IVA", key: "goalWithoutTax", type: "money", width: 16 },
        { header: "Facturado c/IVA", key: "billedWithTax", type: "money", width: 16 },
        { header: "Facturado s/IVA", key: "billedWithoutTax", type: "money", width: 16 },
        { header: "Avance %", key: "percent", type: "percent", width: 10 },
        { header: "Diferencia c/IVA", key: "differenceWithTax", type: "money", width: 16 },
      ],
      rows: [...sales.rows, sales.total],
    });
    sheets.push({
      name: "Facturas del periodo",
      columns: [
        { header: "Factura", key: "invoiceNumber", width: 14 },
        { header: "Fecha", key: "invoiceDate", width: 12 },
        { header: "Cliente", key: "clientName", width: 28 },
        { header: "Vendedor", key: "sellerName", width: 20 },
        { header: "Cotización", key: "quoteFolios", width: 16 },
        { header: "PO", key: "clientPoNumber", width: 14 },
        { header: "Monto c/IVA", key: "netAmount", type: "money", width: 16 },
      ],
      rows: sales.invoices,
    });
  }

  if (sections.includes("recepcion")) {
    sheets.push({
      name: "Facturas por recibir",
      title: "Facturas pendientes de recepción",
      subtitle: [...sub, `Al ${formatDayShort(reception.asOf)} · Tiempo medio de recepción: ${days(reception.avgReceptionDays)}`],
      columns: [
        { header: "Factura", key: "invoiceNumber", width: 14 },
        { header: "Cliente", key: "clientName", width: 28 },
        { header: "Vendedor", key: "sellerName", width: 20 },
        { header: "Cotización", key: "quoteFolios", width: 16 },
        { header: "Partidas", key: "partidas", width: 10 },
        { header: "PO", key: "clientPoNumber", width: 14 },
        { header: "Fecha factura", key: "invoiceDate", width: 13 },
        { header: "Fecha envío", key: "sentAt", width: 13 },
        { header: "Días pendientes", key: "daysPending", type: "int", width: 10 },
        { header: "Monto", key: "netAmount", type: "money", width: 16 },
      ],
      rows: reception.pending,
    });
    sheets.push({
      name: "Facturas recibidas",
      columns: [
        { header: "Factura", key: "invoiceNumber", width: 14 },
        { header: "Cliente", key: "clientName", width: 28 },
        { header: "Fecha factura", key: "invoiceDate", width: 13 },
        { header: "Fecha envío", key: "sentAt", width: 13 },
        { header: "Fecha recepción", key: "receptionDate", width: 13 },
        { header: "Días", key: "receptionDays", type: "int", width: 8 },
        { header: "Monto", key: "netAmount", type: "money", width: 16 },
      ],
      rows: reception.received,
    });
  }

  if (sections.includes("cobranza")) {
    sheets.push({
      name: "Cobranza vencida",
      title: "Cobranza y facturas fuera de crédito",
      subtitle: [
        ...sub,
        `Al ${formatDayShort(collection.asOf)} · Cobro desde factura: ${days(collection.avgInvoiceToPayment)} · desde recepción: ${days(collection.avgReceptionToPayment)}`,
      ],
      columns: [
        { header: "Cliente", key: "clientName", width: 28 },
        { header: "Factura", key: "invoiceNumber", width: 14 },
        { header: "Vendedor", key: "sellerName", width: 20 },
        { header: "Cotización", key: "quoteFolios", width: 16 },
        { header: "PO", key: "clientPoNumber", width: 14 },
        { header: "Fecha factura", key: "invoiceDate", width: 13 },
        { header: "Recepción", key: "receptionDate", width: 13 },
        { header: "Crédito (días)", key: "creditDays", type: "int", width: 10 },
        { header: "Fecha límite", key: "dueKey", width: 13 },
        { header: "Fecha pago", value: (r) => r.paidKey || "—", width: 13 },
        { header: "Días vencidos", key: "daysOverdue", type: "int", width: 10 },
        { header: "Monto", key: "netAmount", type: "money", width: 16 },
      ],
      rows: [...collection.overdue, ...collection.paidLate],
    });
    sheets.push({
      name: "Saldo vencido por cliente",
      columns: [
        { header: "Cliente", key: "label", width: 32 },
        { header: "Monto", key: "amount", type: "money", width: 16 },
        { header: "Facturas", key: "count", type: "int", width: 10 },
        { header: "% del saldo", key: "amountPct", type: "percent", width: 12 },
      ],
      rows: collection.distributionByClient,
    });
  }

  if (sections.includes("calidad")) {
    sheets.push({
      name: "Calidad errores",
      title: "Calidad y errores de producción",
      subtitle: [
        ...sub,
        `Errores: ${quality.totalErrors} · Internos: ${quality.internalErrors} · Detectados por Calidad: ${quality.detectedByQuality} · Escapes: ${quality.escapes} · Retrabajos: ${quality.reworkCount} · Horas retrabajo: ${quality.reworkHours} · Costo: ${money(quality.totalCost)}`,
      ],
      columns: [
        { header: "Fecha", key: "detectedAt", width: 12 },
        { header: "Proyecto", key: "project", width: 14 },
        { header: "Cotización", key: "quoteFolio", width: 14 },
        { header: "Cliente", key: "client", width: 24 },
        { header: "Partida", key: "position", type: "int", width: 8 },
        { header: "Detección", value: (r) => DETECTION_STAGE_SHORT[r.detectionStage], width: 16 },
        { header: "Área", value: (r) => r.areaLabel || "Sin clasificar", width: 16 },
        { header: "Causa", value: (r) => r.causeLabel || "Sin clasificar", width: 24 },
        { header: "Operador", key: "operatorLabel", width: 20 },
        { header: "Descripción", key: "description", width: 40 },
        { header: "Horas", value: (r) => r.cost.hours, type: "number", width: 8 },
        { header: COST_CATEGORY_LABELS.LABOR, value: (r) => r.cost.labor, type: "money", width: 14 },
        { header: COST_CATEGORY_LABELS.MATERIAL, value: (r) => r.cost.material, type: "money", width: 14 },
        { header: COST_CATEGORY_LABELS.OTHER, value: (r) => r.cost.other, type: "money", width: 14 },
        { header: "Costo total", value: (r) => r.cost.total, type: "money", width: 14 },
      ],
      rows: quality.errors,
    });
    const distColumns = (label) => [
      { header: label, key: "label", width: 28 },
      { header: "Errores", key: "count", type: "int", width: 10 },
      { header: "%", key: "pct", type: "percent", width: 10 },
      { header: "Costo", key: "amount", type: "money", width: 16 },
    ];
    sheets.push({ name: "Errores por área", columns: distColumns("Área"), rows: quality.byArea });
    sheets.push({ name: "Errores por causa", columns: distColumns("Causa"), rows: quality.byCause });
    sheets.push({ name: "Errores por operador", columns: distColumns("Operador"), rows: quality.byOperator });
  }

  return sheets;
}

// -----------------------------------------------------------------------------
// PDF (reporte de junta)
// -----------------------------------------------------------------------------

const PAGE = { left: 36, right: 756, bottom: 570 };
const INK = "#1a1d23";
const MUTED = "#667085";
const BRAND = "#1f47f5";
const LINE = "#e4e7ec";

function ensureSpace(doc, needed) {
  if (doc.y + needed > PAGE.bottom) doc.addPage();
}

function sectionTitle(doc, text) {
  ensureSpace(doc, 60);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND).text(text.toUpperCase(), PAGE.left, doc.y);
  doc.moveTo(PAGE.left, doc.y + 2).lineTo(PAGE.right, doc.y + 2).lineWidth(1).stroke(BRAND);
  doc.moveDown(0.5);
  doc.fillColor(INK);
}

function statRow(doc, stats) {
  ensureSpace(doc, 48);
  const width = (PAGE.right - PAGE.left) / stats.length;
  const top = doc.y;
  stats.forEach((s, i) => {
    const x = PAGE.left + i * width;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(s.label, x, top, { width: width - 8 });
    doc.font("Helvetica-Bold").fontSize(14).fillColor(INK).text(String(s.value), x, top + 11, { width: width - 8 });
    if (s.note) doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(s.note, x, top + 29, { width: width - 8 });
  });
  doc.x = PAGE.left;
  doc.y = top + 44;
  doc.fillColor(INK);
}

function table(doc, columns, rows, { emptyLabel = "Sin registros.", max = 60, caption } = {}) {
  if (caption) {
    ensureSpace(doc, 40);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(caption, PAGE.left, doc.y);
    doc.moveDown(0.2);
  }
  if (!rows.length) {
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(emptyLabel, PAGE.left, doc.y);
    doc.fillColor(INK);
    doc.moveDown(0.4);
    return;
  }
  const total = PAGE.right - PAGE.left;
  const sum = columns.reduce((s, c) => s + (c.w || 1), 0);
  const widths = columns.map((c) => ((c.w || 1) / sum) * total);

  const header = () => {
    ensureSpace(doc, 30);
    const y = doc.y;
    doc.rect(PAGE.left, y - 2, total, 14).fill("#eef4ff");
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(7.5);
    let x = PAGE.left;
    columns.forEach((c, i) => {
      doc.text(c.header, x + 2, y + 1, { width: widths[i] - 4, align: c.align || "left", lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    doc.y = y + 14;
  };

  header();
  doc.font("Helvetica").fontSize(7.5);
  const shown = rows.slice(0, max);
  for (const row of shown) {
    const cells = columns.map((c) => String(c.value(row) ?? ""));
    const heights = cells.map((text, i) => doc.heightOfString(text, { width: widths[i] - 4 }));
    const h = Math.min(30, Math.max(11, ...heights)) + 3;
    if (doc.y + h > PAGE.bottom) {
      doc.addPage();
      header();
      doc.font("Helvetica").fontSize(7.5);
    }
    const y = doc.y;
    let x = PAGE.left;
    cells.forEach((text, i) => {
      doc.fillColor(columns[i].color?.(row) || INK).text(text, x + 2, y + 1, {
        width: widths[i] - 4,
        height: h - 2,
        align: columns[i].align || "left",
        ellipsis: true,
      });
      x += widths[i];
    });
    doc.moveTo(PAGE.left, y + h).lineTo(PAGE.right, y + h).lineWidth(0.5).stroke(LINE);
    doc.y = y + h + 1;
  }
  if (rows.length > shown.length) {
    doc.font("Helvetica-Oblique").fontSize(7).fillColor(MUTED).text(
      `… y ${rows.length - shown.length} registros más (ver Excel).`,
      PAGE.left,
      doc.y + 2
    );
  }
  doc.fillColor(INK);
  doc.x = PAGE.left;
  doc.moveDown(0.5);
}

function bars(doc, rows, { label = (r) => r.label, value = (r) => r.amount, format = money, caption, max = 8 }) {
  const list = rows.slice(0, max);
  if (!list.length) return;
  ensureSpace(doc, 20 + list.length * 14);
  if (caption) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(caption, PAGE.left, doc.y);
    doc.moveDown(0.2);
  }
  const top = Math.max(...list.map(value), 1);
  const labelW = 160;
  const barW = 360;
  for (const r of list) {
    const y = doc.y;
    doc.font("Helvetica").fontSize(7.5).fillColor(INK).text(label(r), PAGE.left, y + 1, { width: labelW - 6, lineBreak: false, ellipsis: true });
    const w = Math.max(2, (value(r) / top) * barW);
    doc.roundedRect(PAGE.left + labelW, y + 1, w, 8, 2).fill(BRAND);
    doc.fillColor(INK).text(format(value(r)), PAGE.left + labelW + w + 6, y + 1, { lineBreak: false });
    doc.y = y + 13;
  }
  doc.x = PAGE.left;
  doc.moveDown(0.5);
}

function commitmentColumns() {
  return [
    { header: "Proyecto", value: (r) => r.project, w: 1.1 },
    { header: "Cotización", value: (r) => r.quoteFolio || "—", w: 1.1 },
    { header: "Cliente", value: (r) => r.client, w: 1.8 },
    { header: "Part.", value: (r) => r.position, w: 0.5, align: "center" },
    { header: "Descripción", value: (r) => r.description, w: 2.6 },
    { header: "Responsable", value: (r) => r.responsible, w: 1.3 },
    { header: "Compromiso", value: (r) => formatDayMonth(r.commitmentDate), w: 0.9 },
    {
      header: "Estado",
      value: (r) => `${trackingLabel(r)}${r.tracking.daysLate ? ` (+${r.tracking.daysLate}d)` : ""}`,
      w: 1.2,
      color: (r) => (["DELAYED", "STOPPED"].includes(r.tracking.status) ? "#b42318" : INK),
    },
    {
      header: "Incidencia",
      value: (r) =>
        r.openIncidents
          .map((i) => `${i.title} → ${i.assignedTo?.name || "s/resp."} (${INCIDENT_PRIORITY_LABELS[i.priority]})`)
          .join("; ") || "",
      w: 2.2,
    },
  ];
}

function buildPdf(report, sections, generatedBy) {
  const { period, summary, commitments, sales, reception, collection, quality } = report;
  const b = summary.blocks;

  return buildPdfBuffer(
    (doc) => {
      doc.font("Helvetica-Bold").fontSize(18).fillColor(INK).text("COMSA — JUNTA SEMANAL", PAGE.left, 36);
      doc.font("Helvetica").fontSize(10).fillColor(MUTED);
      doc.text(
        `Semana ${commitments.weekNumber} (${formatDayShort(commitments.week.from)} – ${formatDayShort(commitments.week.to)})  ·  Periodo de indicadores: ${period.label}  ·  Comparado contra: ${summary.previous.label}`
      );
      doc.text(`Generado ${new Date().toLocaleString("es-MX")} por ${generatedBy || "Sistema"}`);
      doc.fillColor(INK);

      if (sections.includes("compromisos")) {
        sectionTitle(doc, "1. Trabajos y compromisos");
        statRow(doc, [
          { label: "Vencidos", value: b.commitments.overdue },
          { label: "Esta semana", value: b.commitments.thisWeek },
          { label: "Próxima semana", value: b.commitments.nextWeek },
          { label: "Detenidos", value: b.commitments.stopped },
          { label: "En proceso", value: b.commitments.inProgress },
        ]);
        table(doc, commitmentColumns(), commitments.groups.overdue, { caption: "Compromisos vencidos", emptyLabel: "Sin compromisos vencidos." });
        table(doc, commitmentColumns(), commitments.groups.stopped, { caption: "Trabajos detenidos", emptyLabel: "Sin trabajos detenidos." });
        table(doc, commitmentColumns(), commitments.groups.thisWeek, { caption: "Compromisos de la semana" });
        table(doc, commitmentColumns(), commitments.groups.nextWeek, { caption: "Próxima semana" });
      }

      if (sections.includes("ventas")) {
        sectionTitle(doc, "2. Proyección y avance de ventas");
        statRow(doc, [
          { label: "Meta (c/IVA)", value: money(b.sales.goal) },
          { label: "Facturado (c/IVA)", value: money(b.sales.billed), note: deltaText(b.sales.compare.billed, { money: true }) },
          { label: "Avance", value: pct(b.sales.percent) },
          { label: "Diferencia vs meta", value: money(b.sales.difference) },
        ]);
        table(
          doc,
          [
            { header: "Vendedor / equipo", value: (r) => r.label, w: 2.4 },
            { header: "Meta c/IVA", value: (r) => money(r.goalWithTax), w: 1.2, align: "right" },
            { header: "Meta s/IVA", value: (r) => money(r.goalWithoutTax), w: 1.2, align: "right" },
            { header: "Facturado c/IVA", value: (r) => money(r.billedWithTax), w: 1.2, align: "right" },
            { header: "Avance", value: (r) => pct(r.percent), w: 0.8, align: "right" },
            { header: "Diferencia", value: (r) => money(r.differenceWithTax), w: 1.2, align: "right", color: (r) => (r.differenceWithTax < 0 ? "#b42318" : "#027a48") },
          ],
          [...sales.rows, sales.total]
        );
      }

      if (sections.includes("recepcion")) {
        sectionTitle(doc, "3. Facturas pendientes de recepción");
        statRow(doc, [
          { label: "Pendiente", value: money(reception.pendingAmount) },
          { label: "Facturas", value: reception.pendingCount },
          { label: "Tiempo medio de recepción", value: days(reception.avgReceptionDays), note: deltaText(b.reception.compare.avgDays) },
          { label: "Recibidas en el periodo", value: reception.receivedCount },
        ]);
        table(
          doc,
          [
            { header: "Factura", value: (r) => r.invoiceNumber, w: 1 },
            { header: "Cliente", value: (r) => r.clientName || "Sin cliente", w: 2 },
            { header: "Vendedor", value: (r) => r.sellerName, w: 1.4 },
            { header: "Fecha factura", value: (r) => formatDayShort(r.invoiceDate), w: 1 },
            { header: "Días pendientes", value: (r) => r.daysPending, w: 0.8, align: "right" },
            { header: "Monto", value: (r) => money(r.netAmount), w: 1.2, align: "right" },
          ],
          reception.pending,
          { emptyLabel: "No hay facturas pendientes de recepción." }
        );
      }

      if (sections.includes("cobranza")) {
        sectionTitle(doc, "4. Cobranza y tiempo de crédito");
        statRow(doc, [
          { label: "Saldo vencido", value: money(collection.overdueAmount) },
          { label: "Facturas vencidas", value: collection.overdueCount },
          { label: "Clientes con vencido", value: collection.overdueClients },
          { label: "Cobro desde factura", value: days(collection.avgInvoiceToPayment) },
          { label: "Cobro desde recepción", value: days(collection.avgReceptionToPayment) },
        ]);
        table(
          doc,
          [
            { header: "Cliente", value: (r) => r.clientName || "Sin cliente", w: 2 },
            { header: "Factura", value: (r) => r.invoiceNumber, w: 1 },
            { header: "Monto", value: (r) => money(r.netAmount), w: 1.2, align: "right" },
            { header: "Fecha límite", value: (r) => formatDayShort(r.dueKey), w: 1 },
            { header: "Fecha pago", value: (r) => (r.paidKey ? formatDayShort(r.paidKey) : "—"), w: 1 },
            { header: "Días vencidos", value: (r) => r.daysOverdue, w: 0.8, align: "right", color: () => "#b42318" },
          ],
          [...collection.overdue, ...collection.paidLate],
          { emptyLabel: "No hay facturas fuera de crédito." }
        );
        bars(doc, collection.distributionByClient, { caption: "Saldo vencido por cliente" });
      }

      if (sections.includes("calidad")) {
        sectionTitle(doc, "5. Calidad y errores de producción");
        statRow(doc, [
          { label: "Errores", value: quality.totalErrors, note: deltaText(b.quality.compare.errors) },
          { label: "Detectados por Calidad", value: quality.detectedByQuality },
          { label: "Escapes al cliente", value: quality.escapes },
          { label: "Retrabajos", value: quality.reworkCount },
          { label: "Horas de retrabajo", value: quality.reworkHours },
          { label: "Costo de errores", value: money(quality.totalCost) },
        ]);
        bars(doc, quality.byArea, { caption: "Errores por área", value: (r) => r.count, format: (v) => String(v) });
        bars(doc, quality.byCause, { caption: "Errores por causa", value: (r) => r.count, format: (v) => String(v) });
        bars(doc, quality.byOperator, { caption: "Errores por operador", value: (r) => r.count, format: (v) => String(v) });
        table(
          doc,
          [
            { header: "Fecha", value: (r) => formatDayMonth(r.detectedAt), w: 0.7 },
            { header: "Proyecto", value: (r) => r.project, w: 1 },
            { header: "Partida", value: (r) => r.position ?? "—", w: 0.6, align: "center" },
            { header: "Detección", value: (r) => DETECTION_STAGE_SHORT[r.detectionStage], w: 1 },
            { header: "Área", value: (r) => r.areaLabel || "Sin clasificar", w: 1 },
            { header: "Causa", value: (r) => r.causeLabel || "Sin clasificar", w: 1.4 },
            { header: "Descripción", value: (r) => r.description, w: 2.4 },
            { header: "Costo", value: (r) => money(r.cost.total), w: 1, align: "right" },
          ],
          quality.errors,
          { caption: "Errores del periodo (mayor costo primero)", max: 30, emptyLabel: "Sin errores registrados en el periodo." }
        );
      }

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(
          `COMSA ERP · Dashboard gerencial · Página ${i + 1} de ${range.count}`,
          PAGE.left,
          592,
          { width: PAGE.right - PAGE.left, align: "center", lineBreak: false }
        );
      }
    },
    { size: "LETTER", margin: 36, pdfkit: { layout: "landscape", bufferPages: true } }
  );
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

export async function exportReportHandler(request) {
  await requirePermission("kpis.export");
  const actor = await getActor(request);
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
  const section = url.searchParams.get("section") || "all";
  const sections = SECTION_KEYS.includes(section) ? [section] : SECTION_KEYS;
  const period = periodFromRequest(request);
  const report = await buildReportData(period, { date: url.searchParams.get("date") });

  const stamp = `${period.from}_${period.to}`;
  const base = section === "all" ? "reporte-junta" : `kpi-${section}`;

  await recordAudit({
    actor,
    module: "kpis",
    entity: "Report",
    entityId: base,
    action: AUDIT_ACTIONS.REPORT_GENERATE,
    newData: { format, section, period: period.label },
  });

  if (format === "xlsx") {
    const buffer = buildXlsx(excelSheets(report, sections));
    return xlsxResponse(buffer, `${base}_${stamp}.xlsx`);
  }
  const buffer = await buildPdf(report, sections, user?.name);
  return pdfResponse(buffer, `${base}_${stamp}.pdf`);
}
