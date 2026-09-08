import { requirePagePermission } from "@/lib/auth/guard";
import SalesInvoicesClient from "./SalesInvoicesClient";

export const metadata = { title: "Facturas de ventas" };

export default async function FacturasVentasPage() {
  await requirePagePermission("sales.create_invoice");
  return <SalesInvoicesClient />;
}
