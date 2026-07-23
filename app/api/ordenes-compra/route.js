import { withErrorHandling } from "@/lib/api/http";
import {
  listPurchaseOrders,
  createPurchaseOrder,
} from "@/domains/purchase-orders/service";

export const GET = withErrorHandling((req) => listPurchaseOrders(req));
export const POST = withErrorHandling((req) => createPurchaseOrder(req));
