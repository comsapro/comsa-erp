import { withErrorHandling } from "@/lib/api/http";
import { listActiveUsersForSelect } from "@/domains/users/active-users";

export const GET = withErrorHandling((req) => listActiveUsersForSelect(req));
