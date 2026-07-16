import { withErrorHandling } from "@/lib/api/http";
import { listUsers, createUser } from "@/domains/users/service";

export const GET = withErrorHandling((req) => listUsers(req));
export const POST = withErrorHandling((req) => createUser(req));
