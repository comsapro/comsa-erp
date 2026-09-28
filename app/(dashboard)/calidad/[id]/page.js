import { requirePagePermission } from "@/lib/auth/guard";
import QualityOrderClient from "./QualityOrderClient";

export const metadata = { title: "Calidad — Orden" };

export default async function CalidadOrdenPage({ params }) {
  await requirePagePermission("quality.view");
  const { id } = await params;
  return <QualityOrderClient orderId={id} />;
}
