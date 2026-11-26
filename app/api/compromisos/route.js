import { withErrorHandling } from "@/lib/api/http";
import { createCommitment, listCommitments } from "@/domains/commitments/service";

export const GET = withErrorHandling((req) => listCommitments(req));
export const POST = withErrorHandling((req) => createCommitment(req));
