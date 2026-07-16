import { requireUser } from "@/lib/auth/session";
import { buildMenu } from "@/lib/navigation/menu";
import { PermissionsProvider } from "@/components/permissions/PermissionsProvider";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/feedback/ToastProvider";

export default async function DashboardLayout({ children }) {
  const user = await requireUser();
  const sections = buildMenu(user.permissions);
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV || "local";

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
  };

  return (
    <PermissionsProvider permissions={user.permissions}>
      <ToastProvider>
        <AppShell sections={sections} user={safeUser} appEnv={appEnv}>
          {children}
        </AppShell>
      </ToastProvider>
    </PermissionsProvider>
  );
}
