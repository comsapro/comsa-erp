import { requirePagePermission } from "@/lib/auth/guard";
import InspectionWorkspace from "@/components/quality/InspectionWorkspace";

export const metadata = { title: "Revision de plano" };

export default async function DrawingInspectionPage({ params }) {
  await requirePagePermission("quality.view");
  const { inspectionId } = await params;
  return <InspectionWorkspace id={inspectionId} />;
}
