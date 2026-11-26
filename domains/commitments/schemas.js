import { z } from "zod";

const dateKey = (message) =>
  z
    .string({ message })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message);

export const commitmentSchema = z
  .object({
    title: z.string().trim().min(1, "Indica el compromiso").max(200),
    description: z.string().trim().max(5000).optional().nullable(),
    startDate: dateKey("Fecha de inicio requerida"),
    dueDate: dateKey("Fecha de entrega requerida"),
    participantIds: z
      .array(z.string().min(1))
      .min(1, "Agrega al menos un involucrado")
      .max(50),
  })
  .superRefine((data, ctx) => {
    if (data.dueDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La entrega no puede ser antes del inicio",
        path: ["dueDate"],
      });
    }
  });

export const commitmentActionSchema = z
  .object({
    action: z.enum(["comment", "done", "reopen", "approve", "reject", "cancel"]),
    body: z.string().trim().max(5000).optional().nullable(),
    file: z
      .object({
        pathname: z.string().min(1),
        fileName: z.string().min(1).max(255),
        contentType: z.string().max(200).optional().nullable(),
        sizeBytes: z.coerce.number().int().min(0).optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "comment" && !data.body && !data.file) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escribe un comentario o adjunta evidencia", path: ["body"] });
    }
    if (data.action === "reject" && !data.body) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Indica por qué no se aprueba", path: ["body"] });
    }
  });
