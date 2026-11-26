import "server-only";
import { prisma } from "@/lib/db";
import { userHasPermission } from "@/lib/auth/session";

/**
 * Catalogos del formulario de factura: equipos a los que se puede acreditar
 * (todos con sales.view_team; si no, los del usuario), motivos de factura sin
 * cotizacion y clientes activos.
 */
export async function loadInvoiceFormOptions(user) {
  const allTeams = userHasPermission(user, "sales.view_team");
  const [teams, reasons, clients] = await Promise.all([
    prisma.team.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        ...(allTeams ? {} : { members: { some: { userId: user.id } } }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.kpiCatalogEntry.findMany({
      where: { type: "INVOICE_NO_QUOTE_REASON", deletedAt: null, status: "ACTIVE" },
      select: { code: true, label: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.client.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, commercialName: true },
      orderBy: { commercialName: "asc" },
    }),
  ]);
  return { teams, reasons, clients };
}
