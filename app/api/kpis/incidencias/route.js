import { withErrorHandling } from "@/lib/api/http";
import { createMeetingIncident } from "@/domains/kpis/incidents";

export const POST = withErrorHandling((req) => createMeetingIncident(req));
