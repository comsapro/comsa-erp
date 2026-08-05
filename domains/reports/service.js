import "server-only";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import {
  buildPdfBuffer,
  pdfResponse,
  pdfMoney,
  drawReportHeader,
  drawTable,
  drawFooterTotals,
} from "@/lib/pdf/helpers";
import { formatMoney } from "@/lib/utils/format";
import { toNumber } from "@/lib/quotes/calculations";
import { NotFoundError, ValidationError } from "@/lib/permissions/errors";
import { PO_STATUS_LABELS } from "@/domains/purchase-orders/constants";
import { QUOTE_STATUS_LABELS } from "@/domains/quotes/constants";
import { PRODUCTION_STATUS_LABELS } from "@/domains/production/constants";
import { MOVEMENT_TYPE_LABELS } from "@/domains/inventory/constants";
import { quotePdfResponse } from "@/lib/pdf/quote-pdf";

function filterList(searchParams) {
  const filters = [];
  for (const [k, v] of searchParams.entries()) {
    if (v && !["page", "pageSize", "sort", "order"].includes(k)) {
      filters.push(`${k}=${v}`);
    }
  }
  return filters;
}

export async function quotationPdf(request, id) {
  await requirePermission("quotes.print");
  const actor = await getActor(request);
  const quote = await prisma.quote.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: true,
      clientContact: true,
      seller: true,
      issuingCompany: true,
      items: { orderBy: { position: "asc" } },
    },
  });
  if (!quote) throw new NotFoundError("Cotizacion no encontrada");
  if (!["APPROVED", "IN_PRODUCTION"].includes(quote.status)) {
    throw new ValidationError(
      "Solo se puede generar PDF de cotizaciones aprobadas"
    );
  }

  const response = await quotePdfResponse(quote);

  await recordAudit({
    actor,
    module: "quotes",
    entity: "Quote",
    entityId: id,
    action: AUDIT_ACTIONS.PDF_GENERATE,
    newData: { folio: quote.folio },
  });

  return response;
}

export async function purchaseOrderPdf(request, id) {
  await requirePermission("purchase_orders.print");
  const actor = await getActor(request);
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, deletedAt: null },
    include: {
      supplier: true,
      requestedByUser: true,
      authorizedByUser: true,
      productionOrder: true,
      items: {
        include: { item: { select: { sku: true } } },
      },
    },
  });
  if (!po) throw new NotFoundError("Orden de compra no encontrada");

  const buffer = await buildPdfBuffer((doc) => {
    doc.fontSize(16).text(`Orden de compra ${po.folio}`);
    doc.fontSize(10);
    doc.text(`Proveedor: ${po.supplier?.name}`);
    doc.text(`Solicitante: ${po.requestedByUser?.name}`);
    doc.text(`Autorizo: ${po.authorizedByUser?.name || "—"}`);
    doc.text(`Fecha solicitud: ${po.requestDate?.toISOString?.().slice(0, 10) || po.requestDate}`);
    doc.text(`Estatus: ${PO_STATUS_LABELS[po.status] || po.status}`);
    doc.text(`Produccion: ${po.productionOrder?.folio || "—"}`);
    if (po.comments) doc.text(`Comentarios: ${po.comments}`);
    doc.moveDown();
    drawTable(
      doc,
      [
        { key: "item", header: "Item", width: 200 },
        { key: "qty", header: "Cant.", width: 60 },
        { key: "price", header: "P. unit.", width: 80 },
        { key: "sub", header: "Subtotal", width: 80 },
        { key: "total", header: "Total", width: 92 },
      ],
      po.items.map((it) => ({
        item: `${it.item?.sku || ""} ${it.descriptionSnapshot}`,
        qty: String(toNumber(it.quantity)),
        price: formatMoney(it.unitPrice),
        sub: formatMoney(it.subtotal),
        total: formatMoney(it.total),
      }))
    );
    doc.moveDown();
    doc.text(`Subtotal: ${formatMoney(po.subtotal)}`);
    doc.text(`IVA: ${formatMoney(po.tax)}`);
    doc.font("Helvetica-Bold").text(`Total: ${formatMoney(po.total)}`);
  });

  await recordAudit({
    actor,
    module: "purchase_orders",
    entity: "PurchaseOrder",
    entityId: id,
    action: AUDIT_ACTIONS.PDF_GENERATE,
    newData: { folio: po.folio },
  });

  return pdfResponse(buffer, `oc-${po.folio}.pdf`);
}

