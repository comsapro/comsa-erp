import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// Envio de correo. En dev (sin SMTP configurado) imprime el enlace en consola.
async function deliverResetEmail(email, resetUrl) {
  if (!process.env.SMTP_HOST) {
    console.log(
      `[recuperar-acceso] Enlace para ${email}: ${resetUrl} (valido 1 hora)`
    );
    return;
  }
  // En staging/produccion se integra un transporte SMTP real aqui.
  console.log(`[recuperar-acceso] (SMTP) enviar a ${email}: ${resetUrl}`);
}

// Solicita un restablecimiento. No revela si el correo existe.
export async function requestPasswordReset(email, origin) {
  const normalized = String(email || "").toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (user && !user.deletedAt && user.status === "ACTIVE") {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    // Invalida tokens previos no usados del usuario.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const base = origin || process.env.AUTH_URL || "http://localhost:3000";
    const resetUrl = `${base}/recuperar-acceso?token=${rawToken}`;
    await deliverResetEmail(normalized, resetUrl);
  }

  // Respuesta uniforme.
  return { ok: true };
}

// Restablece la contrasena a partir de un token valido.
export async function resetPassword(rawToken, newPassword) {
  const tokenHash = hashToken(String(rawToken || ""));
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !record ||
    record.usedAt ||
    record.expiresAt < new Date() ||
    !record.user ||
    record.user.deletedAt ||
    record.user.status !== "ACTIVE"
  ) {
    return { ok: false, error: "El enlace es invalido o expiro." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
