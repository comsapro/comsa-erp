import { requirePagePermission } from "@/lib/auth/guard";
import QuotesClient from "./QuotesClient";

export const metadata = { title: "Cotizaciones" };

export default async function CotizacionesPage() {
  await requirePagePermission("quotes.view");
  return <QuotesClient />;
}
