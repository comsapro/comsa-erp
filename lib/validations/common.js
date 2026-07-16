import { z } from "zod";

// Cadena requerida con trim y mensaje personalizable.
export function requiredString(message = "Campo requerido", max = 255) {
  return z.string().trim().min(1, message).max(max);
}

// Cadena opcional: "" -> null, ausente -> undefined.
export const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(2000).nullable().optional()
);

// Correo opcional.
export const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.email("Correo invalido").nullable().optional()
);

// Estatus de registro.
export const statusEnum = z.enum(["ACTIVE", "INACTIVE"]);

export const statusWithDefault = statusEnum.default("ACTIVE");
