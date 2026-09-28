import { requirePagePermission } from "@/lib/auth/guard";
import HistoryIndexClient from "./HistoryIndexClient";

export const metadata = { title: "Historial de Calidad" };

export default async function HistorialIndexPage() {
  await requirePagePermission("quality.view_history");
  return <HistoryIndexClient />;
}
