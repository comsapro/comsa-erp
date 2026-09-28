import { z } from "zod";
import { optionalString } from "@/lib/validations/common";
import {
  ANNOTATION_STATUSES,
  ANNOTATION_TYPES,
  MEASUREMENT_UNITS,
  QUALITY_DOCUMENT_TYPES,
} from "./drawing-constants";

const id = z.string().min(1);

const coordinate = z.coerce
  .number()
  .min(0, "La coordenada debe ser >= 0")
  .max(1, "La coordenada debe ser <= 1");

const decimalValue = z.coerce.number().finite();

const measurementFields = z.object({
  nominalValue: decimalValue,
  measuredValue: decimalValue,
  upperTolerance: decimalValue,
  lowerTolerance: decimalValue,
  unit: z.enum(MEASUREMENT_UNITS),
  unitOther: optionalString,
  comments: optionalString,
});

export const createInspectionSchema = z
  .object({
    productionItemId: id,
    qualityDocumentVersionId: z.string().optional().nullable(),
    quoteItemAttachmentId: z.string().optional().nullable(),
    productionAttachmentId: z.string().optional().nullable(),
    qualityDocumentId: z.string().optional().nullable(),
    documentType: z.enum(QUALITY_DOCUMENT_TYPES).optional(),
    generalComments: optionalString,
  })
  .refine(
    (value) =>
      Boolean(
        value.qualityDocumentVersionId ||
          value.qualityDocumentId ||
          value.quoteItemAttachmentId ||
          value.productionAttachmentId
      ),
    {
      message: "Indica un plano o una version de documento",
      path: ["qualityDocumentVersionId"],
    }
  );

export const updateInspectionSchema = z.object({
  generalComments: optionalString,
});

export const completeInspectionSchema = z.object({
  generalComments: optionalString,
  result: z.enum(["COMPLETED", "REJECTED"]),
});

export const createDocumentSchema = z
  .object({
    productionItemId: id,
    quoteItemAttachmentId: z.string().optional().nullable(),
    productionAttachmentId: z.string().optional().nullable(),
    documentType: z.enum(QUALITY_DOCUMENT_TYPES).optional(),
    pathname: z.string().optional().nullable(),
    fileName: z.string().optional().nullable(),
    contentType: z.string().optional().nullable(),
    sizeBytes: z.coerce.number().optional().nullable(),
  })
  .refine(
    (value) =>
      Boolean(
        value.quoteItemAttachmentId ||
          value.productionAttachmentId ||
          value.pathname
      ),
    { message: "Indica un archivo origen", path: ["pathname"] }
  );

export const createVersionSchema = z
  .object({
    quoteItemAttachmentId: z.string().optional().nullable(),
    productionAttachmentId: z.string().optional().nullable(),
    pathname: z.string().optional().nullable(),
    fileName: z.string().optional().nullable(),
    contentType: z.string().optional().nullable(),
    sizeBytes: z.coerce.number().optional().nullable(),
  })
  .refine(
    (value) =>
      Boolean(
        value.quoteItemAttachmentId ||
          value.productionAttachmentId ||
          value.pathname
      ),
    { message: "Indica el archivo de la nueva revision", path: ["pathname"] }
  );

export const registerQualityUploadSchema = z.object({
  productionItemId: id,
  pathname: z.string().min(1),
  fileName: z.string().optional().nullable(),
  contentType: z.string().optional().nullable(),
  sizeBytes: z.coerce.number().optional().nullable(),
  documentType: z.enum(QUALITY_DOCUMENT_TYPES).optional(),
  qualityDocumentId: z.string().optional().nullable(),
});

const annotationBase = z.object({
  pageNumber: z.coerce.number().int().min(1),
  xPosition: coordinate,
  yPosition: coordinate,
  annotationType: z.enum(ANNOTATION_TYPES),
  title: optionalString,
  comment: optionalString,
  status: z.enum(ANNOTATION_STATUSES).optional(),
  measurement: measurementFields.optional().nullable(),
});

export const createAnnotationSchema = annotationBase.superRefine((value, ctx) => {
  if (value.annotationType === "MEASUREMENT" && !value.measurement) {
    ctx.addIssue({
      code: "custom",
      message: "Los datos de medicion son obligatorios",
      path: ["measurement"],
    });
  }
});

export const updateAnnotationSchema = z
  .object({
    title: optionalString,
    comment: optionalString,
    status: z.enum(ANNOTATION_STATUSES).optional(),
    annotationType: z.enum(ANNOTATION_TYPES).optional(),
    measurement: measurementFields.optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.annotationType === "MEASUREMENT" && value.measurement == null) {
      ctx.addIssue({
        code: "custom",
        message: "Los datos de medicion son obligatorios",
        path: ["measurement"],
      });
    }
  });

export const moveAnnotationSchema = z.object({
  pageNumber: z.coerce.number().int().min(1).optional(),
  xPosition: coordinate,
  yPosition: coordinate,
});
