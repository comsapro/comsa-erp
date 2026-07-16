import { requirePagePermission } from "@/lib/auth/guard";
import CategoriesClient from "./CategoriesClient";

export const metadata = { title: "Categorias de productos" };

export default async function CategoriesPage() {
  await requirePagePermission("categories.view");
  return <CategoriesClient />;
}
