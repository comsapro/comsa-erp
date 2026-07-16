import { withErrorHandling } from "@/lib/api/http";
import { listRoles, createRole } from "@/domains/roles/service";

export const GET = withErrorHandling((req) => listRoles(req));
export const POST = withErrorHandling((req) => createRole(req));
