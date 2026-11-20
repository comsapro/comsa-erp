import { requirePagePermission } from "@/lib/auth/guard";
import ProjectOverviewClient from "./ProjectOverviewClient";

export const metadata = { title: "Proyecto" };

export default async function ProjectOverviewPage({ params }) {
  await requirePagePermission("kpis.view");
  const { orderId } = await params;
  return <ProjectOverviewClient orderId={orderId} />;
}
