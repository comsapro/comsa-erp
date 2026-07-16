import { requirePagePermission } from "@/lib/auth/guard";
import UsersClient from "./UsersClient";

export const metadata = { title: "Usuarios" };

export default async function UsersPage() {
  await requirePagePermission("users.view");
  return <UsersClient />;
}
