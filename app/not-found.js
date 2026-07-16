import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Pagina no encontrada" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-muted px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <FileQuestion className="h-7 w-7" />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          Error 404
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-content">
          Pagina no encontrada
        </h1>
        <p className="mt-2 max-w-md text-sm text-content-muted">
          La pagina que buscas no existe o fue movida.
        </p>
      </div>
      <Button as={Link} href="/">
        Volver al inicio
      </Button>
    </div>
  );
}
