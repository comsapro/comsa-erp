import { requirePagePermission } from "@/lib/auth/guard";
import ReceiptsClient from "./ReceiptsClient";

export const metadata = { title: "Recepciones" };

export default async function RecepcionesPage() {
  await requirePagePermission("purchase_orders.receive");
  return <ReceiptsClient />;
}
