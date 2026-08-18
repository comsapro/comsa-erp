import { withErrorHandling } from "@/lib/api/http";
import { listAssignables } from "@/domains/production/dashboard";

export const GET = withErrorHandling(() => listAssignables());
