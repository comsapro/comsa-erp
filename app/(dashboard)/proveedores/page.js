import { requirePagePermission } from "@/lib/auth/guard";
import SuppliersClient from "./SuppliersClient";

export const metadata = { title: "Proveedores" };

export default async function SuppliersPage() {
  await requirePagePermission("suppliers.view");
  return <SuppliersClient />;
}
