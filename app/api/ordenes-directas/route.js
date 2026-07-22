import { withErrorHandling } from "@/lib/api/http";
import {
  listDirectOrders,
  createDirectOrder,
} from "@/domains/direct-orders/service";

export const GET = withErrorHandling((req) => listDirectOrders(req));
export const POST = withErrorHandling((req) => createDirectOrder(req));
