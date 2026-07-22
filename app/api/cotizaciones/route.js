import { withErrorHandling } from "@/lib/api/http";
import { listQuotes, createQuote } from "@/domains/quotes/service";

export const GET = withErrorHandling((req) => listQuotes(req));
export const POST = withErrorHandling((req) => createQuote(req));
