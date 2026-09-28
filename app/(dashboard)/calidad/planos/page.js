import { requirePagePermission } from "@/lib/auth/guard";
import QualityInspectionsClient from "../QualityInspectionsClient";

export const metadata = { title: "Planos de calidad" };

export default async function QualityDrawingsPage() {
  await requirePagePermission("quality.view");
  return <QualityInspectionsClient />;
}
