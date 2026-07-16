"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-muted px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning-50 text-warning-700">
        <TriangleAlert className="h-7 w-7" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-content">
          Ocurrio un error
        </h1>
        <p className="mt-2 max-w-md text-sm text-content-muted">
          Algo salio mal al procesar tu solicitud. Puedes intentar nuevamente.
        </p>
      </div>
      <Button onClick={() => reset()}>Reintentar</Button>
    </div>
  );
}