export async function productionOrderPdf(request, id) {
  await requirePermission("production.print");
  const actor = await getActor(request);
  const order = await prisma.productionOrder.findFirst({
    where: { id },
    include: {
      client: true,
      quote: { select: { folio: true } },
      items: { orderBy: { position: "asc" } },
    },
  });
  if (!order) throw new NotFoundError("Orden de produccion no encontrada");

  const buffer = await buildPdfBuffer((doc) => {
    doc.fontSize(16).text(`Orden de produccion ${order.folio}`);
    doc.fontSize(10);
    doc.text(`Cliente: ${order.client?.commercialName || ""}`);
    doc.text(`Cotizacion: ${order.quote?.folio || "—"}`);
    doc.text(`Estatus: ${PRODUCTION_STATUS_LABELS[order.status] || order.status}`);
    doc.text(
      `Material listo: ${
        order.materialsReadyAt
          ? order.materialsReadyAt.toISOString?.().slice(0, 10) || order.materialsReadyAt
          : "No"
      }`
    );
    doc.moveDown();
    drawTable(
      doc,
      [
        { key: "pos", header: "#", width: 30 },
        { key: "desc", header: "Descripcion", width: 260 },
        { key: "qty", header: "Cant.", width: 50 },
        { key: "done", header: "Avance", width: 50 },
        { key: "mins", header: "Min", width: 50 },
        { key: "status", header: "Estatus", width: 72 },
      ],
      order.items.map((it) => ({
        pos: String(it.position),
        desc: it.description,
        qty: String(toNumber(it.quantity)),
        done: String(toNumber(it.completedQuantity)),
        mins: it.durationMinutes != null ? String(it.durationMinutes) : "—",
        status: PRODUCTION_STATUS_LABELS[it.status] || it.status,
      }))
    );
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionOrder",
    entityId: id,
    action: AUDIT_ACTIONS.PDF_GENERATE,
    newData: { folio: order.folio },
  });

  return pdfResponse(buffer, `produccion-${order.folio}.pdf`);
}

