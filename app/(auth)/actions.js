"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/domains/auth/schemas";
import {
  requestPasswordReset,
  resetPassword,
} from "@/lib/auth/password-reset";

export async function loginAction(values) {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Datos invalidos." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        error: "Credenciales invalidas o usuario inactivo.",
      };
    }
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function forgotPasswordAction(values) {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Ingresa un correo valido." };
  }
  const headerList = await headers();
  const host = headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") || "http";
  const origin = host ? `${proto}://${host}` : undefined;

  await requestPasswordReset(parsed.data.email, origin);
  return { ok: true };
}

export async function resetPasswordAction(values) {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Datos invalidos." };
  }
  return resetPassword(parsed.data.token, parsed.data.password);
}
