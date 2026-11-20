import { requirePagePermission } from "@/lib/auth/guard";
import { userHasPermission } from "@/lib/auth/session";
import { readPeriodParams } from "@/domains/kpis/periods";
import QualityErrorsClient from "./QualityErrorsClient";

export const metadata = { title: "Errores y costos de calidad" };

export default async function QualityErrorsPage({ searchParams }) {
  const user = await requirePagePermission("quality.view");
  const sp = (await searchParams) || {};
  return (
    <QualityErrorsClient
      initialParams={readPeriodParams(sp)}
      canEdit={userHasPermission(user, "quality.record_errors")}
    />
  );
}
