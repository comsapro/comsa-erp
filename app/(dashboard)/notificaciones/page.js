import { requireUser } from "@/lib/auth/session";
import NotificationsClient from "./NotificationsClient";

export const metadata = { title: "Notificaciones" };

export default async function NotificacionesPage() {
  await requireUser();
  return <NotificationsClient />;
}
