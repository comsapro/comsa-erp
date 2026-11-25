import { prisma } from "@/lib/db";
import { rejectStaleQuotes } from "@/domains/quotes/stale";

// Lo invoca Vercel Cron (vercel.json) una vez al dia. Vercel envia
// "Authorization: Bearer <CRON_SECRET>" cuando la variable CRON_SECRET existe.
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const result = await rejectStaleQuotes(prisma, { dryRun });
  console.log("[cron] cotizaciones-vencidas", result);
  return Response.json(result);
}
