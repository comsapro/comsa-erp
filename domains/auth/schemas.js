import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Ingresa un correo valido").trim(),
  password: z.string().min(1, "La contrasena es requerida"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Ingresa un correo valido").trim(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token requerido"),
    password: z
      .string()
      .min(8, "Debe tener al menos 8 caracteres")
      .regex(/[a-zA-Z]/, "Debe contener al menos una letra")
      .regex(/[0-9]/, "Debe contener al menos un numero"),
    confirmPassword: z.string().min(1, "Confirma la contrasena"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contrasenas no coinciden",
    path: ["confirmPassword"],
  });
