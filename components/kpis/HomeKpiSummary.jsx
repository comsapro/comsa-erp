"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gauge, Presentation } from "lucide-react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { SummaryBlocks } from "./SummaryBlocks";

/** Cinco bloques del Dashboard gerencial en la pantalla de inicio (mes en curso). */
export function HomeKpiSummary() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get("/api/kpis/resumen")
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-content">
          Resumen ejecutivo{data ? ` · ${data.period.label}` : ""}
        </h2>
        <div className="flex gap-2">
          <Button as={Link} href="/dashboard-gerencial/junta" size="sm" variant="secondary">
            <Presentation className="h-4 w-4" />
            Modo Junta
          </Button>
          <Button as={Link} href="/dashboard-gerencial" size="sm">
            <Gauge className="h-4 w-4" />
            Dashboard gerencial
          </Button>
        </div>
      </div>
      <SummaryBlocks blocks={data?.blocks} onOpen={(tab) => router.push(`/dashboard-gerencial?tab=${tab}`)} />
    </section>
  );
}

export default HomeKpiSummary;
