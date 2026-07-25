import { requirePagePermission } from "@/lib/auth/guard";
import ClientProfileClient from "./ClientProfileClient";

export const metadata = { title: "Perfil de cliente" };

export default async function ClientProfilePage({ params }) {
  await requirePagePermission("clients.view");
  const { id } = await params;
  return <ClientProfileClient id={id} />;
}
