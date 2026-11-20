import { withErrorHandling } from "@/lib/api/http";
import { correctInvoiceField, listCorrections } from "@/domains/kpis/invoices";

export const GET = withErrorHandling((req) => listCorrections(req));
export const POST = withErrorHandling((req) => correctInvoiceField(req));
