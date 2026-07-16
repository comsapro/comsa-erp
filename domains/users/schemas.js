import { z } from "zod";
import { requiredString, statusWithDefault } from "@/lib/validations/common";

const passwordSchema = z
  .string()
  .min(8, "Minimo 8 caracteres")
  .regex(/[a-zA-Z]/, "Debe contener al menos una letra")
  .regex(/[0-9]/, "Debe contener al menos un numero");

export const userCreateSchema = z.object({
  name: requiredString("El nombre es requerido"),
  email: z.email("Correo invalido").trim().toLowerCase(),
  password: passwordSchema,
  roleIds: z.array(z.string()).default([]),
  mustChangePassword: z.coerce.boolean().default(false),
  status: statusWithDefault,
});

export const userUpdateSchema = z.object({
  name: requiredString("El nombre es requerido").optional(),
  email: z.email("Correo invalido").trim().toLowerCase().optional(),
  // Password opcional: vacio => no cambia.
  password: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    passwordSchema.optional()
  ),
  roleIds: z.array(z.string()).optional(),
  mustChangePassword: z.coerce.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
