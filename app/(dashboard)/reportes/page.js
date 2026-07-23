import { requirePageAnyPermission } from "@/lib/auth/guard";
import ReportsClient from "./ReportsClient";

export const metadata = { title: "Reportes PDF" };

export default async function ReportesPage() {
  await requirePageAnyPermission([
    "reports.quotations_pdf",
    "reports.production_pdf",
    "reports.inventory_pdf",
    "reports.purchases_pdf",
  ]);
  return <ReportsClient />;
}
