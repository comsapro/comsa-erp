import { requirePagePermission } from "@/lib/auth/guard";
import RolesClient from "./RolesClient";

export const metadata = { title: "Roles y permisos" };

export default async function RolesPage() {
  await requirePagePermission("roles.view");
  return <RolesClient />;
}
