import { requirePagePermission } from "@/lib/auth/guard";
import IssuingCompaniesClient from "./IssuingCompaniesClient";

export const metadata = { title: "Empresas emisoras" };

export default async function IssuingCompaniesPage() {
  await requirePagePermission("issuing_companies.view");
  return <IssuingCompaniesClient />;
}
