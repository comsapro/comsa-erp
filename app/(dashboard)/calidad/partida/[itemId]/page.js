import { requirePagePermission } from "@/lib/auth/guard";
import QualityItemClient from "./QualityItemClient";

export const metadata = { title: "Partida de calidad" };

export default async function CalidadPartidaPage({ params }) {
  await requirePagePermission("quality.view");
  const { itemId } = await params;
  return <QualityItemClient itemId={itemId} />;
}
