import { QUALITY_INSPECTION_STATUS_LABELS } from "./drawing-constants.js";

function displayNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? String(Number(number.toFixed(4))) : String(value);
}

function inspectionDate(value) {
  if (!value) return "No indicada";
  return new Date(value).toLocaleDateString("es-MX");
}

function measurementReadings(measurement) {
  if (Array.isArray(measurement.readings) && measurement.readings.length) {
    return measurement.readings.map((reading) => ({
      value: displayNumber(reading.value),
      result: reading.result || measurement.result || "",
    }));
  }
  if (measurement.measuredValue === null || measurement.measuredValue === undefined) {
    return [];
  }
  return [
    {
      value: displayNumber(measurement.measuredValue),
      result: measurement.result || "",
    },
  ];
}

export function buildInspectionReportModel(inspection, logoPath = null) {
  const annotations = inspection.annotations || [];
  const measurementAnnotations = annotations.filter(
    (annotation) => annotation.annotationType === "MEASUREMENT" && annotation.measurement
  );
  const rows = measurementAnnotations.map((annotation) => {
    const measurement = annotation.measurement;
    return {
      label: annotation.label,
      nominal: displayNumber(measurement.nominalValue),
      unit: measurement.unit || "",
      instrument: measurement.instrument
        ? [measurement.instrument.code, measurement.instrument.type]
            .filter(Boolean)
            .join(" ")
        : "",
      readings: measurementReadings(measurement),
    };
  });
  const instruments = [
    ...new Map(
      measurementAnnotations
        .map((annotation) => annotation.measurement.instrument)
        .filter(Boolean)
        .map((instrument) => [instrument.id || instrument.code, instrument])
    ).values(),
  ];
  const failed = measurementAnnotations.some(
    (annotation) => annotation.measurement.result === "FAIL"
  );
  const passed = measurementAnnotations.some(
    (annotation) => annotation.measurement.result === "PASS"
  );
  const result =
    inspection.status !== "CLOSED"
      ? "PENDING"
      : failed
        ? "NON_CONFORMING"
        : passed
          ? "CONFORMING"
          : "PENDING";
  const notes = annotations
    .filter(
      (annotation) =>
        annotation.annotationType !== "MEASUREMENT" ||
        annotation.comment ||
        annotation.title ||
        annotation.measurement?.comments
    )
    .map((annotation) => {
      const description =
        annotation.comment ||
        annotation.title ||
        annotation.measurement?.comments ||
        "";
      return description
        ? `${annotation.label}: ${description}`
        : `${annotation.label}: ${annotation.annotationType}`;
    });
  if (inspection.generalComments) notes.unshift(inspection.generalComments);
  const maxReadings = Math.max(0, ...rows.map((row) => row.readings.length));
  const productionItem = inspection.productionItem || {};
  const qualityConfig = productionItem.qualityConfig;
  const order = inspection.productionOrder || {};
  const client = order.client || {};
  const sampleSize =
    qualityConfig?.sampleCountRequired ??
    (maxReadings ? String(maxReadings) : "No indicada");
  const frequency =
    qualityConfig?.inspectionMode === "SAMPLE" && qualityConfig.sampleEveryN
      ? `1 de cada ${qualityConfig.sampleEveryN}`
      : qualityConfig?.inspectionMode === "FULL"
        ? "Inspeccion 100%"
        : "No indicada";

  return {
    logoPath,
    workCode: order.folio || "No indicado",
    pieceQuantity: displayNumber(productionItem.quantity) || "No indicada",
    sampleSize: String(sampleSize),
    frequency,
    inspectionDate: inspectionDate(
      inspection.completedAt || inspection.startedAt || inspection.createdAt
    ),
    client: client.commercialName || client.legalName || "No indicado",
    projectName: productionItem.description || "No indicado",
    inspector: inspection.inspectedByUser?.name || "No asignado",
    instruments: instruments
      .map((instrument) => [instrument.code, instrument.type].filter(Boolean).join(" "))
      .join(", "),
    serialNumbers: instruments
      .map((instrument) => instrument.serialNumber)
      .filter(Boolean)
      .join(", "),
    rows,
    maxReadings,
    notes,
    result,
    status:
      QUALITY_INSPECTION_STATUS_LABELS[inspection.status] || inspection.status,
  };
}
