import { requirePagePermission } from "@/lib/auth/guard";
import TeamsClient from "./TeamsClient";

export const metadata = { title: "Equipos" };

export default async function EquiposPage() {
  await requirePagePermission("teams.view");
  return <TeamsClient />;
}
