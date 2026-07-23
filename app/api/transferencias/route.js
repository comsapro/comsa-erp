import { withErrorHandling } from "@/lib/api/http";
import {
  listTransfers,
  createTransfer,
} from "@/domains/transfers/service";

export const GET = withErrorHandling((req) => listTransfers(req));
export const POST = withErrorHandling((req) => createTransfer(req));
