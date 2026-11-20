import { withErrorHandling } from "@/lib/api/http";
import { listAssignableUsers } from "@/domains/kpis/incidents";

export const GET = withErrorHandling(() => listAssignableUsers());
