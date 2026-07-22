import { requirePagePermission } from "@/lib/auth/guard";
import DirectOrderCreateClient from "./DirectOrderCreateClient";

export const metadata = { title: "Nueva orden directa" };

export default async function NewDirectOrderPage() {
  await requirePagePermission("direct_orders.create");
  return <DirectOrderCreateClient />;
}
