import { z } from "zod";
import {
  requiredString,
  optionalString,
  statusWithDefault,
} from "@/lib/validations/common";

export const roleCreateSchema = z.object({
  name: requiredString("El nombre es requerido"),
  description: optionalString,
  permissionCodes: z.array(z.string()).default([]),
  status: statusWithDefault,
});

export const roleUpdateSchema = roleCreateSchema.partial();
