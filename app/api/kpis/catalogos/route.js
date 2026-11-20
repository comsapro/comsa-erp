import { withErrorHandling } from "@/lib/api/http";
import { listCatalogEntries, createCatalogEntry } from "@/domains/kpis/settings";

export const GET = withErrorHandling((req) => listCatalogEntries(req));
export const POST = withErrorHandling((req) => createCatalogEntry(req));
