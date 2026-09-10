import { z } from "zod";
import {
  requiredString,
  optionalString,
  statusWithDefault,
} from "@/lib/validations/common";

export const teamCreateSchema = z.object({
  name: requiredString("El nombre es requerido"),
  description: optionalString,
  status: statusWithDefault,
  userIds: z.array(z.string().min(1)).default([]),
  roleIds: z.array(z.string().min(1)).default([]),
});

export const teamUpdateSchema = teamCreateSchema.partial();

export const teamMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).default([]),
});

export const teamRolesSchema = z.object({
  roleIds: z.array(z.string().min(1)).default([]),
});
