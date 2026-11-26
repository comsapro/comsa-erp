import { requirePageAnyPermission } from "@/lib/auth/guard";
import KpiCatalogsClient from "../../dashboard-gerencial/catalogos/KpiCatalogsClient";

export const metadata = { title: "Operadores" };

export default async function OperatorsPage() {
  await requirePageAnyPermission(["quality.manage_operators", "kpis.manage_catalogs"]);
  return (
    <KpiCatalogsClient
      types={["OPERATOR"]}
      title="Operadores"
      description="Catálogo de operadores para registrar errores de calidad y asignar instrumentos de medición."
      showSettings={false}
    />
  );
}
