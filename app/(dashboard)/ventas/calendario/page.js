import { requirePagePermission } from "@/lib/auth/guard";
import { userHasPermission } from "@/lib/auth/session";
import SalesCalendarClient from "./SalesCalendarClient";

export const metadata = { title: "Calendario de compromisos" };

export default async function CalendarioVentasPage() {
  const user = await requirePagePermission("sales.view");
  return (
    <SalesCalendarClient
      canEditCommitment={userHasPermission(user, "sales.edit_commitment")}
    />
  );
}
