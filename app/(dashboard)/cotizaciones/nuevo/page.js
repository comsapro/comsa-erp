import { requirePagePermission } from "@/lib/auth/guard";
import QuoteFormClient from "./QuoteFormClient";

export const metadata = { title: "Nueva cotizacion" };

export default async function NuevaCotizacionPage() {
  const user = await requirePagePermission("quotes.create");
  return (
    <QuoteFormClient
      currentUser={{ id: user.id, name: user.name, email: user.email }}
    />
  );
}
