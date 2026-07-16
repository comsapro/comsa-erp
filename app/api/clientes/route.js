import { withErrorHandling } from "@/lib/api/http";
import { listClients, createClient } from "@/domains/clients/service";

export const GET = withErrorHandling((req) => listClients(req));
export const POST = withErrorHandling((req) => createClient(req));
