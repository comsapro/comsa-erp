import { Suspense } from "react";
import { requirePagePermission } from "@/lib/auth/guard";
import QuoteDetailClient from "./QuoteDetailClient";
import { Skeleton } from "@/components/feedback/Skeleton";

export const metadata = { title: "Detalle de cotizacion" };

export default async function CotizacionDetallePage({ params }) {
  await requirePagePermission("quotes.view");
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <QuoteDetailClient quoteId={id} />
    </Suspense>
  );
}
