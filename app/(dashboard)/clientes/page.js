import { requirePagePermission } from "@/lib/auth/guard";
import ClientsClient from "./ClientsClient";

export const metadata = { title: "Clientes" };

export default async function ClientsPage() {
  await requirePagePermission("clients.view");
  return <ClientsClient />;
}
