import { z } from "zod";
import {
  QUALITY_INSPECTION_MODES,
  QUALITY_INSPECTION_TYPES,
  QUALITY_RESULTS,
  QUALITY_SPECIAL_CHECK_TYPES,
  QUALITY_REWORK_STATUSES,
  INSTRUMENT_STATUSES,
  QUALITY_ALERT_STATUS,
  QUALITY_EVIDENCE_STAGES,
} from "./constants";

export const quantityUpdateSchema = z.object({
  fabricatedQty: z.coerce.number().min(0),
  notes: z.string().optional().nullable(),
});

export const samplingConfigSchema = z
  .object({
    inspectionMode: z.enum(QUALITY_INSPECTION_MODES),
    sampleEveryN: z.coerce.number().int().positive().optional().nullable(),
    requiresFirstPiece: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.inspectionMode === "SAMPLE" && !data.sampleEveryN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica la frecuencia de muestreo (1 de cada N)",
        path: ["sampleEveryN"],
      });
    }
  });

export const ensurePiecesSchema = z.object({
  count: z.coerce.number().int().positive().optional(),
});

export const startInspectionSchema = z.object({
  type: z.enum(QUALITY_INSPECTION_TYPES),
  qualityPieceId: z.string().optional().nullable(),
  instrumentId: z.string().optional().nullable(),
  allowExpiredInstrument: z.boolean().optional().default(false),
});

export const measurementSchema = z.object({
  label: z.string().min(1),
  nominal: z.string().optional().nullable(),
  tolerancePlus: z.string().optional().nullable(),
  toleranceMinus: z.string().optional().nullable(),
  measuredValue: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  result: z.enum(QUALITY_RESULTS).default("PENDING"),
  observations: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});

export const specialCheckSchema = z.object({
  checkType: z.enum(QUALITY_SPECIAL_CHECK_TYPES),
  required: z.boolean().optional().default(false),
  method: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  expectedValue: z.string().optional().nullable(),
  obtainedValue: z.string().optional().nullable(),
  result: z.enum(QUALITY_RESULTS).default("PENDING"),
  instrumentId: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  reportPathname: z.string().optional().nullable(),
  reportFileName: z.string().optional().nullable(),
});

export const closeInspectionSchema = z.object({
  result: z.enum(["CONFORMING", "NON_CONFORMING"]),
  observations: z.string().optional().nullable(),
  measurements: z.array(measurementSchema).optional().default([]),
  specialChecks: z.array(specialCheckSchema).optional().default([]),
});

export const ncrSchema = z.object({
  qualityInspectionId: z.string().min(1),
  qualityPieceId: z.string().optional().nullable(),
  description: z.string().min(1),
  area: z.string().optional().nullable(),
  processName: z.string().optional().nullable(),
  operatorId: z.string().optional().nullable(),
});

export const missingProcessSchema = z.object({
  qualityInspectionId: z.string().min(1),
  productionItemId: z.string().min(1),
  processName: z.string().min(1),
  manufacturingProcessId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const reworkOrderSchema = z.object({
  productionItemId: z.string().min(1),
  qualityPieceIds: z.array(z.string()).min(1),
  cause: z.string().min(1),
  instructions: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  processName: z.string().optional().nullable(),
  operatorName: z.string().optional().nullable(),
  materialUsed: z.string().optional().nullable(),
  expectedEndAt: z.coerce.date().optional().nullable(),
  responsibleId: z.string().optional().nullable(),
});

export const reworkSimpleSchema = z.object({
  productionItemId: z.string().min(1),
  qualityPieceId: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  processName: z.string().optional().nullable(),
  operatorName: z.string().optional().nullable(),
  errorDescription: z.string().min(1),
  hoursUsed: z.coerce.number().min(0).default(0),
});

export const reworkHourSchema = z.object({
  processName: z.string().min(1),
  hours: z.coerce.number().positive(),
  notes: z.string().optional().nullable(),
});

export const instrumentSchema = z.object({
  code: z.string().trim().min(1),
  type: z.string().trim().min(1),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  range: z.string().optional().nullable(),
  resolution: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  acquiredAt: z.coerce.date().optional().nullable(),
  calibrationPeriodDays: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(INSTRUMENT_STATUSES).optional(),
});

export const calibrationSchema = z.object({
  calibratedAt: z.coerce.date(),
  nextDueAt: z.coerce.date().optional().nullable(),
  provider: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  certificatePathname: z.string().optional().nullable(),
  certificateFileName: z.string().optional().nullable(),
  certificateUrl: z.string().optional().nullable(),
});

export const alertStatusSchema = z.object({
  status: z.enum(QUALITY_ALERT_STATUS),
});

export const externalShareSchema = z.object({
  qualityPieceId: z.string().optional().nullable(),
  productionItemId: z.string().optional().nullable(),
  productionOrderId: z.string().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  showEvidences: z.boolean().optional().default(true),
});

export const releaseFirstPieceSchema = z.object({
  qualityPieceId: z.string().min(1),
  qualityInspectionId: z.string().min(1),
  observations: z.string().optional().nullable(),
});

export const evidenceSchema = z.object({
  pathname: z.string().min(1),
  url: z.string().optional().nullable(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.coerce.number().int().nonnegative(),
  stage: z.enum(QUALITY_EVIDENCE_STAGES).default("INSPECTION"),
  productionOrderId: z.string().optional().nullable(),
  productionItemId: z.string().optional().nullable(),
  qualityPieceId: z.string().optional().nullable(),
  qualityInspectionId: z.string().optional().nullable(),
  specialCheckId: z.string().optional().nullable(),
  nonConformanceId: z.string().optional().nullable(),
  reworkOrderId: z.string().optional().nullable(),
  reworkSimpleId: z.string().optional().nullable(),
});
