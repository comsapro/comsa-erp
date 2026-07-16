import "server-only";
import { getCurrentUser } from "@/lib/auth/session";

// Construye el "actor" (usuario + metadatos de request) para autoria y auditoria.
export async function getActor(request) {
  const user = await getCurrentUser();
  const headers = request?.headers;
  const ip =
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers?.get("x-real-ip") ||
    null;
  const userAgent = headers?.get("user-agent") || null;

  return {
    id: user?.id || null,
    name: user?.name || null,
    ip,
    userAgent,
  };
}
