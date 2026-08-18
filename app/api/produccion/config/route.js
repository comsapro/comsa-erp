import { withErrorHandling } from "@/lib/api/http";
import {
  getProductionSettings,
  updateProductionSettings,
} from "@/domains/production/settings";

export const GET = withErrorHandling((req) => getProductionSettings(req));
export const PATCH = withErrorHandling((req) => updateProductionSettings(req));
