import { requirePagePermission } from "@/lib/auth/guard";
import CommitmentDetailClient from "./CommitmentDetailClient";

export const metadata = { title: "Compromiso" };

export default async function CompromisoPage({ params }) {
  await requirePagePermission("commitments.view");
  const { id } = await params;
  return <CommitmentDetailClient id={id} />;
}
