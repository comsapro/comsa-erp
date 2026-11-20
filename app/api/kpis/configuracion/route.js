import { withErrorHandling } from "@/lib/api/http";
import { getKpiSettingsHandler, updateKpiSettings } from "@/domains/kpis/settings";

export const GET = withErrorHandling(() => getKpiSettingsHandler());
export const PUT = withErrorHandling((req) => updateKpiSettings(req));
