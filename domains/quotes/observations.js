import { z } from "zod";

export const CLIENT_OBSERVATIONS_MAX = 20000;

export const quoteItemNoteSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .string()
    .trim()
    .max(
      CLIENT_OBSERVATIONS_MAX,
      "Las observaciones admiten hasta 20,000 caracteres"
    )
    .nullable()
    .optional()
);
