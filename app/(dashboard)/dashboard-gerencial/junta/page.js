import { requirePagePermission } from "@/lib/auth/guard";
import { readPeriodParams } from "@/domains/kpis/periods";
import MeetingModeClient from "./MeetingModeClient";

export const metadata = { title: "Modo Junta" };

export default async function MeetingModePage({ searchParams }) {
  await requirePagePermission("kpis.view");
  const sp = (await searchParams) || {};
  const week = Array.isArray(sp.semana) ? sp.semana[0] : sp.semana;
  return <MeetingModeClient initialParams={readPeriodParams(sp)} initialWeek={week || null} />;
}
