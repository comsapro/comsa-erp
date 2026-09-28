import { withErrorHandling } from "@/lib/api/http";
import {
  listInstruments,
  createInstrument,
} from "@/domains/quality/service";

export const GET = withErrorHandling(async (req) => listInstruments(req));
export const POST = withErrorHandling(async (req) => createInstrument(req));
