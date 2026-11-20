import { requireUser } from "@/lib/auth/session";
import IncidentsClient from "./IncidentsClient";

export const metadata = { title: "Incidencias" };

export default async function IncidenciasPage({ searchParams }) {
  await requireUser();
  const sp = (await searchParams) || {};
  const id = Array.isArray(sp.id) ? sp.id[0] : sp.id;
  return <IncidentsClient initialId={id || null} />;
}
