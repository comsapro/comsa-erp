import { QUALITY_STATUS } from "./drawing-constants.js";

/**
 * Convierte un indice 0-based a etiqueta estilo Excel: A, B, ... Z, AA, AB.
 */
export function excelColumnLabel(index) {
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("Indice de etiqueta invalido");
  }
  let value = n + 1;
  let label = "";
  while (value > 0) {
    const rem = (value - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

/**
 * Siguiente etiqueta disponible. No reutiliza etiquetas existentes
 * (incluye las de incisos eliminados logicamente).
 */
export function nextAnnotationLabel(existingLabels = []) {
  const used = new Set(
    (existingLabels || []).map((label) => String(label || "").toUpperCase())
  );
  let index = 0;
  while (index < 10000) {
    const label = excelColumnLabel(index);
    if (!used.has(label)) return label;
    index += 1;
  }
  throw new Error("No hay etiquetas disponibles");
}

function toNumber(value, field) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${field} es obligatorio`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${field} no es un numero valido`);
  }
  return n;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

/**
 * Calcula el resultado dimensional. Las tolerancias se tratan como magnitudes
 * (valor absoluto): min = nominal - |inferior|, max = nominal + |superior|.
 */
export function calculateMeasurementResult({
  nominalValue,
  measuredValue,
  upperTolerance,
  lowerTolerance,
}) {
  const nominal = toNumber(nominalValue, "Valor nominal");
  const measured = toNumber(measuredValue, "Valor medido");
  const upper = Math.abs(toNumber(upperTolerance, "Tolerancia superior"));
  const lower = Math.abs(toNumber(lowerTolerance, "Tolerancia inferior"));
  const minimum = round4(nominal - lower);
  const maximum = round4(nominal + upper);
  const measuredRounded = round4(measured);
  const result =
    measuredRounded >= minimum && measuredRounded <= maximum ? "PASS" : "FAIL";
  return { minimum, maximum, result };
}

export function clampNormalized(value, field = "coordenada") {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${field} invalida`);
  }
  if (n < 0 || n > 1) {
    throw new Error(`${field} debe estar entre 0 y 1`);
  }
  return n;
}

/**
 * Estado de calidad de una partida a partir de sus inspecciones
 * (la mas reciente primero).
 */
export function computeQualityStatus(inspections = []) {
  if (!inspections.length) return QUALITY_STATUS.NOT_INSPECTED;
  const latest = inspections[0];
  if (latest.status === "COMPLETED") return QUALITY_STATUS.PASSED;
  if (latest.status === "REJECTED") return QUALITY_STATUS.FAILED;
  if (latest.status === "DRAFT" || latest.status === "IN_PROGRESS") {
    return QUALITY_STATUS.IN_PROGRESS;
  }
  return QUALITY_STATUS.NOT_INSPECTED;
}

export function summarizeAnnotations(annotations = []) {
  const active = (annotations || []).filter((row) => !row.deletedAt);
  let measurementsPassed = 0;
  let measurementsFailed = 0;
  let comments = 0;
  let observations = 0;
  for (const row of active) {
    if (row.annotationType === "MEASUREMENT") {
      const result = row.measurement?.result || row.status;
      if (result === "PASS") measurementsPassed += 1;
      else if (result === "FAIL") measurementsFailed += 1;
    } else if (row.annotationType === "COMMENT") {
      comments += 1;
    } else if (row.annotationType === "OBSERVATION") {
      observations += 1;
    }
  }
  return {
    annotationCount: active.length,
    measurementsPassed,
    measurementsFailed,
    comments,
    observations,
  };
}

export function isPdfFile(fileName, contentType) {
  const type = String(contentType || "").toLowerCase();
  const name = String(fileName || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}
