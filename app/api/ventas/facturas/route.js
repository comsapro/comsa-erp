import { withErrorHandling } from "@/lib/api/http";
import { listSalesInvoices, createSalesInvoice } from "@/domains/sales/service";

export const GET = withErrorHandling((req) => listSalesInvoices(req));
export const POST = withErrorHandling((req) => createSalesInvoice(req));
