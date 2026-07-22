import { requirePagePermission } from "@/lib/auth/guard";
import InstallationsClient from "./InstallationsClient";

export const metadata = { title: "Conceptos de instalacion" };

export default async function InstallationsPage() {
  await requirePagePermission("installation_concepts.view");
  return <InstallationsClient />;
}
