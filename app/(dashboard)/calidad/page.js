import { requirePagePermission } from "@/lib/auth/guard";
import QualityInboxClient from "./QualityInboxClient";

export const metadata = { title: "Calidad — Bandeja pendiente" };

export default async function CalidadPage() {
  await requirePagePermission("quality.view");
  return <QualityInboxClient />;
}
