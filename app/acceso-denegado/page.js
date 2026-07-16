import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Acceso denegado" };

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-muted px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-700">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-danger-700">
          Error 403
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-content">
          Acceso denegado
        </h1>
        <p className="mt-2 max-w-md text-sm text-content-muted">
          No cuentas con los permisos necesarios para acceder a esta seccion.
          Si crees que es un error, contacta a un administrador.
        </p>
      </div>
      <Button as={Link} href="/">
        Volver al inicio
      </Button>
    </div>
  );
}
