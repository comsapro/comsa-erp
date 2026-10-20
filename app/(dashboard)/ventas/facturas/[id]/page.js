import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { userHasPermission, userIsAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import SalesInvoiceFormClient from "../nuevo/SalesInvoiceFormClient";

export const metadata = { title: "Editar factura de ventas" };

export default async function EditarFacturaVentasPage({ params }) {
  const user = await requirePagePermission("sales.edit_invoice");
  const { id } = await params;
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, deletedAt: null },
    include: {
      seller: { select: { id: true, name: true } },
      quotes: {
        include: {
          quote: {
            select: {
              id: true,
              folio: true,
              status: true,
              total: true,
              currency: true,
              client: { select: { commercialName: true } },
              seller: { select: { id: true, name: true } },
            },
          },
          items: {
            include: {
              quoteItem: {
                select: {
                  id: true,
                  position: true,
                  description: true,
                  quantity: true,
                  unit: true,
                  total: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!invoice) notFound();

  return (
    <SalesInvoiceFormClient
      canViewTeam={userHasPermission(user, "sales.view_team")}
      isAdmin={userIsAdmin(user)}
      currentUserId={user.id}
      currentUserName={user.name}
      invoice={JSON.parse(JSON.stringify(invoice))}
    />
  );
}
