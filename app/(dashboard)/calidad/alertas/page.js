import { requirePagePermission } from "@/lib/auth/guard";
import AlertsClient from "./AlertsClient";

export const metadata = { title: "Alertas de Calidad" };

export default async function AlertasPage() {
  await requirePagePermission("quality.manage_alerts");
  return <AlertsClient />;
}
