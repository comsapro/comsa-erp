import { requirePagePermission } from "@/lib/auth/guard";
import TemplatesClient from "./TemplatesClient";

export const metadata = { title: "Biblioteca de items" };

export default async function BibliotecaItemsPage() {
  await requirePagePermission("quote_templates.view");
  return <TemplatesClient />;
}
