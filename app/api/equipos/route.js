import { withErrorHandling } from "@/lib/api/http";
import { listTeams, createTeam } from "@/domains/teams/service";

export const GET = withErrorHandling((req) => listTeams(req));
export const POST = withErrorHandling((req) => createTeam(req));
