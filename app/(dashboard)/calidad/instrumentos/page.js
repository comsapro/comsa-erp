import { requirePagePermission } from "@/lib/auth/guard";
import InstrumentsClient from "./InstrumentsClient";

export const metadata = { title: "Instrumentos de medicion" };

export default async function InstrumentosPage() {
  await requirePagePermission("quality.manage_instruments");
  return <InstrumentsClient />;
}
