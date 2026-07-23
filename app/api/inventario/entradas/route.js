import { withErrorHandling } from "@/lib/api/http";
import { createEntry } from "@/domains/inventory/service";

export const POST = withErrorHandling((req) => createEntry(req));
