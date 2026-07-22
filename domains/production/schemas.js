import { z } from "zod";
import { optionalString } from "@/lib/validations/common";

export const updateItemProgressSchema = z.object({
  completedQuantity: z.coerce.number().min(0),
  observations: optionalString,
});
