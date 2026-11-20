import { requirePagePermission } from "@/lib/auth/guard";
import KpiCatalogsClient from "./KpiCatalogsClient";

export const metadata = { title: "Catálogos KPI" };

export default async function KpiCatalogsPage() {
  await requirePagePermission("kpis.manage_catalogs");
  return <KpiCatalogsClient />;
}
