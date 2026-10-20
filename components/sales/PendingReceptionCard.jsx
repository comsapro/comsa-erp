import Link from "next/link";
import { FileWarning, Receipt } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/format";
import { invoiceListHref } from "@/domains/sales/invoice-reception";

function ageLabel(days) {
  if (days == null) return "";
  if (days === 0) return "La más antigua es de hoy";
  return `La más antigua tiene ${days} ${days === 1 ? "día" : "días"}`;
}

export function PendingReceptionCard({ summary, sellerId, canOpenInvoices }) {
  const count = summary?.count ?? 0;
  const pending = count > 0;

  return (
    <Card
      className={cn(
        "p-4 transition-colors duration-200",
        pending && "border-warning-500/40 bg-warning-50"
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.5 text-sm",
          pending ? "text-warning-700" : "text-content-muted"
        )}
      >
        {pending ? (
          <FileWarning className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Receipt className="h-4 w-4" aria-hidden="true" />
        )}
        Facturas sin recepción
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold",
          pending ? "text-warning-700" : "text-content"
        )}
      >
        {count}
      </p>
      <p className="mt-1 text-xs text-content-muted">
        {pending
          ? `${formatMoney(summary.amount)} · ${ageLabel(summary.oldestDays)}`
          : "Ninguna factura pendiente de recepción del cliente."}
      </p>
      {canOpenInvoices && (
        <Link
          href={invoiceListHref({ pendingReception: pending, sellerId })}
          className="mt-2 inline-block rounded text-sm text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {pending ? "Ver facturas sin recepción" : "Ver facturas"}
        </Link>
      )}
    </Card>
  );
}