export async function quotationsReportPdf(request) {
  await requirePermission("reports.quotations_pdf");
  const actor = await getActor(request);
  const { searchParams } = new URL(request.url);
  const where = {
    deletedAt: null,
    ...(searchParams.get("status") ? { status: searchParams.get("status") } : {}),
    ...(searchParams.get("clientId")
      ? { clientId: searchParams.get("clientId") }
      : {}),
    ...(searchParams.get("sellerId")
      ? { sellerId: searchParams.get("sellerId") }
      : {}),
    ...(searchParams.get("currency")
      ? { currency: searchParams.get("currency") }
      : {}),
    ...(searchParams.get("issuingCompanyId")
      ? { issuingCompanyId: searchParams.get("issuingCompanyId") }
      : {}),
    ...(searchParams.get("dateFrom") || searchParams.get("dateTo")
      ? {
          elaborationDate: {
            ...(searchParams.get("dateFrom")
              ? { gte: new Date(searchParams.get("dateFrom")) }
              : {}),
            ...(searchParams.get("dateTo")
              ? { lte: new Date(searchParams.get("dateTo")) }
              : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.quote.findMany({
    where,
    include: {
      client: { select: { commercialName: true } },
      seller: { select: { name: true } },
    },
    orderBy: { elaborationDate: "desc" },
    take: 500,
  });

  const buffer = await buildPdfBuffer((doc) => {
    drawReportHeader(doc, {
      title: "Reporte de cotizaciones",
      generatedBy: actor.name,
      filters: filterList(searchParams),
    });
    drawTable(
      doc,
      [
        { key: "folio", header: "Folio", width: 70 },
        { key: "date", header: "Fecha", width: 70 },
        { key: "client", header: "Cliente", width: 120 },
        { key: "seller", header: "Vendedor", width: 90 },
        { key: "status", header: "Estatus", width: 80 },
        { key: "currency", header: "Mon.", width: 32 },
        { key: "total", header: "Total", width: 50 },
      ],
      rows.map((r) => ({
        folio: r.folio,
        date: String(r.elaborationDate).slice(0, 10),
        client: r.client?.commercialName || "",
        seller: r.seller?.name || "",
        status: QUOTE_STATUS_LABELS[r.status] || r.status,
        currency: r.currency,
        total: formatMoney(r.total),
      }))
    );
    const sum = rows.reduce((s, r) => s + toNumber(r.total), 0);
    drawFooterTotals(doc, {
      count: rows.length,
      totals: [{ label: "Total general", value: formatMoney(sum) }],
    });
  });

  await recordAudit({
    actor,
    module: "reports",
    entity: "QuotationsReport",
    entityId: null,
    action: AUDIT_ACTIONS.REPORT_GENERATE,
    newData: { count: rows.length },
  });

  return pdfResponse(buffer, "reporte-cotizaciones.pdf");
}

export async function productionReportPdf(request) {
  await requirePermission("reports.production_pdf");
  const actor = await getActor(request);
  const { searchParams } = new URL(request.url);
  const where = {
    ...(searchParams.get("status") ? { status: searchParams.get("status") } : {}),
    ...(searchParams.get("clientId")
      ? { clientId: searchParams.get("clientId") }
      : {}),
    ...(searchParams.get("sourceType")
      ? { sourceType: searchParams.get("sourceType") }
      : {}),
    ...(searchParams.get("dateFrom") || searchParams.get("dateTo")
      ? {
          approvalDate: {
            ...(searchParams.get("dateFrom")
              ? { gte: new Date(searchParams.get("dateFrom")) }
              : {}),
            ...(searchParams.get("dateTo")
              ? { lte: new Date(searchParams.get("dateTo")) }
              : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.productionOrder.findMany({
    where,
    include: {
      client: { select: { commercialName: true } },
      quote: { select: { folio: true } },
      directOrder: { select: { folio: true } },
    },
    orderBy: { approvalDate: "desc" },
    take: 500,
  });

  const buffer = await buildPdfBuffer((doc) => {
    drawReportHeader(doc, {
      title: "Reporte de estatus de produccion",
      generatedBy: actor.name,
      filters: filterList(searchParams),
    });
    drawTable(
      doc,
      [
        { key: "folio", header: "Folio", width: 70 },
        { key: "source", header: "Origen", width: 70 },
        { key: "client", header: "Cliente", width: 120 },
        { key: "progress", header: "Avance", width: 50 },
        { key: "status", header: "Estatus", width: 80 },
        { key: "approval", header: "Aprobacion", width: 70 },
        { key: "done", header: "Fin", width: 52 },
      ],
      rows.map((r) => ({
        folio: r.folio,
        source: r.quote?.folio || r.directOrder?.folio || "",
        client: r.client?.commercialName || "",
        progress: `${toNumber(r.progressPercentage)}%`,
        status: PRODUCTION_STATUS_LABELS[r.status] || r.status,
        approval: String(r.approvalDate).slice(0, 10),
        done: r.completedAt ? String(r.completedAt).slice(0, 10) : "—",
      }))
    );
    drawFooterTotals(doc, { count: rows.length });
  });

  await recordAudit({
    actor,
    module: "reports",
    entity: "ProductionReport",
    entityId: null,
    action: AUDIT_ACTIONS.REPORT_GENERATE,
    newData: { count: rows.length },
  });

  return pdfResponse(buffer, "reporte-produccion.pdf");
}

export async function inventoryReportPdf(request) {
  await requirePermission("reports.inventory_pdf");
  const actor = await getActor(request);
  const { searchParams } = new URL(request.url);
  const where = {
    ...(searchParams.get("warehouseId")
      ? { warehouseId: searchParams.get("warehouseId") }
      : {}),
    ...(searchParams.get("itemId") ? { itemId: searchParams.get("itemId") } : {}),
    ...(searchParams.get("movementType")
      ? { movementType: searchParams.get("movementType") }
      : {}),
    ...(searchParams.get("referenceType")
      ? { referenceType: searchParams.get("referenceType") }
      : {}),
    ...(searchParams.get("dateFrom") || searchParams.get("dateTo")
      ? {
          movementDate: {
            ...(searchParams.get("dateFrom")
              ? { gte: new Date(searchParams.get("dateFrom")) }
              : {}),
            ...(searchParams.get("dateTo")
              ? { lte: new Date(searchParams.get("dateTo")) }
              : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.inventoryMovement.findMany({
    where,
    include: {
      warehouse: { select: { name: true } },
      item: { select: { sku: true, name: true } },
      createdByUser: { select: { name: true } },
    },
    orderBy: { movementDate: "desc" },
    take: 500,
  });

  const buffer = await buildPdfBuffer((doc) => {
    drawReportHeader(doc, {
      title: "Reporte de movimientos de inventario",
      generatedBy: actor.name,
      filters: filterList(searchParams),
    });
    drawTable(
      doc,
      [
        { key: "folio", header: "Folio", width: 70 },
        { key: "date", header: "Fecha", width: 70 },
        { key: "wh", header: "Almacen", width: 80 },
        { key: "item", header: "Item", width: 100 },
        { key: "type", header: "Tipo", width: 70 },
        { key: "qty", header: "Cant.", width: 40 },
        { key: "user", header: "Usuario", width: 82 },
      ],
      rows.map((r) => ({
        folio: r.folio,
        date: String(r.movementDate).slice(0, 10),
        wh: r.warehouse?.name || "",
        item: r.item?.sku || "",
        type: MOVEMENT_TYPE_LABELS[r.movementType] || r.movementType,
        qty: String(toNumber(r.quantity)),
        user: r.createdByUser?.name || "",
      }))
    );
    drawFooterTotals(doc, { count: rows.length });
  });

  await recordAudit({
    actor,
    module: "reports",
    entity: "InventoryReport",
    entityId: null,
    action: AUDIT_ACTIONS.REPORT_GENERATE,
    newData: { count: rows.length },
  });

  return pdfResponse(buffer, "reporte-inventario.pdf");
}

export async function purchasesReportPdf(request) {
  await requirePermission("reports.purchases_pdf");
  const actor = await getActor(request);
  const { searchParams } = new URL(request.url);
  const where = {
    deletedAt: null,
    ...(searchParams.get("status") ? { status: searchParams.get("status") } : {}),
    ...(searchParams.get("supplierId")
      ? { supplierId: searchParams.get("supplierId") }
      : {}),
    ...(searchParams.get("requestedBy")
      ? { requestedBy: searchParams.get("requestedBy") }
      : {}),
    ...(searchParams.get("dateFrom") || searchParams.get("dateTo")
      ? {
          requestDate: {
            ...(searchParams.get("dateFrom")
              ? { gte: new Date(searchParams.get("dateFrom")) }
              : {}),
            ...(searchParams.get("dateTo")
              ? { lte: new Date(searchParams.get("dateTo")) }
              : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { name: true } },
    },
    orderBy: { requestDate: "desc" },
    take: 500,
  });

  const buffer = await buildPdfBuffer((doc) => {
    drawReportHeader(doc, {
      title: "Reporte de ordenes de compra",
      generatedBy: actor.name,
      filters: filterList(searchParams),
    });
    drawTable(
      doc,
      [
        { key: "folio", header: "Folio", width: 70 },
        { key: "supplier", header: "Proveedor", width: 140 },
        { key: "date", header: "Solicitud", width: 70 },
        { key: "status", header: "Estatus", width: 90 },
        { key: "sub", header: "Subtotal", width: 50 },
        { key: "tax", header: "IVA", width: 42 },
        { key: "total", header: "Total", width: 50 },
      ],
      rows.map((r) => ({
        folio: r.folio,
        supplier: r.supplier?.name || "",
        date: String(r.requestDate).slice(0, 10),
        status: PO_STATUS_LABELS[r.status] || r.status,
        sub: formatMoney(r.subtotal),
        tax: formatMoney(r.tax),
        total: formatMoney(r.total),
      }))
    );
    const sum = rows.reduce((s, r) => s + toNumber(r.total), 0);
    drawFooterTotals(doc, {
      count: rows.length,
      totals: [{ label: "Total general", value: formatMoney(sum) }],
    });
  });

  await recordAudit({
    actor,
    module: "reports",
    entity: "PurchasesReport",
    entityId: null,
    action: AUDIT_ACTIONS.REPORT_GENERATE,
    newData: { count: rows.length },
  });

  return pdfResponse(buffer, "reporte-compras.pdf");
}
