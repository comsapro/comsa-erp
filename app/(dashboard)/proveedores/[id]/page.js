import { requirePagePermission } from "@/lib/auth/guard";
import SupplierProfileClient from "./SupplierProfileClient";

export const metadata = { title: "Perfil de proveedor" };

export default async function SupplierProfilePage({ params }) {
  await requirePagePermission("suppliers.view");
  const { id } = await params;
  return <SupplierProfileClient id={id} />;
}
