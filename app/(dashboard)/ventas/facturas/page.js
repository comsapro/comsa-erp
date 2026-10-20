import { requirePagePermission } from "@/lib/auth/guard";
import { parseInvoiceListFilters } from "@/domains/sales/invoice-reception";
import SalesInvoicesClient from "./SalesInvoicesClient";

export const metadata = { title: "Facturas de ventas" };

export default async function FacturasVentasPage({ searchParams }) {
  await requirePagePermission("sales.create_invoice");
  const filters = parseInvoiceListFilters((await searchParams) || {});
  return (
    <SalesInvoicesClient
      initialPendingOnly={filters.pendingReception}
      sellerId={filters.sellerId}
    />
  );
}
