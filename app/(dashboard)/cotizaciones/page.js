import { Suspense } from "react";
import { requirePagePermission } from "@/lib/auth/guard";
import QuotesClient from "./QuotesClient";

export const metadata = { title: "Cotizaciones" };

export default async function CotizacionesPage() {
  await requirePagePermission("quotes.view");
  return (
    <Suspense fallback={<p className="text-sm text-content-muted">Cargando...</p>}>
      <QuotesClient />
    </Suspense>
  );
}
