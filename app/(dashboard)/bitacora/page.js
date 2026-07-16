import { requirePagePermission } from "@/lib/auth/guard";
import AuditClient from "./AuditClient";

export const metadata = { title: "Bitacora" };

export default async function AuditPage() {
  await requirePagePermission("audit.view");
  return <AuditClient />;
}
