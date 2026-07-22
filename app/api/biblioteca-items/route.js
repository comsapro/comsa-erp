import { withErrorHandling } from "@/lib/api/http";
import {
  listTemplates,
  createTemplate,
} from "@/domains/quote-templates/service";

export const GET = withErrorHandling((req) => listTemplates(req));
export const POST = withErrorHandling((req) => createTemplate(req));
