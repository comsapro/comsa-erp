import { requirePagePermission } from "@/lib/auth/guard";
import CommitmentsClient from "./CommitmentsClient";

export const metadata = { title: "Compromisos" };

export default async function CompromisosPage() {
  await requirePagePermission("commitments.view");
  return <CommitmentsClient />;
}
