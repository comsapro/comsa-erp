import { requirePagePermission } from "@/lib/auth/guard";
import { readPeriodParams } from "@/domains/kpis/periods";
import { KPI_SECTIONS } from "@/domains/kpis/constants";
import ManagementDashboardClient from "./ManagementDashboardClient";

export const metadata = { title: "Dashboard gerencial" };

export default async function DashboardGerencialPage({ searchParams }) {
  await requirePagePermission("kpis.view");
  const sp = (await searchParams) || {};
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = KPI_SECTIONS.some((s) => s.key === tabParam) ? tabParam : "resumen";
  return <ManagementDashboardClient initialParams={readPeriodParams(sp)} initialTab={tab} />;
}
