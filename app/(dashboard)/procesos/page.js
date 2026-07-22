import { requirePagePermission } from "@/lib/auth/guard";
import ProcessesClient from "./ProcessesClient";

export const metadata = { title: "Procesos de manufactura" };

export default async function ProcessesPage() {
  await requirePagePermission("manufacturing_processes.view");
  return <ProcessesClient />;
}
