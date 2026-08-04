import { z } from "zod";
import {
  requiredString,
  optionalString,
  optionalEmail,
  statusWithDefault,
} from "@/lib/validations/common";

export const clientContactSchema = z.object({
  name: requiredString("El nombre del contacto es requerido"),
  position: optionalString,
  phone: optionalString,
  email: optionalEmail,
  isPrimary: z.coerce.boolean().default(false),
});

const optionalNonNegativeNumber = z.preprocess((v) => {
  if (v === "" || v == null) return null;
  return v;
}, z.coerce.number().finite().min(0, "Debe ser 0 o mayor").nullable().optional());

function mapCommercialTerms(data) {
  const {
    hasCommercialTerms,
    commercialTermsValue,
    commercialTerms,
    ...rest
  } = data;

  let terms = commercialTerms ?? null;
  if (hasCommercialTerms !== undefined) {
    if (!hasCommercialTerms) {
      terms = null;
    } else if (commercialTermsValue == null) {
      terms = null;
    } else {
      terms = String(commercialTermsValue);
    }
  }

  return {
    ...rest,
    commercialTerms: terms,
  };
}

const clientBaseObject = z.object({
  commercialName: requiredString("El nombre comercial es requerido"),
  legalName: optionalString,
  rfc: optionalString,
  address: optionalString,
  phone: optionalString,
  // Campos legacy / API: opcionales, ya no se capturan en el formulario.
  email: optionalEmail,
  mainContactName: optionalString,
  companyProfile: optionalString,
  commercialTerms: optionalString,
  hasCommercialTerms: z.coerce.boolean().optional(),
  commercialTermsValue: optionalNonNegativeNumber,
  status: statusWithDefault,
  contacts: z.array(clientContactSchema).default([]),
});

export const clientCreateSchema = clientBaseObject
  .superRefine((data, ctx) => {
    if (data.hasCommercialTerms && data.commercialTermsValue == null) {
      ctx.addIssue({
        code: "custom",
        path: ["commercialTermsValue"],
        message: "Indica el valor de las condiciones comerciales",
      });
    }
  })
  .transform(mapCommercialTerms);

export const clientUpdateSchema = clientBaseObject
  .partial()
  .superRefine((data, ctx) => {
    if (data.hasCommercialTerms && data.commercialTermsValue == null) {
      ctx.addIssue({
        code: "custom",
        path: ["commercialTermsValue"],
        message: "Indica el valor de las condiciones comerciales",
      });
    }
  })
  .transform(mapCommercialTerms);
