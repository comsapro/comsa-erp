"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function PrintActions({ backHref }) {
  return (
    <div className="no-print mb-6 flex justify-end gap-2">
      <Button as={Link} href={backHref} variant="secondary">
        Volver
      </Button>
      <Button type="button" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Imprimir
      </Button>
    </div>
  );
}
