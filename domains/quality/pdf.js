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
    include: {
      measurement: {
        include: {
          instrument: {
            select: {
              code: true,
              type: true,
              serialNumber: true,
              lastCalibrationAt: true,
              nextCalibrationAt: true,
            },
          },
        },
      },
    },
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
    const readings = Array.isArray(m?.readings) ? m.readings : [];
    const measuredText = readings.length
      ? readings
          .map(
            (r) =>
              `M${r.index}:${fmt(r.value)}${r.result === "PASS" ? " OK" : r.result === "FAIL" ? " NO" : ""}`
          )
          .join(" | ")
      : m
        ? fmt(m.measuredValue)
        : "";
    const instrument = m?.instrument
      ? `${m.instrument.code}${m.instrument.serialNumber ? ` (${m.instrument.serialNumber})` : ""}`
      : "";
    return {
      label: row.label,
      page: String(row.pageNumber),
      nominal: m ? `${fmt(m.nominalValue)} ${m.unit || ""}`.trim() : "",
      tolerance: toleranceText(m),
      instrument,
      measured: measuredText,
      result: m
        ? m.result === "PASS"
          ? "OK"
          : m.result === "FAIL"
            ? "NO OK"
            : m.result
        : row.status === "OPEN"
          ? ""
          : row.status,
      comment: row.title || row.comment || "",
    };
  });

  const instrumentsUsed = [
    ...new Map(
      inspection.annotations
        .map((row) => row.measurement?.instrument)
        .filter(Boolean)
        .map((row) => [row.code, row])
    ).values(),
  ];

  const buffer = await buildPdfBuffer((doc) => {
    drawReportHeader(doc, {
      title: "COMSA PRO - Reporte de inspeccion dimensional",
      generatedBy: actor.name,
    });
    doc.fontSize(10);
    doc.text(`Folio inspeccion: ${inspection.inspectionNumber}`);
    doc.text(`Codigo de trabajo: ${inspection.productionOrder.folio}`);
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

    if (instrumentsUsed.length) {
      doc.font("Helvetica-Bold").text("Instrumentos utilizados");
      doc.font("Helvetica");
      for (const instrument of instrumentsUsed) {
        doc.text(
          `${instrument.code} · ${instrument.type || ""}${
            instrument.serialNumber ? ` · Serie ${instrument.serialNumber}` : ""
          } · Ult. cal. ${
            instrument.lastCalibrationAt
              ? new Date(instrument.lastCalibrationAt).toLocaleDateString("es-MX")
              : "-"
          } · Prox. ${
            instrument.nextCalibrationAt
              ? new Date(instrument.nextCalibrationAt).toLocaleDateString("es-MX")
              : "-"
          }`
        );
      }
      doc.moveDown(0.5);
    }

    drawTable(
      doc,
      [
        { header: "Int.", width: 28 },
        { header: "Pag", width: 28 },
        { header: "Nominal", width: 70 },
        { header: "Tol.", width: 55 },
        { header: "Instrumento", width: 90 },
        { header: "Mediciones", width: 150 },
        { header: "Res.", width: 40 },
        { header: "Descripcion", width: 91 },
      ],
      rows
    );

    doc.moveDown();
    doc.fontSize(10).font("Helvetica-Bold").text("Resumen");
    doc.font("Helvetica");
    doc.text(
      `Intervalos: ${summary.measurementsPassed + summary.measurementsFailed}  |  OK: ${summary.measurementsPassed}  |  NO OK: ${summary.measurementsFailed}`
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

export async function reworkOrderPdf(request, reworkOrderId) {
  await requirePermission("quality.print");
  const actor = await getActor(request);
  const record = await prisma.qualityReworkOrder.findFirst({
    where: { id: reworkOrderId },
    include: {
      productionOrder: {
        include: {
          client: { select: { commercialName: true, legalName: true } },
        },
      },
      productionItem: {
        select: { position: true, description: true, quantity: true },
      },
      pieces: {
        include: {
          qualityPiece: {
            select: { label: true, pieceNumber: true, status: true },
          },
        },
      },
      createdByUser: { select: { name: true } },
      responsible: { select: { name: true } },
      hours: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!record) throw new NotFoundError("Orden de retrabajo no encontrada");

  const processes = Array.isArray(record.selectedProcesses)
    ? record.selectedProcesses
    : String(record.processName || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ name }));

  const clientName =
    record.productionOrder?.client?.commercialName ||
    record.productionOrder?.client?.legalName ||
    "—";

  const buffer = await buildPdfBuffer((doc) => {
    drawReportHeader(doc, {
      title: `Orden de retrabajo ${record.folio}`,
      generatedBy: actor?.name || record.createdByUser?.name,
    });

    doc.fontSize(11).font("Helvetica-Bold").text("Datos generales");
    doc.font("Helvetica").fontSize(10);
    doc.text(`OP: ${record.productionOrder?.folio || "—"}`);
    doc.text(`Cliente: ${clientName}`);
    doc.text(
      `Partida: #${record.productionItem?.position ?? "—"} · ${
        record.productionItem?.description || ""
      }`
    );
    doc.text(`Estatus: ${record.status}`);
    doc.text(
      `Solicitado: ${new Date(record.requestedAt).toLocaleString("es-MX")}`
    );
    if (record.responsible?.name) {
      doc.text(`Responsable: ${record.responsible.name}`);
    }
    doc.moveDown(0.6);

    doc.font("Helvetica-Bold").text("Motivo");
    doc.font("Helvetica").text(record.cause || "—");
    doc.moveDown(0.4);

    if (record.instructions) {
      doc.font("Helvetica-Bold").text("Instrucciones");
      doc.font("Helvetica").text(record.instructions);
      doc.moveDown(0.4);
    }

    doc.font("Helvetica-Bold").text("Procesos requeridos");
    doc.font("Helvetica");
    if (processes.length === 0) {
      doc.text("Sin procesos indicados");
    } else {
      for (const [idx, row] of processes.entries()) {
        doc.text(`${idx + 1}. ${row.name || row}`);
      }
    }
    doc.moveDown(0.6);

    const pieceRows = (record.pieces || []).map((row) => [
      row.qualityPiece?.label || `Pieza ${row.qualityPiece?.pieceNumber || ""}`,
      row.qualityPiece?.status || "",
    ]);
    doc.font("Helvetica-Bold").text("Piezas");
    doc.moveDown(0.2);
    drawTable(
      doc,
      [
        { header: "Pieza", width: 280 },
        { header: "Estatus", width: 200 },
      ],
      pieceRows.length ? pieceRows : [["—", "—"]]
    );

    if (record.hours?.length) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").text("Horas registradas");
      doc.moveDown(0.2);
      drawTable(
        doc,
        [
          { header: "Proceso", width: 280 },
          { header: "Horas", width: 200 },
        ],
        record.hours.map((h) => [h.processName, String(h.hours)])
      );
    }
  });

  await recordAudit({
    actor,
    module: "quality",
    entity: "QualityReworkOrder",
    entityId: record.id,
    action: AUDIT_ACTIONS.PDF_GENERATE,
    newData: { kind: "rework_order", folio: record.folio },
  });

  return pdfResponse(buffer, `retrabajo-${record.folio}.pdf`, {
    disposition: "inline",
  });
}
