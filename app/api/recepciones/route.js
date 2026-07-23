import { withErrorHandling } from "@/lib/api/http";
import {
  listReceipts,
  createReceipt,
} from "@/domains/purchase-receipts/service";

export const GET = withErrorHandling((req) => listReceipts(req));
export const POST = withErrorHandling((req) => createReceipt(req));
