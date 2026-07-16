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

export const clientCreateSchema = z.object({
  commercialName: requiredString("El nombre comercial es requerido"),
  legalName: optionalString,
  rfc: optionalString,
  address: optionalString,
  phone: optionalString,
  email: optionalEmail,
  mainContactName: optionalString,
  companyProfile: optionalString,
  commercialTerms: optionalString,
  status: statusWithDefault,
  contacts: z.array(clientContactSchema).default([]),
});

export const clientUpdateSchema = clientCreateSchema.partial();
