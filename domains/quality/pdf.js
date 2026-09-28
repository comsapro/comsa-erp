import "server-only";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { NotFoundError } from "@/lib/permissions/errors";
import {
  buildPdfBuffer,
  pdfResponse,
  drawReportHeader,
  drawTable,
} from "@/lib/pdf/helpers";
import {
  ANNOTATION_TYPE_LABELS,
  QUALITY_INSPECTION_STATUS_LABELS,
} from "./drawing-constants";
import { summarizeAnnotations } from "./calculations";
import { getBlobBuffer } from "./documents";

const DETAIL_INCLUDE = {
  productionOrder: {
    include: {
      client: { select: { commercialName: true, legalName: true } },
    },
  },
  productionItem: {
    select: { position: true, description: true, quantity: true },
  },
  qualityDocumentVersion: {
    include: { qualityDocument: true },
  },
  inspectedByUser: { select: { name: true } },
  annotations: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { measurement: true },
  },
};

async function loadInspectionOrThrow(id) {
  const record = await prisma.qualityDrawingInspection.findFirst({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError("Inspeccion no encontrada");
  return record;
}

function fmt(value, digits = 4) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return String(Number(n.toFixed(digits)));
}

function toleranceText(measurement) {
  if (!measurement) return "";
  const upper = fmt(measurement.upperTolerance);
  const lower = fmt(measurement.lowerTolerance);
  if (upper === lower) return `+/- ${upper}`;
  return `+${upper} / -${lower}`;
}

export async function inspectionReportPdf(request, id) {
  await requirePermission("quality.print");
  const actor = await getActor(request);
  const inspection = await loadInspectionOrThrow(id);
  const summary = summarizeAnnotations(inspection.annotations);
  const clientName =
    inspection.productionOrder.client?.commercialName ||
    inspection.productionOrder.client?.legalName ||
    "-";
  const version = inspection.qualityDocumentVersion;
  const inspector = inspection.inspectedByUser?.name || "-";
  const date = inspection.completedAt || inspection.startedAt || inspection.createdAt;

  const rows = inspection.annotations.map((row) => {
    const m = row.measurement;
    return {
      label: row.label,
      page: String(row.pageNumber),
      type: ANNOTATION_TYPE_LABELS[row.annotationType] || row.annotationType,
      nominal: m ? fmt(m.nominalValue) : "",
      measured: m ? fmt(m.measuredValue) : "",
      tolerance: toleranceText(m),
      result: m ? m.result : row.status === "OPEN" ? "" : row.status,
      comment: row.comment || row.title || "",
    };
  });

  const buffer = await buildPdfBuffer((doc) => {
    drawReportHeader(doc, {
      title: "COMSA PRO - Inspeccion de calidad",
      generatedBy: actor.name,
    });
    doc.fontSize(10);
    doc.text(`Folio inspeccion: ${inspection.inspectionNumber}`);
    doc.text(`Orden de produccion: ${inspection.productionOrder.folio}`);
    doc.text(
      `Partida: #${inspection.productionItem.position} ${inspection.productionItem.description}`
    );
    doc.text(`Cliente: ${clientName}`);
    doc.text(`Plano: ${version.originalFilename}`);
    doc.text(`Revision: ${version.versionNumber}`);
    doc.text(`Inspector: ${inspector}`);
    doc.text(`Fecha: ${new Date(date).toLocaleString("es-MX")}`);
    doc.text(
      `Estatus: ${QUALITY_INSPECTION_STATUS_LABELS[inspection.status] || inspection.status}`
    );
    doc.moveDown();

    drawTable(
      doc,
      [
        { header: "Inciso", width: 40 },
        { header: "Pag", width: 28 },
        { header: "Tipo", width: 70 },
        { header: "Nominal", width: 55 },
        { header: "Medido", width: 55 },
        { header: "Tol.", width: 70 },
        { header: "Res.", width: 40 },
        { header: "Comentario", width: 154 },
      ],
      rows
    );

    doc.moveDown();
    doc.fontSize(10).font("Helvetica-Bold").text("Resumen");
    doc.font("Helvetica");
    doc.text(
      `Mediciones: ${summary.measurementsPassed + summary.measurementsFailed}  |  Pasa: ${summary.measurementsPassed}  |  No pasa: ${summary.measurementsFailed}`
    );
    doc.text(`Comentarios: ${summary.comments}`);
    doc.text(`Observaciones: ${summary.observations}`);
    doc.text(
      `Resultado final: ${QUALITY_INSPECTION_STATUS_LABELS[inspection.status] || inspection.status}`
    );
    if (inspection.generalComments) {
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").text("Comentarios generales");
      doc.font("Helvetica").text(inspection.generalComments);
    }
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityInspection",
    entityId: id,
    action: AUDIT_ACTIONS.PDF_GENERATE,
    newData: { kind: "report", inspectionNumber: inspection.inspectionNumber },
  });

  return pdfResponse(
    buffer,
    `calidad-${inspection.inspectionNumber}-reporte.pdf`
  );
}

export async function annotatedDrawingPdf(request, id) {
  await requirePermission("quality.print");
  const actor = await getActor(request);
  const inspection = await loadInspectionOrThrow(id);
  const version = inspection.qualityDocumentVersion;
  const sourceBytes = await getBlobBuffer(version.pathname);

  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  const byPage = new Map();
  for (const row of inspection.annotations) {
    const list = byPage.get(row.pageNumber) || [];
    list.push(row);
    byPage.set(row.pageNumber, list);
  }

  for (const [pageNumber, annotations] of byPage.entries()) {
    const page = pages[pageNumber - 1];
    if (!page) continue;
    const { width, height } = page.getSize();
    for (const row of annotations) {
      const xNorm = Number(row.xPosition);
      const yNorm = Number(row.yPosition);
      const cx = xNorm * width;
      const cy = (1 - yNorm) * height;
      const radius = Math.max(8, Math.min(width, height) * 0.012);
      page.drawCircle({
        x: cx,
        y: cy,
        size: radius,
        color: rgb(0.05, 0.25, 0.55),
        opacity: 0.92,
      });
      const label = String(row.label || "");
      const fontSize = label.length > 2 ? radius * 0.9 : radius * 1.1;
      const textWidth = font.widthOfTextAtSize(label, fontSize);
      page.drawText(label, {
        x: cx - textWidth / 2,
        y: cy - fontSize / 3,
        size: fontSize,
        font,
        color: rgb(1, 1, 1),
      });
    }
  }

  if (!version.pageCount || version.pageCount !== pages.length) {
    await prisma.qualityDocumentVersion.update({
      where: { id: version.id },
      data: { pageCount: pages.length },
    });
  }

  const stamped = Buffer.from(await pdf.save());

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityInspection",
    entityId: id,
    action: AUDIT_ACTIONS.PDF_GENERATE,
    newData: {
      kind: "annotated_drawing",
      inspectionNumber: inspection.inspectionNumber,
      pages: pages.length,
    },
  });

  return pdfResponse(
    stamped,
    `calidad-${inspection.inspectionNumber}-plano.pdf`
  );
}
