import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";

export const metadata = { title: "Planos de calidad" };

/** Los planos se consultan dentro de cada orden (boton Planos en la partida). */
export default async function QualityDrawingsPage() {
  await requirePagePermission("quality.view");
  redirect("/calidad");
}
